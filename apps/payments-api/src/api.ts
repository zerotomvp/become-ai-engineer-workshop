import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { readDoc, docTopics } from './docs.ts'
import { ApiError } from './errors.ts'
import {
  nextId,
  tick,
  type Account,
  type ApiKey,
  type ApiVersion,
  type Permission,
  type Store,
} from './store.ts'
import {
  apiVersions,
  latestVersion,
  presentPayment,
  requestedCaptureMode,
  schemas,
} from './versions.ts'
import { parse, readBody } from './validation.ts'

type Env = { Variables: { account: Account; key: ApiKey } }

// Test payment methods and how they behave.
const paymentMethods: Record<string, 'approved' | 'declined'> = {
  pm_card_visa: 'approved',
  pm_card_mastercard: 'approved',
  pm_card_declined: 'declined',
}

// The Stripe-shaped API over one store. Every /v1 request is logged,
// authenticated against the account's key, and pinned to the account's version.
export function createApi(store: Store) {
  const api = new Hono<Env>()

  api.onError((error, c) => {
    if (!(error instanceof ApiError)) {
      console.error(error)
      return c.json(
        { error: { type: 'api_error', message: 'Internal error' } },
        500
      )
    }
    const version = c.get('account')?.apiVersion ?? latestVersion
    return c.json(error.toBody(version), error.status)
  })

  api.use('/v1/*', logRequest(store), authenticate(store), idempotency(store))

  api.post('/v1/payments', allow('payments:write'), async c => {
    const account = c.get('account')
    const input = parse(
      schemas[account.apiVersion].createPayment,
      await readBody(c)
    )
    if (!account.currencies.includes(input.currency)) {
      throw new ApiError(
        'currency_not_supported',
        `This account cannot take payments in ${input.currency}.`,
        'currency'
      )
    }
    if (input.amount < 50) {
      throw new ApiError(
        'amount_too_small',
        'Amount must be at least 50 in the smallest currency unit.',
        'amount'
      )
    }
    const captureMode = requestedCaptureMode(input) ?? 'automatic'
    if (account.requiresManualCapture && captureMode !== 'manual') {
      throw new ApiError(
        'manual_capture_setting_missing',
        'This account requires manual capture: create the payment with manual capture, then capture it.'
      )
    }
    const outcome = paymentMethods[input.paymentMethod]
    if (!outcome) {
      throw new ApiError(
        'resource_missing',
        `No such payment method: '${input.paymentMethod}'`,
        'paymentMethod'
      )
    }
    if (outcome === 'declined') {
      throw new ApiError('card_declined', 'Your card was declined.')
    }

    const payment = {
      id: nextId(store, 'pay'),
      account: account.id,
      mode: c.get('key').mode,
      amount: input.amount,
      currency: input.currency,
      captureMode,
      status: captureMode === 'manual' ? 'requires_capture' : 'succeeded',
      amountCaptured: captureMode === 'manual' ? 0 : input.amount,
      amountRefunded: 0,
      paymentMethod: input.paymentMethod,
      description: input.description,
      metadata: input.metadata,
      created: store.now,
    } as const
    store.payments[payment.id] = payment
    return c.json(presentPayment(payment, account.apiVersion))
  })

  api.get('/v1/payments/:id', allow('payments:read'), c => {
    const payment = findPayment(
      c.get('account'),
      c.get('key'),
      c.req.param('id')
    )
    return c.json(presentPayment(payment, c.get('account').apiVersion))
  })

  api.post('/v1/payments/:id/capture', allow('payments:write'), async c => {
    const account = c.get('account')
    const input = parse(
      schemas[account.apiVersion].capturePayment,
      await readBody(c)
    )
    const payment = findPayment(account, c.get('key'), c.req.param('id'))
    expectStatus(payment.status, 'requires_capture', 'captured')
    const amount = input.amountToCapture ?? payment.amount
    if (amount > payment.amount) {
      throw new ApiError(
        'amount_too_large',
        `Cannot capture ${amount}: the payment authorized ${payment.amount}.`,
        'amountToCapture'
      )
    }
    payment.status = 'succeeded'
    payment.amountCaptured = amount
    return c.json(presentPayment(payment, account.apiVersion))
  })

  api.post('/v1/payments/:id/cancel', allow('payments:write'), async c => {
    const account = c.get('account')
    parse(schemas[account.apiVersion].cancelPayment, await readBody(c))
    const payment = findPayment(account, c.get('key'), c.req.param('id'))
    expectStatus(payment.status, 'requires_capture', 'canceled')
    payment.status = 'canceled'
    return c.json(presentPayment(payment, account.apiVersion))
  })

  api.post('/v1/refunds', allow('refunds:write'), async c => {
    const account = c.get('account')
    const input = parse(
      schemas[account.apiVersion].createRefund,
      await readBody(c)
    )
    const payment = findPayment(account, c.get('key'), input.payment, 'payment')
    expectStatus(payment.status, 'succeeded', 'refunded')
    const refundable = payment.amountCaptured - payment.amountRefunded
    if (refundable === 0) {
      throw new ApiError(
        'payment_already_refunded',
        `Payment ${payment.id} has already been fully refunded.`,
        'payment'
      )
    }
    const amount = input.amount ?? refundable
    if (amount > refundable) {
      throw new ApiError(
        'amount_too_large',
        `Cannot refund ${amount}: only ${refundable} is left to refund.`,
        'amount'
      )
    }

    const refund = {
      id: nextId(store, 're'),
      account: account.id,
      mode: c.get('key').mode,
      payment: payment.id,
      amount,
      currency: payment.currency,
      reason: input.reason,
      status: 'succeeded',
      created: store.now,
    } as const
    payment.amountRefunded += amount
    store.refunds[refund.id] = refund
    return c.json(presentRefund(refund))
  })

  api.get('/v1/refunds/:id', allow('refunds:read'), c => {
    const refund = store.refunds[c.req.param('id')]
    if (!refund || !belongsTo(refund, c.get('account'), c.get('key'))) {
      throw new ApiError(
        'resource_missing',
        `No such refund: '${c.req.param('id')}'`
      )
    }
    return c.json(presentRefund(refund))
  })

  api.get('/docs/:version', c => {
    if (!isVersion(c.req.param('version'))) return c.notFound()
    return c.json({ version: c.req.param('version'), topics: docTopics })
  })

  api.get('/docs/:version/:topic', c => {
    const version = c.req.param('version')
    const doc = isVersion(version) && readDoc(version, c.req.param('topic'))
    if (!doc) return c.notFound()
    return c.body(doc, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  })

  function findPayment(
    account: Account,
    key: ApiKey,
    id: string,
    param?: string
  ) {
    const payment = store.payments[id]
    // A test key can't see live objects, nor one account another's.
    if (!payment || !belongsTo(payment, account, key)) {
      throw new ApiError('resource_missing', `No such payment: '${id}'`, param)
    }
    return payment
  }

  return api
}

function logRequest(store: Store): MiddlewareHandler<Env> {
  return async (c, next) => {
    const created = tick(store)
    const id = nextId(store, 'req')
    const text = await c.req.text()
    await next()

    c.header('Request-Id', id)
    const account = c.get('account')
    store.requests.push({
      id,
      account: account?.id,
      mode: c.get('key')?.mode,
      apiVersion: account?.apiVersion,
      method: c.req.method,
      path: c.req.path,
      headers: pickHeaders(c.req.header()),
      body: text ? parseOrText(text) : undefined,
      status: c.res.status,
      response: await c.res.clone().json(),
      created,
    })
  }
}

function authenticate(store: Store): MiddlewareHandler<Env> {
  return async (c, next) => {
    const [scheme, secret] = c.req.header('Authorization')?.split(' ') ?? []
    const key = scheme === 'Bearer' && secret ? store.keys[secret] : undefined
    if (!key) {
      throw new ApiError('invalid_api_key', 'Invalid API key provided.')
    }
    const account = store.accounts[key.account]
    c.set('account', account)
    c.set('key', key)
    c.header('Api-Version', account.apiVersion)
    if (key.mode === 'live' && !account.liveEnabled) {
      throw new ApiError(
        'live_mode_not_enabled',
        'This account cannot use live mode yet. Use a test key.'
      )
    }
    await next()
  }
}

// A retried POST with the same Idempotency-Key gets the first response back
// instead of being applied twice.
function idempotency(store: Store): MiddlewareHandler<Env> {
  return async (c, next) => {
    const idempotencyKey = c.req.header('Idempotency-Key')
    if (c.req.method !== 'POST' || !idempotencyKey) return next()

    const scope = `${c.get('account').id}:${c.get('key').mode}:${idempotencyKey}`
    const fingerprint = `${c.req.path} ${await c.req.text()}`
    const previous = store.idempotency[scope]
    if (previous && previous.fingerprint !== fingerprint) {
      throw new ApiError(
        'idempotency_key_reused',
        'This Idempotency-Key was already used with different parameters.'
      )
    }
    if (previous) {
      c.header('Idempotent-Replayed', 'true')
      return c.json(previous.body, previous.status as 200)
    }

    await next()
    // Like Stripe, save the result only once the request got past validation:
    // a request rejected as invalid may be corrected and retried with its key.
    if (!c.res.ok && c.res.status !== 402) return
    store.idempotency[scope] = {
      fingerprint,
      status: c.res.status,
      body: await c.res.clone().json(),
    }
  }
}

function allow(permission: Permission): MiddlewareHandler<Env> {
  return async (c, next) => {
    const { permissions } = c.get('key')
    if (permissions !== 'all' && !permissions.includes(permission)) {
      throw new ApiError(
        'permission_denied',
        `This API key does not have the ${permission} permission.`
      )
    }
    await next()
  }
}

function expectStatus(actual: string, expected: string, action: string) {
  if (actual !== expected) {
    throw new ApiError(
      'payment_unexpected_state',
      `This payment has status ${actual}; only payments with status ${expected} can be ${action}.`
    )
  }
}

function belongsTo(
  resource: { account: string; mode: string },
  account: Account,
  key: ApiKey
) {
  return resource.account === account.id && resource.mode === key.mode
}

function presentRefund(refund: Store['refunds'][string]) {
  const { id, account, mode, ...fields } = refund
  return { id, object: 'refund', ...fields, livemode: mode === 'live' }
}

function isVersion(version: string): version is ApiVersion {
  return (apiVersions as string[]).includes(version)
}

function pickHeaders(headers: Record<string, string>) {
  const kept: Record<string, string> = {}
  for (const name of ['authorization', 'idempotency-key']) {
    if (headers[name]) kept[name] = headers[name]
  }
  return kept
}

function parseOrText(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
