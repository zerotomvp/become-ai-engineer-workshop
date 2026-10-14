import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

test('formatting check rejects an unformatted outgoing commit, even with a formatted working tree', () => {
  mkdirSync('scratchpad', { recursive: true })
  const repo = mkdtempSync(join(resolve('scratchpad'), 'hook test '))
  const git = args =>
    execFileSync('git', args, { cwd: repo, stdio: 'pipe' }).toString().trim()
  try {
    git(['init', '--quiet', '-b', 'main'])
    git(['config', 'user.name', 'Workshop Test'])
    git(['config', 'user.email', 'test@example.invalid'])
    cpSync('.prettierrc', join(repo, '.prettierrc'))
    cpSync('scripts', join(repo, 'scripts'), { recursive: true })
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\nscratchpad/\n')
    git(['add', '.'])
    git(['commit', '--quiet', '-m', 'chore: prepare hook fixture'])
    const base = git(['rev-parse', 'HEAD'])
    writeFileSync(join(repo, 'example.js'), 'const value = 1\n')
    git(['add', 'example.js'])
    git(['commit', '--quiet', '-m', 'feat: add formatted example'])
    let head = git(['rev-parse', 'HEAD'])
    const hook = (local, remote) =>
      spawnSync(process.execPath, [resolve('scripts/check-push.mjs')], {
        cwd: repo,
        input: `refs/heads/main ${local} refs/heads/main ${remote}\n`,
        encoding: 'utf8',
      })
    assert.equal(hook(head, base).status, 0)
    writeFileSync(join(repo, 'example.js'), 'const value=2;\n')
    git(['add', 'example.js'])
    git(['commit', '--quiet', '-m', 'feat: add unformatted example'])
    head = git(['rev-parse', 'HEAD'])
    writeFileSync(join(repo, 'example.js'), 'const value = 2\n')
    const rejected = hook(head, base)
    assert.equal(rejected.status, 1)
    assert.match(rejected.stderr, /Unformatted committed file/)
    assert.equal(hook('0'.repeat(40), head).status, 0)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
