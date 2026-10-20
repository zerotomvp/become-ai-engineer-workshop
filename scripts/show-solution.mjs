// Opens the suggested solution for one phase, its incremental patch, in
// diff2html in the browser: only what the phase asks you to write, without
// the next phase's starting point.
// Run it with `pnpm show-solution PHASE`, for example `pnpm show-solution 3`.
// Extra arguments go to diff2html, for example `-s line` for one column.
// show-solution.html is diff2html's page with long lines that wrap.
import { fileURLToPath } from 'node:url'
import {
  checkForUpdate,
  findPhase,
  loadManifest,
  run,
  verifiedPatch,
} from './patches.mjs'

const [name, ...options] = process.argv.slice(2)
const manifest = loadManifest()
await checkForUpdate(manifest)
const phase = findPhase(manifest, name)
if (!phase.incremental) {
  // Not an error: some phases, such as phase 0, ask for no code. Point at
  // the next phase that has a solution.
  const next = manifest.phases
    .slice(manifest.phases.indexOf(phase) + 1)
    .find(later => later.incremental)
  console.log(
    `${phase.id} has no code to write, so it has no solution to show.` +
      (next ? `\nTry \`pnpm show-solution ${next.id}\`.` : '')
  )
  process.exit(0)
}

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
    '--hwt',
    fileURLToPath(new URL('show-solution.html', import.meta.url)),
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
