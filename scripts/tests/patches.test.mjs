import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

mkdirSync('scratchpad', { recursive: true })
const work = mkdtempSync(join(resolve('scratchpad'), 'patches-test-'))
test.after(() => rmSync(work, { recursive: true, force: true }))

const git = (cwd, ...args) => {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args],
    { cwd, encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
const sha256 = text => createHash('sha256').update(text).digest('hex')

// A public base, phase 0 and phase 1 on top, and the zip the attendee page
// serves. Phase 0 is a patch too: it brings phase 1's starting point.
const source = join(work, 'source')
mkdirSync(source)
git(source, 'init', '--quiet', '--initial-branch=main')
writeFileSync(join(source, '.gitignore'), 'node_modules/\n')
writeFileSync(join(source, 'lab.txt'), 'fragile\n')
git(source, 'add', '.')
git(source, 'commit', '--quiet', '-m', 'base')
const base = git(source, 'rev-parse', 'HEAD')
const baseTree = git(source, 'rev-parse', 'HEAD^{tree}')
writeFileSync(join(source, 'contract.txt'), 'implement four outcomes\n')
git(source, 'add', '.')
git(source, 'commit', '--quiet', '-m', 'phase 0')
const phase0 = git(source, 'rev-parse', 'HEAD')
const phase0Tree = git(source, 'rev-parse', 'HEAD^{tree}')
writeFileSync(join(source, 'lab.txt'), 'typed\n')
writeFileSync(join(source, 'contract.txt'), 'four outcomes\n')
git(source, 'add', '.')
git(source, 'commit', '--quiet', '-m', 'phase 1')
const phase1Tree = git(source, 'rev-parse', 'HEAD^{tree}')
const diff = from => `${git(source, 'diff', '--binary', from, 'HEAD')}\n`
const patch = diff(base)
const phase1Incremental = diff(phase0)
git(source, 'reset', '--hard', '--quiet', 'HEAD~1')
const phase0Patch = diff(base)
git(source, 'reset', '--hard', '--quiet', base)

const entry = {
  path: 'patches/phase-1.cumulative.patch',
  sha256: sha256(patch),
}
const phase0Entry = {
  path: 'patches/phase-0.cumulative.patch',
  sha256: sha256(phase0Patch),
}
const manifest = {
  schemaVersion: 1,
  slug: 'become-ai-engineer',
  version: '1.0.0',
  publicBase: { commit: base, tree: baseTree, remote: source },
  phases: [
    {
      id: 'phase-0',
      title: 'The lab',
      tree: phase0Tree,
      incrementalFrom: null,
      cumulative: phase0Entry,
      incremental: {
        ...phase0Entry,
        path: 'patches/phase-0.incremental.patch',
      },
    },
    {
      id: 'phase-1',
      title: 'The contract',
      tree: phase1Tree,
      incrementalFrom: 'phase-0',
      cumulative: entry,
      incremental: {
        path: 'patches/phase-1.incremental.patch',
        sha256: sha256(phase1Incremental),
      },
    },
  ],
}
const files = {
  'manifest.json': JSON.stringify(manifest),
  'patches/phase-0.cumulative.patch': phase0Patch,
  'patches/phase-0.incremental.patch': phase0Patch,
  'patches/phase-1.cumulative.patch': patch,
  'patches/phase-1.incremental.patch': phase1Incremental,
}
const goodZip = join(work, 'patches.zip')
writeFileSync(goodZip, zip(files))
const damagedZip = join(work, 'damaged.zip')
writeFileSync(
  damagedZip,
  zip({ ...files, 'patches/phase-1.cumulative.patch': 'tampered' })
)

const home = join(work, 'home')
const offline = 'http://127.0.0.1:9/version.json'
function script(
  name,
  args,
  { cwd = source, input = '', versionUrl = offline } = {}
) {
  return new Promise(done => {
    const child = execFile(
      process.execPath,
      [resolve('scripts', `${name}.mjs`), ...args],
      {
        cwd,
        env: {
          ...process.env,
          ZEROTOMVP_HOME: home,
          ZEROTOMVP_VERSION_URL: versionUrl,
        },
      },
      (error, stdout, stderr) =>
        done({ status: error?.code ?? 0, stdout, stderr })
    )
    child.stdin.end(input)
  })
}
function attendeeClone(name) {
  const clone = join(work, name)
  git(work, 'clone', '--quiet', source, clone)
  mkdirSync(join(clone, 'node_modules'))
  return clone
}

test('scripts say where to download the patches before any import', async () => {
  const result = await script('time-travel', ['1'])
  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /No workshop patches found.*\n.*attendee page.*pnpm import-patches/
  )
})

test('import rejects a zip whose patch does not match its checksum', async () => {
  const result = await script('import-patches', [damagedZip])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /damaged: patches\/phase-1\.cumulative\.patch/)
  assert(!existsSync(join(home, 'become-ai-engineer')))
})

test('import puts the verified patches in the home folder', async () => {
  const result = await script('import-patches', [goodZip])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Imported workshop patches 1\.0\.0/)
  const imported = join(home, 'become-ai-engineer')
  assert.equal(readFileSync(join(imported, entry.path), 'utf8'), patch)
  assert.equal(result.stderr, '', 'offline, the version check stays silent')
})

test('an unknown phase lists the phases', async () => {
  const result = await script('time-travel', ['9'])
  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /Unknown phase 9.*\n {2}phase-0 +The lab\n {2}phase-1 +The contract/
  )
})

test('time travel moves an untouched clone between phases without asking', async () => {
  const clone = attendeeClone('untouched')
  const forward = await script('time-travel', ['1'], { cwd: clone })
  assert.equal(forward.status, 0, forward.stderr)
  assert.equal(git(clone, 'rev-parse', 'HEAD^{tree}'), phase1Tree)
  assert.equal(git(clone, 'status', '--porcelain'), '')
  assert.match(forward.stdout, /now at the end of phase-1: The contract/)
  const back = await script('time-travel', ['phase-0'], { cwd: clone })
  assert.equal(back.status, 0, back.stderr)
  assert.equal(git(clone, 'rev-parse', 'HEAD^{tree}'), phase0Tree)
})

test('time travel treats a fresh clone of the base as untouched', async () => {
  const clone = attendeeClone('fresh')
  const result = await script('time-travel', ['0'], { cwd: clone })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout, /replaces your changes/)
  assert.equal(git(clone, 'rev-parse', 'HEAD^{tree}'), phase0Tree)
  assert.equal(git(clone, 'branch', '--list', 'saved/*'), '')
})

test('time travel keeps changes when the attendee declines', async () => {
  const clone = attendeeClone('declined')
  writeFileSync(join(clone, 'lab.txt'), 'my attempt\n')
  const result = await script('time-travel', ['1'], {
    cwd: clone,
    input: 'n\n',
  })
  assert.equal(result.status, 1)
  assert.match(result.stdout, /replaces your changes.*\n {2} M lab\.txt/)
  assert.match(result.stderr, /Nothing changed/)
  assert.equal(readFileSync(join(clone, 'lab.txt'), 'utf8'), 'my attempt\n')
})

test('time travel saves commits and changes once the attendee confirms', async () => {
  const clone = attendeeClone('confirmed')
  writeFileSync(join(clone, 'lab.txt'), 'committed attempt\n')
  git(clone, 'commit', '--quiet', '-am', 'my work')
  const mine = git(clone, 'rev-parse', 'HEAD')
  writeFileSync(join(clone, 'notes.txt'), 'untracked\n')
  const result = await script('time-travel', ['1'], {
    cwd: clone,
    input: 'y\n',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(
    result.stdout,
    /commits that are not the end of a workshop phase/
  )
  assert.equal(git(clone, 'rev-parse', 'HEAD^{tree}'), phase1Tree)
  const branch = result.stdout.match(/branch (saved\/\d+)/)[1]
  assert.equal(git(clone, 'rev-parse', branch), mine)
  assert.match(git(clone, 'stash', 'list'), /Before time travel to phase-1/)
  assert(!existsSync(join(clone, 'notes.txt')))
})

test('time travel and show solution refuse a damaged patch', async () => {
  const imported = join(home, 'become-ai-engineer', 'patches')
  for (const [name, kind] of [
    ['time-travel', 'cumulative'],
    ['show-solution', 'incremental'],
  ]) {
    const path = join(imported, `phase-1.${kind}.patch`)
    const original = readFileSync(path)
    writeFileSync(path, 'tampered')
    const result = await script(name, ['1'])
    writeFileSync(path, original)
    assert.equal(result.status, 1, `${name}: ${result.stdout}`)
    assert.match(result.stderr, /missing or damaged.*\n.*attendee page/)
  }
})

test('online, scripts ask for a re-download when newer patches exist', async () => {
  const server = createServer((request, response) =>
    response.end(
      JSON.stringify({
        version: '1.10.0',
        publishedAt: '2026-10-20T00:00:00.000Z',
      })
    )
  )
  await new Promise(listening => server.listen(0, '127.0.0.1', listening))
  const versionUrl = `http://127.0.0.1:${server.address().port}/version.json`
  const result = await script('time-travel', ['9'], { versionUrl })
  server.close()
  assert.match(
    result.stderr,
    /Newer workshop patches are available: 1\.10\.0 \(you have 1\.0\.0\)/
  )
})

// Writes a zip with deflated entries, as the publisher's zip does.
function zip(entries) {
  const records = []
  const directory = []
  let offset = 0
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text)
    const packed = deflateRawSync(data)
    const path = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc32(data), 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(path.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc32(data), 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(path.length, 28)
    central.writeUInt32LE(offset, 42)
    records.push(local, path, packed)
    directory.push(central, path)
    offset += local.length + path.length + packed.length
  }
  const size = directory.reduce((total, part) => total + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(directory.length / 2, 8)
  end.writeUInt16LE(directory.length / 2, 10)
  end.writeUInt32LE(size, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...records, ...directory, end])
}
