import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

test('setup check skips a workspace folder that holds only ignored files', () => {
  // Time travel back from a later phase can leave its folders behind, with
  // nothing but an ignored node_modules in them.
  mkdirSync('scratchpad', { recursive: true })
  const clone = mkdtempSync(join(resolve('scratchpad'), 'setup-check-test-'))
  try {
    const fixtures = join('apps', 'payments-api', 'fixtures')
    cpSync(fixtures, join(clone, fixtures), { recursive: true })
    writeFileSync(join(clone, 'apps', 'payments-api', 'package.json'), '{}')
    mkdirSync(join(clone, 'apps', 'evals', 'node_modules', 'dep'), {
      recursive: true,
    })
    const result = spawnSync(
      process.execPath,
      [resolve('scripts', 'setup-check.mjs')],
      { cwd: clone, encoding: 'utf8' }
    )
    assert.match(result.stdout, /ok {4}Dependencies installed: all apps/)
  } finally {
    rmSync(clone, { recursive: true, force: true })
  }
})
