import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deposit, startLab } from './helpers.ts'

const payment = { ...deposit, captureMode: 'manual' }

test('a retry with the same key returns the original payment', async () => {
  const { send } = startLab()
  const headers = { 'Idempotency-Key': 'order-77' }
  const first = await send('sk_test_lumen', '/v1/payments', payment, headers)
  const retry = await send('sk_test_lumen', '/v1/payments', payment, headers)
  assert.deepEqual(retry.body, first.body)
  assert.equal(retry.headers.get('Idempotent-Replayed'), 'true')

  const other = await send('sk_test_lumen', '/v1/payments', payment, {
    'Idempotency-Key': 'order-78',
  })
  assert.notEqual(other.body.id, first.body.id)
})

test('reusing a key with a different body fails', async () => {
  const { send } = startLab()
  const headers = { 'Idempotency-Key': 'order-77' }
  await send('sk_test_lumen', '/v1/payments', payment, headers)
  const changed = await send(
    'sk_test_lumen',
    '/v1/payments',
    { ...payment, amount: 1 },
    headers
  )
  assert.equal(changed.body.error.code, 'idempotency_key_reused')
})

test('keys are scoped to the account', async () => {
  const { send } = startLab()
  // Harbour's seeded booking used this key; Lumen may use it too.
  const response = await send('sk_test_lumen', '/v1/payments', payment, {
    'Idempotency-Key': 'booking-HB-1042',
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Idempotent-Replayed'), null)
})

test('a request rejected as invalid can be corrected and retried with the same key', async () => {
  const { send } = startLab()
  // The seeded incident used this key and failed validation.
  const corrected = await send(
    'sk_test_harbour',
    '/v1/payments',
    { ...deposit, capture: false },
    { 'Idempotency-Key': 'booking-HB-1044' }
  )
  assert.equal(corrected.status, 200)
})

test('a declined payment is saved like a success', async () => {
  const { send } = startLab()
  const headers = { 'Idempotency-Key': 'order-79' }
  const declined = { ...payment, paymentMethod: 'pm_card_declined' }
  await send('sk_test_lumen', '/v1/payments', declined, headers)
  const retry = await send('sk_test_lumen', '/v1/payments', declined, headers)
  assert.equal(retry.headers.get('Idempotent-Replayed'), 'true')
})
