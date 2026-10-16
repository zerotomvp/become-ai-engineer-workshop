// Opens the suggested solution for one phase, its incremental patch, in
// diff2html in the browser.
// Run it with `pnpm show-solution PHASE`, for example `pnpm show-solution 3`.
// Extra arguments go to diff2html, for example `-s line` for one column.
import {
  checkForUpdate,
  fail,
  findPhase,
  loadManifest,
  run,
  verifiedPatch,
} from './patches.mjs'

const [name, ...options] = process.argv.slice(2)
const manifest = loadManifest()
await checkForUpdate(manifest)
const phase = findPhase(manifest, name)
if (!phase.incremental)
  fail(`${phase.id} is the starting point; it has no solution to show.`)

const patch = verifiedPatch(phase.incremental)
console.log(
  `Opening the ${phase.id} solution (since ${phase.incrementalFrom ?? 'the workshop base'}) in your browser...`
)
run(
  'npx',
  [
    '--yes',
    'diff2html-cli@5.2.15',
    '-s',
    'side',
    '-t',
    `${phase.id}: ${phase.title}`,
    ...options,
    '-i',
    'file',
    '--',
    patch,
  ],
  { stdio: 'inherit', env: withoutPnpmSettings(process.env) }
)

// pnpm passes its own settings as npm_config_*, which npm warns about.
function withoutPnpmSettings(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !/^npm_config_/i.test(key))
  )
}
