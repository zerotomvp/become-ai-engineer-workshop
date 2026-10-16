import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const [major, minor] = process.versions.node.split('.').map(Number)
assert(major > 22 || (major === 22 && minor >= 18), 'Use Node.js 22.18+')
for (const path of [
  'apps',
  'packages',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
]) {
  assert(existsSync(path), `Missing ${path}`)
}
assert.equal(JSON.parse(readFileSync('.prettierrc', 'utf8')).semi, false)
console.log('Workspace ready.')
