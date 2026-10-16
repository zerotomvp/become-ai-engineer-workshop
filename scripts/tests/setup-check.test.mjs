import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('setup check fails, and says what to do, without a model key', () => {
  const env = { ...process.env }
  delete env.OPENROUTER_API_KEY
  const result = spawnSync(process.execPath, ['scripts/setup-check.mjs'], {
    env,
    encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stdout, /ok {4}Node\.js 22\.18 or later/)
  assert.match(result.stdout, /ok {4}Seeded request log: \d+ failed requests/)
  assert.match(
    result.stdout,
    /FAIL {2}OpenRouter access: .*copy \.env\.example/
  )
})
