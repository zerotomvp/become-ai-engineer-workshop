import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import spawn from 'cross-spawn'

if (process.argv.includes('--help') || !process.argv[2]) {
  console.error(
    'Usage: node scripts/verify-release.mjs EXTRACTED_BUNDLE [PUBLIC_REMOTE]'
  )
  console.error(
    'Verifies every checksum, each phase end and each solution in fresh clones.'
  )
  process.exit(process.argv.includes('--help') ? 0 : 1)
}
const bundle = resolve(process.argv[2])
const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'))
assert.equal(manifest.schemaVersion, 1)
assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
assert.match(manifest.publicBase.commit, /^[a-f0-9]{40,64}$/)
assert.equal(manifest.phases[0].id, 'phase-0')
assert.equal(
  new Set(manifest.phases.map(phase => phase.id)).size,
  manifest.phases.length
)
const remote = process.argv[3] || manifest.publicBase.remote
const run = (command, args, cwd) => {
  const result = spawn.sync(command, args, { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message || result.stderr}`
    )
  }
  return result.stdout.trim()
}
function patchPath(patch) {
  assert.match(
    patch.path,
    /^patches\/(phase-[0-6]|ext-[1-9]\d*)\.(cumulative|incremental)\.patch$/
  )
  assert.match(patch.sha256, /^[a-f0-9]{64}$/)
  const path = join(bundle, patch.path)
  assert.equal(
    createHash('sha256').update(readFileSync(path)).digest('hex'),
    patch.sha256,
    `Checksum: ${patch.path}`
  )
  return path
}
// Check the complete manifest before creating clones or executing phase checks.
for (const phase of manifest.phases) {
  assert.match(phase.id, /^phase-[0-6]$|^ext-[1-9]\d*$/)
  assert.match(phase.tree, /^[a-f0-9]{40,64}$/)
  assert(Array.isArray(phase.check) && phase.check.length)
  assert(phase.check.every(part => typeof part === 'string' && part.length))
  // Phase 0 is a patch on the public base, like every other phase.
  if (phase.id === 'phase-0') {
    assert.equal(phase.incrementalFrom, null)
  } else {
    assert.equal(
      phase.incrementalFrom,
      phase.id.startsWith('ext-')
        ? 'phase-6'
        : `phase-${Number(phase.id.slice(6)) - 1}`
    )
    assert(manifest.phases.some(parent => parent.id === phase.incrementalFrom))
  }
  patchPath(phase.cumulative)
  if (phase.incremental) {
    patchPath(phase.incremental)
    assert.match(phase.solution.tree, /^[a-f0-9]{40,64}$/)
  } else {
    // A core phase with no code to write, such as phase 0, has no solution
    // patch.
    assert.match(phase.id, /^phase-\d$/)
    assert.equal(phase.solution, null)
  }
}
mkdirSync('scratchpad', { recursive: true })
const work = mkdtempSync(join(resolve('scratchpad'), 'verify-release-'))
try {
  // The public base itself, then each phase's end and its solution: the
  // incremental patch on the previous phase's end.
  const base = {
    id: 'base',
    tree: manifest.publicBase.tree,
    check: manifest.phases[0].check,
  }
  for (const phase of [base, ...manifest.phases]) {
    for (const mode of phase === base
      ? ['base']
      : phase.incremental
        ? ['cumulative', 'incremental']
        : ['cumulative']) {
      const clone = join(work, `${phase.id}-${mode}`)
      run('git', [
        '-c',
        'core.autocrlf=true',
        'clone',
        '--quiet',
        '--',
        remote,
        clone,
      ])
      run('git', ['checkout', '--quiet', manifest.publicBase.commit], clone)
      const apply = patch => {
        const path = patchPath(patch)
        run(
          'git',
          ['apply', '--check', '--index', '--allow-empty', path],
          clone
        )
        run('git', ['apply', '--index', '--allow-empty', path], clone)
      }
      if (mode === 'incremental' && phase.incrementalFrom) {
        apply(
          manifest.phases.find(parent => parent.id === phase.incrementalFrom)
            .cumulative
        )
      }
      if (mode !== 'base') apply(phase[mode])
      assert.equal(
        run('git', ['write-tree'], clone),
        mode === 'incremental' ? phase.solution.tree : phase.tree
      )
      run('pnpm', ['install', '--frozen-lockfile'], clone)
      run(phase.check[0], phase.check.slice(1), clone)
      run('git', ['diff', '--exit-code'], clone)
      assert.equal(
        run('git', ['ls-files', '--others', '--exclude-standard'], clone),
        ''
      )
      console.log(`${phase.id} ${mode}: passed`)
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
