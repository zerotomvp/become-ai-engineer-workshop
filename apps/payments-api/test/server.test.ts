import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'

test('the server answers over HTTP', async t => {
  const port = '4299'
  const server = spawn(process.execPath, ['src/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PAYMENTS_API_PORT: port },
  })
  t.after(() => server.kill())
  await once(server.stdout, 'data')

  const response = await fetch(
    `http://localhost:${port}/v1/payments/pay_0001`,
    {
      headers: { Authorization: 'Bearer sk_test_harbour' },
    }
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).capture, false)
})
