import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deposit, startLab } from './helpers.ts'

const sale = { ...deposit, amount: 2400 }

test('a manual payment moves from requires_capture to succeeded', async () => {
  const { send } = startLab()
  const created = await send('sk_test_lumen', '/v1/payments', {
    ...sale,
    captureMode: 'manual',
  })
  const captured = await send(
    'sk_test_lumen',
    `/v1/payments/${created.body.id}/capture`,
    { amountToCapture: 2000 }
  )
  assert.equal(captured.body.status, 'succeeded')
  assert.equal(captured.body.amountCaptured, 2000)

  const again = await send(
    'sk_test_lumen',
    `/v1/payments/${created.body.id}/capture`,
    {}
  )
  assert.equal(again.body.error.code, 'payment_unexpected_state')
})

test('a manual payment can be canceled, and then never captured', async () => {
  const { send } = startLab()
  const created = await send('sk_test_lumen', '/v1/payments', {
    ...sale,
    captureMode: 'manual',
  })
  const canceled = await send(
    'sk_test_lumen',
    `/v1/payments/${created.body.id}/cancel`,
    {}
  )
  assert.equal(canceled.body.status, 'canceled')
  const captured = await send(
    'sk_test_lumen',
    `/v1/payments/${created.body.id}/capture`,
    {}
  )
  assert.equal(captured.body.error.code, 'payment_unexpected_state')
})

test('capturing more than authorized fails', async () => {
  const { send } = startLab()
  const response = await send(
    'sk_test_harbour',
    '/v1/payments/pay_0001/capture',
    {
      amountToCapture: 99999,
    }
  )
  assert.equal(response.body.error.code, 'amount_too_large')
  assert.equal(response.body.error.param, 'amountToCapture')
})

test('refunds are partial or full, never more than captured', async () => {
  const { send } = startLab()
  // The seed already refunded 900 of pay_0003's 2400.
  const tooMuch = await send('sk_test_lumen', '/v1/refunds', {
    payment: 'pay_0003',
    amount: 2000,
  })
  assert.equal(tooMuch.body.error.code, 'amount_too_large')

  const rest = await send('sk_test_lumen', '/v1/refunds', {
    payment: 'pay_0003',
  })
  assert.equal(rest.body.amount, 1500)
  assert.equal(rest.body.object, 'refund')
  const payment = await send('sk_test_lumen', '/v1/payments/pay_0003')
  assert.equal(payment.body.amountRefunded, 2400)

  const none = await send('sk_test_lumen', '/v1/refunds', {
    payment: 'pay_0003',
  })
  assert.equal(none.body.error.code, 'payment_already_refunded')
  const fetched = await send('sk_test_lumen', `/v1/refunds/${rest.body.id}`)
  assert.equal(fetched.body.amount, 1500)
})

test('an uncaptured payment cannot be refunded', async () => {
  const { send } = startLab()
  const response = await send('sk_test_harbour', '/v1/refunds', {
    payment: 'pay_0001',
  })
  assert.equal(response.body.error.code, 'payment_unexpected_state')
})

test('validation errors carry stable codes and the parameter', async () => {
  const { send } = startLab()
  const cases: [unknown, string, string | undefined][] = [
    [
      { currency: 'eur', paymentMethod: 'pm_card_visa' },
      'parameter_missing',
      'amount',
    ],
    [{ ...sale, amount: '24' }, 'parameter_invalid', 'amount'],
    [{ ...sale, currency: 'jpy' }, 'currency_not_supported', 'currency'],
    [{ ...sale, amount: 10 }, 'amount_too_small', 'amount'],
    [
      { ...sale, paymentMethod: 'pm_card_declined' },
      'card_declined',
      undefined,
    ],
    [
      { ...sale, paymentMethod: 'pm_card_unknown' },
      'resource_missing',
      'paymentMethod',
    ],
  ]
  for (const [body, code, param] of cases) {
    const response = await send('sk_test_lumen', '/v1/payments', body)
    assert.equal(response.body.error.code, code, JSON.stringify(body))
    assert.equal(response.body.error.param, param)
  }
  const declined = await send('sk_test_lumen', '/v1/payments', {
    ...sale,
    paymentMethod: 'pm_card_declined',
  })
  assert.equal(declined.status, 402)
})

test('a body that is not JSON is rejected', async () => {
  const { lab } = startLab()
  const response = await lab.request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: 'Bearer sk_test_lumen' },
    body: '{amount: 1',
  })
  assert.equal((await response.json()).error.code, 'parameter_invalid')
})
