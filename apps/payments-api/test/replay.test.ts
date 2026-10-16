import assert from 'node:assert/strict'
import { test } from 'node:test'
import { replay } from '../src/replay.ts'
import { deposit, loadSeed, startLab } from './helpers.ts'

const incident = {
  method: 'POST',
  path: '/v1/payments',
  headers: { Authorization: 'Bearer sk_test_harbour' },
} as const

test('replay judges a correction against the account pinned version', async () => {
  const seed = loadSeed()
  const latestDocsFix = await replay(seed, {
    ...incident,
    body: { ...deposit, captureMode: 'manual' },
  })
  assert.equal(latestDocsFix.apiVersion, '2025-03')
  assert.equal(latestDocsFix.body.error.code, 'unknown_parameter')

  const pinnedVersionFix = await replay(seed, {
    ...incident,
    body: { ...deposit, capture: false },
  })
  assert.equal(pinnedVersionFix.status, 200)
  assert.equal(pinnedVersionFix.body.status, 'requires_capture')
})

test('identical replays give identical results', async () => {
  const seed = loadSeed()
  const request = { ...incident, body: { ...deposit, capture: false } }
  assert.deepEqual(await replay(seed, request), await replay(seed, request))
})

test('replay never changes the seed or the shared state', async () => {
  const seed = loadSeed()
  const before = JSON.stringify(seed)
  await replay(seed, {
    method: 'POST',
    path: '/v1/payments/pay_0001/capture',
    headers: { Authorization: 'Bearer sk_test_harbour' },
    body: {},
  })
  assert.equal(JSON.stringify(seed), before)

  const { lab, send } = startLab()
  const replayed = await lab.request('/lab/replay', {
    method: 'POST',
    body: JSON.stringify({
      ...incident,
      path: '/v1/payments/pay_0001/capture',
      body: {},
    }),
  })
  assert.equal((await replayed.json()).body.status, 'succeeded')
  const shared = await send('sk_test_harbour', '/v1/payments/pay_0001')
  assert.equal(shared.body.status, 'requires_capture')
})

test('replay starts from the seed even after the shared state moved on', async () => {
  const { lab, send } = startLab()
  await send('sk_test_harbour', '/v1/payments/pay_0001/capture', {})
  const response = await lab.request('/lab/replay', {
    method: 'POST',
    body: JSON.stringify({
      ...incident,
      path: '/v1/payments/pay_0001/capture',
      body: {},
    }),
  })
  assert.equal((await response.json()).status, 200)
})

test('reset puts the shared state back to the seed', async () => {
  const { lab, send } = startLab()
  await send('sk_test_harbour', '/v1/payments/pay_0001/capture', {})
  await lab.request('/lab/reset', { method: 'POST' })
  const payment = await send('sk_test_harbour', '/v1/payments/pay_0001')
  assert.equal(payment.body.status, 'requires_capture')
})

test('replay rejects requests outside the API', async () => {
  const { lab } = startLab()
  const response = await lab.request('/lab/replay', {
    method: 'POST',
    body: JSON.stringify({ method: 'POST', path: '/lab/reset' }),
  })
  assert.equal(response.status, 400)
})
