import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deposit, startLab } from './helpers.ts'

test('the seeded log holds the version-mismatch incident', async () => {
  const { lab } = startLab()
  const failed = await (await lab.request('/lab/requests?status=failed')).json()
  const incident = failed.data.find(
    (request: any) =>
      request.response.error.code === 'manual_capture_setting_missing'
  )
  assert.equal(incident.account, 'acct_harbour')
  assert.equal(incident.apiVersion, '2025-03')
  assert.equal(incident.mode, 'test')
  assert.equal(incident.headers.authorization, 'Bearer sk_test_harbour')
})

test('every API request is logged under its Request-Id', async () => {
  const { lab, send } = startLab()
  const response = await send('sk_test_lumen', '/v1/payments', {
    ...deposit,
    capture: true,
  })
  const id = response.headers.get('Request-Id')!
  const logged = await (await lab.request(`/lab/requests/${id}`)).json()
  assert.equal(logged.status, 400)
  assert.equal(logged.apiVersion, '2025-09')
  assert.deepEqual(logged.body, { ...deposit, capture: true })
  assert.deepEqual(logged.response, response.body)

  const lumen = await (
    await lab.request('/lab/requests?account=acct_lumen')
  ).json()
  assert.equal(lumen.data[0].id, id, 'newest first')
  assert.equal((await lab.request('/lab/requests/req_9999')).status, 404)
})
