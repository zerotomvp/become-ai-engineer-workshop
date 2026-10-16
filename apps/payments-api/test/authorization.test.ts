import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deposit, startLab } from './helpers.ts'

test('an unknown or missing key is rejected', async () => {
  const { lab, send } = startLab()
  const unknown = await send('sk_test_nobody', '/v1/payments/pay_0001')
  assert.equal(unknown.status, 401)
  assert.equal(unknown.body.error.code, 'invalid_api_key')
  const missing = await lab.request('/v1/payments/pay_0001')
  assert.equal(missing.status, 401)
})

test('a key sent without the Bearer scheme is rejected', async () => {
  const { lab } = startLab()
  const response = await lab.request('/v1/payments/pay_0001', {
    headers: { Authorization: 'sk_test_harbour' },
  })
  assert.equal(response.status, 401)
})

test('a restricted key can only do what it was granted', async () => {
  const { send } = startLab()
  const read = await send('rk_test_harbour_reports', '/v1/payments/pay_0001')
  assert.equal(read.status, 200)
  const capture = await send(
    'rk_test_harbour_reports',
    '/v1/payments/pay_0001/capture',
    {}
  )
  assert.equal(capture.status, 403)
  assert.equal(capture.body.error.code, 'permission_denied')
})

test('live keys need an account enabled for live mode', async () => {
  const { send } = startLab()
  const response = await send('sk_live_lumen', '/v1/payments', deposit)
  assert.equal(response.status, 403)
  assert.equal(response.body.error.code, 'live_mode_not_enabled')
})

test('test and live objects, and accounts, are kept apart', async () => {
  const { send } = startLab()
  const live = await send('sk_live_harbour', '/v1/payments', {
    ...deposit,
    capture: false,
  })
  assert.equal(live.body.livemode, true)

  const fromTest = await send('sk_test_harbour', `/v1/payments/${live.body.id}`)
  assert.equal(fromTest.body.error.code, 'resource_missing')
  const fromOtherAccount = await send('sk_test_lumen', '/v1/payments/pay_0001')
  assert.equal(fromOtherAccount.body.error.code, 'resource_missing')
})
