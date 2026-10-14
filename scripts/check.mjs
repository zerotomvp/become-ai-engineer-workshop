import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

assert(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node.js 22+')
for (const path of [
  'apps',
  'packages',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
]) {
  assert(existsSync(path), `Missing ${path}`)
}
assert.equal(JSON.parse(readFileSync('.prettierrc', 'utf8')).semi, false)
console.log(
  'Workspace scaffold ready. The workshop application is not built yet.'
)
