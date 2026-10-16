// Imports the patch zip from the attendee page into ~/.zerotomvp/<slug>/.
// Run it with `pnpm import-patches PATH_TO_ZIP`.
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  checkForUpdate,
  download,
  fail,
  patchesDir,
  sha256,
  slug,
  unzip,
} from './patches.mjs'

const zipPath = process.argv[2]
if (!zipPath) fail(`Usage: pnpm import-patches PATH_TO_ZIP\n${download}`)

let files
try {
  files = unzip(readFileSync(resolve(zipPath)))
} catch (error) {
  fail(`Cannot read ${zipPath}: ${error.message}.\n${download}`)
}
const manifest = JSON.parse(files.get('manifest.json') ?? 'null')
if (manifest?.slug !== slug)
  fail(`${zipPath} is not the ${slug} patch zip.\n${download}`)

// Only the patches the manifest lists, with matching checksums, are imported.
const patches = manifest.phases.flatMap(phase =>
  [phase.cumulative, phase.incremental].filter(Boolean)
)
for (const patch of patches) {
  const bytes = files.get(patch.path)
  if (
    !/^patches\/[\w.-]+\.patch$/.test(patch.path) ||
    !bytes ||
    sha256(bytes) !== patch.sha256
  ) {
    fail(
      `${zipPath} is damaged: ${patch.path} does not match its checksum.\n${download}`
    )
  }
}

// Write a complete copy beside the old one, then swap it in.
const incoming = `${patchesDir}.importing`
rmSync(incoming, { recursive: true, force: true })
for (const path of ['manifest.json', ...patches.map(patch => patch.path)]) {
  mkdirSync(dirname(join(incoming, path)), { recursive: true })
  writeFileSync(join(incoming, path), files.get(path))
}
rmSync(patchesDir, { recursive: true, force: true })
renameSync(incoming, patchesDir)

console.log(`Imported workshop patches ${manifest.version} into ${patchesDir}:`)
for (const phase of manifest.phases)
  console.log(`  ${phase.id.padEnd(8)} ${phase.title}`)
await checkForUpdate(manifest)
