// Moves this clone to the end of a phase: it resets the clone to the
// workshop base and applies that phase's cumulative patch.
// Run it with `pnpm time-travel PHASE`, for example `pnpm time-travel 3`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'
import spawn from 'cross-spawn'
import {
  checkForUpdate,
  fail,
  findPhase,
  loadManifest,
  run,
  timeTravelMarker,
  verifiedPatch,
} from './patches.mjs'

const [name] = process.argv.slice(2).filter(arg => arg !== '--yes')
const manifest = loadManifest()
await checkForUpdate(manifest)
const phase = findPhase(manifest, name)
const patch = phase.cumulative && verifiedPatch(phase.cumulative)

// Stashes and time-travel commits need an author, even on a fresh machine,
// and must not wait for a signing key.
const identity = [
  '-c',
  'user.name=Workshop time travel',
  '-c',
  'user.email=time-travel@zerotomvp.dev',
  '-c',
  'commit.gpgsign=false',
]
const git = (...args) => run('git', [...identity, ...args])
process.chdir(git('rev-parse', '--show-toplevel'))

const base = manifest.publicBase.commit
const hasBase = () =>
  spawn.sync('git', ['cat-file', '-e', `${base}^{commit}`]).status === 0
if (!hasBase()) {
  console.log('Fetching the workshop base...')
  git('fetch', '--quiet', manifest.publicBase.remote)
  if (!hasBase()) fail(`This clone cannot reach the workshop base ${base}.`)
}

// Anything that is not exactly the base or a phase end state is the
// attendee's own work.
const uncommitted = git('status', '--porcelain')
const phaseTrees = [
  manifest.publicBase.tree,
  ...manifest.phases.map(phase => phase.tree),
]
const committed = !phaseTrees.includes(git('rev-parse', 'HEAD^{tree}'))
let saved
if (uncommitted || committed) {
  console.log(`Time travel to ${phase.id} replaces your changes in this clone:`)
  if (committed)
    console.log('  commits that are not the end of a workshop phase')
  if (uncommitted) console.log(uncommitted.replace(/^/gm, '  '))
  console.log(
    'It saves them first: commits on a branch, other changes in the Git stash.'
  )
  if (!process.argv.includes('--yes') && !(await confirm('Continue? [y/N] '))) {
    fail('Nothing changed.')
  }
  if (uncommitted) {
    git(
      'stash',
      'push',
      '--include-untracked',
      '--message',
      `Before time travel to ${phase.id}`
    )
  }
  if (committed) {
    saved = `saved/${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
    git('branch', saved)
  }
}

const lockfile = () =>
  existsSync('pnpm-lock.yaml') ? readFileSync('pnpm-lock.yaml', 'utf8') : ''
const lockfileBefore = lockfile()
git('reset', '--hard', '--quiet', base)
if (patch) {
  git('apply', '--index', patch)
  git(
    'commit',
    '--quiet',
    '--no-verify',
    '--message',
    `Time travel to ${phase.id}: ${phase.title}`
  )
}
if (lockfile() !== lockfileBefore || !existsSync('node_modules')) {
  run('pnpm', ['install', '--frozen-lockfile'], { stdio: 'inherit' })
}

// Last, once the code and dependencies are in place: a running `pnpm dev`
// sees the marker change and restarts the lab.
const marker = timeTravelMarker(process.cwd())
mkdirSync(dirname(marker), { recursive: true })
writeFileSync(marker, `${phase.id}\n`)

console.log(`\nThis clone is now at the end of ${phase.id}: ${phase.title}.`)
console.log('If `pnpm dev` is running, it restarts the lab on its own.')
if (uncommitted)
  console.log(
    'Your uncommitted changes are in the stash: git stash pop brings them back.'
  )
if (saved)
  console.log(
    `Your commits are on branch ${saved}: git diff ${saved} compares them.`
  )

async function confirm(question) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const closed = new Promise(resolve => prompt.once('close', () => resolve('')))
  const answer = await Promise.race([prompt.question(question), closed])
  prompt.close()
  return /^y(es)?$/i.test(answer.trim())
}
