import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDoc } from '../src/docs.ts'
import { deposit, startLab } from './helpers.ts'

// Harbour Hotels is pinned to 2025-03 and requires manual capture;
// Lumen Books is pinned to 2025-09.

test('a 2025-03 payment without a capture setting fails on a manual-capture account', async () => {
  const { send } = startLab()
  const response = await send('sk_test_harbour', '/v1/payments', deposit)
  assert.equal(response.status, 400)
  assert.equal(response.body.error.code, 'manual_capture_setting_missing')
  assert.equal(response.headers.get('Api-Version'), '2025-03')
})

test('2025-03 rejects the 2025-09 captureMode parameter', async () => {
  const { send } = startLab()
  const response = await send('sk_test_harbour', '/v1/payments', {
    ...deposit,
    captureMode: 'manual',
  })
  assert.equal(response.status, 400)
  assert.equal(response.body.error.code, 'unknown_parameter')
  assert.equal(response.body.error.param, 'captureMode')
})

test('2025-03 takes capture: false for manual capture', async () => {
  const { send } = startLab()
  const response = await send('sk_test_harbour', '/v1/payments', {
    ...deposit,
    capture: false,
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'requires_capture')
  assert.equal(response.body.capture, false)
  assert.equal('captureMode' in response.body, false)
})

test('2025-09 takes captureMode: "manual" and rejects capture', async () => {
  const { send } = startLab()
  const manual = await send('sk_test_lumen', '/v1/payments', {
    ...deposit,
    captureMode: 'manual',
  })
  assert.equal(manual.body.status, 'requires_capture')
  assert.equal(manual.body.captureMode, 'manual')
  assert.equal(manual.headers.get('Api-Version'), '2025-09')

  const legacy = await send('sk_test_lumen', '/v1/payments', {
    ...deposit,
    capture: false,
  })
  assert.equal(legacy.body.error.code, 'unknown_parameter')
  assert.equal(legacy.body.error.param, 'capture')
})

test('each version documents its own capture parameter', () => {
  assert.match(readDoc('2025-03', 'payments')!, /`capture` to `false`/)
  assert.doesNotMatch(readDoc('2025-03', 'payments')!, /captureMode/)
  assert.match(readDoc('2025-09', 'payments')!, /`captureMode` to `"manual"`/)
  assert.equal(readDoc('2025-09', 'secrets'), undefined)
})

test('docs are served per version, with error links into them', async () => {
  const { lab, send } = startLab()
  const doc = await lab.request('/docs/2025-03/payments')
  assert.match(doc.headers.get('Content-Type')!, /text\/markdown/)
  assert.match(await doc.text(), /version 2025-03/)
  assert.equal((await lab.request('/docs/2024-01/payments')).status, 404)

  const failed = await send('sk_test_harbour', '/v1/payments', deposit)
  assert.equal(
    failed.body.error.docUrl,
    '/docs/2025-03/errors#manual_capture_setting_missing'
  )
})
