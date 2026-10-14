import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as prettier from 'prettier'

const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 })
const zero = /^0+$/
const commits = new Set()
const refs = process.argv.includes('--head')
  ? [
      `HEAD ${git(['rev-parse', 'HEAD']).toString().trim()} unused ${'0'.repeat(40)}`,
    ]
  : readFileSync(0, 'utf8').trim().split('\n').filter(Boolean)

for (const line of refs) {
  const [, local, , remote] = line.split(/\s+/)
  if (!local || zero.test(local)) continue
  const range = [local]
  if (remote && !zero.test(remote)) range.push(`^${remote}`)
  for (const sha of git(['rev-list', ...range])
    .toString()
    .trim()
    .split('\n')) {
    if (sha) commits.add(sha)
  }
}

let failed = false
for (const sha of commits) {
  const options = JSON.parse(git(['show', `${sha}:.prettierrc`]).toString())
  const paths = git(['ls-tree', '-rz', '--name-only', sha])
    .toString()
    .split('\0')
    .filter(Boolean)
  for (const path of paths) {
    if (/^(secrets|scratchpad|node_modules|dist)\//.test(path)) continue
    if (['.prettierrc', '.editorconfig', 'pnpm-lock.yaml'].includes(path))
      continue
    const info = await prettier.getFileInfo(path)
    if (!info.inferredParser) continue
    const contents = git(['show', `${sha}:${path}`]).toString()
    if (!(await prettier.check(contents, { ...options, filepath: path }))) {
      console.error(`Unformatted committed file: ${sha.slice(0, 8)}:${path}`)
      failed = true
    }
  }
}
if (failed) {
  console.error('Format the affected commits before pushing: pnpm format')
  process.exit(1)
}
