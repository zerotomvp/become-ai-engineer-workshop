import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { commandFor, discoverApps, runLab, startApp, stopApp } from '../dev.mjs'

mkdirSync('scratchpad', { recursive: true })
const work = mkdtempSync(join(resolve('scratchpad'), 'dev-test-'))
test.after(() => rmSync(work, { recursive: true, force: true }))

function write(path, text) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}
const json = value => JSON.stringify(value)

// A workspace like the lab's: two apps and a package without a dev script.
const root = join(work, 'lab')
write(
  join(root, 'pnpm-workspace.yaml'),
  'packages:\n  - apps/*\n  - packages/*\n'
)
write(
  join(root, 'apps/payments-api/package.json'),
  json({ scripts: { dev: 'node --watch src/server.ts' } })
)
write(
  join(root, 'apps/dashboard/package.json'),
  json({ scripts: { dev: 'vite' } })
)
write(
  join(root, 'apps/dashboard/node_modules/vite/package.json'),
  json({ bin: { vite: 'bin/vite.js' } })
)
write(join(root, 'packages/tracing/package.json'), json({ scripts: {} }))

test('finds every workspace app with a dev script', () => {
  assert.deepEqual(
    discoverApps(root).map(app => [app.name, app.dev]),
    [
      ['apps/dashboard', 'vite'],
      ['apps/payments-api', 'node --watch src/server.ts'],
    ]
  )
})

test('starts dev scripts without a shell in between', () => {
  const [dashboard, api] = discoverApps(root)
  assert.deepEqual(commandFor(api), {
    command: process.execPath,
    args: ['--watch', 'src/server.ts'],
  })
  assert.deepEqual(commandFor(dashboard), {
    command: process.execPath,
    args: [join(root, 'apps/dashboard/node_modules/vite/bin/vite.js')],
  })
  assert.deepEqual(commandFor({ dir: root, dev: 'tsc --watch && echo' }), {
    command: 'pnpm',
    args: ['run', 'dev'],
  })
})

// A stand-in child process.
function fakeChild(pid) {
  const child = new EventEmitter()
  Object.assign(child, {
    pid,
    exitCode: null,
    signalCode: null,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exit(code = 0) {
      child.exitCode = code
      child.emit('exit', code, null)
    },
  })
  return child
}

test('prefixes every output line with the app', async () => {
  const child = fakeChild(1)
  const lines = []
  startApp(
    { name: 'apps/explainer', dir: root, dev: 'node src/server.ts' },
    { spawnProcess: () => child, write: line => lines.push(line) }
  )
  child.stdout.write('Explainer on\nhttp://localhost:4243\npartial')
  child.stderr.end('Error\n')
  child.stdout.end()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(lines, [
    'apps/explainer dev: Explainer on\n',
    'apps/explainer dev: http://localhost:4243\n',
    'apps/explainer dev: Error\n',
    'apps/explainer dev: partial\n',
  ])
})

test('stops a whole process tree', async () => {
  const unix = fakeChild(42)
  const signals = []
  const stopped = stopApp(unix, {
    platform: 'linux',
    kill: (pid, signal) => signals.push([pid, signal]),
  })
  unix.exit()
  await stopped
  assert.deepEqual(signals, [[-42, 'SIGTERM']])

  const windows = fakeChild(7)
  const commands = []
  const done = stopApp(windows, {
    platform: 'win32',
    run: (command, args) => commands.push([command, ...args]),
  })
  windows.exit()
  await done
  assert.deepEqual(commands, [['taskkill', '/pid', '7', '/T', '/F']])
})

test('restarts every app once time travel touches the marker', async () => {
  const marker = join(work, 'marker')
  write(marker, 'phase-0\n')
  let apps = ['apps/dashboard', 'apps/payments-api']
  const events = []
  let pid = 0
  const lab = runLab({
    root,
    marker,
    interval: 60_000,
    discover: () => apps.map(name => ({ name })),
    start: app => {
      const child = fakeChild(++pid)
      events.push(`start ${app.name} ${pid}`)
      return child
    },
    stop: child => {
      events.push(`stop ${child.pid}`)
      return new Promise(resolve =>
        setTimeout(() => {
          events.push(`exited ${child.pid}`)
          child.exit()
          resolve()
        }, 10)
      )
    },
    log: message => events.push(message),
  })

  // A marker left by an earlier time travel doesn't restart anything.
  await lab.check()
  assert.deepEqual(events, [
    'start apps/dashboard 1',
    'start apps/payments-api 2',
  ])

  // Time travel to a phase with a new app: all stop, then all start again.
  apps = [...apps, 'apps/tracing-ui']
  write(marker, 'phase-5\n')
  await lab.check()
  assert.deepEqual(events.slice(2), [
    'stop 1',
    'stop 2',
    'exited 1',
    'exited 2',
    'Time travel to phase-5: restarting the lab…',
    'start apps/dashboard 3',
    'start apps/payments-api 4',
    'start apps/tracing-ui 5',
  ])
  await lab.check()
  assert.equal(events.length, 10, 'an unchanged marker restarts nothing')
  await lab.close()
  assert.deepEqual(events.slice(10), [
    'stop 3',
    'stop 4',
    'stop 5',
    'exited 3',
    'exited 4',
    'exited 5',
  ])
})

test('an app that crashes leaves the others running', async () => {
  const children = []
  const messages = []
  const lab = runLab({
    root,
    marker: join(work, 'no-marker'),
    interval: 60_000,
    discover: () => [{ name: 'apps/a' }, { name: 'apps/b' }],
    start: () => {
      const child = fakeChild(children.length + 1)
      children.push(child)
      return child
    },
    stop: async child => child.exitCode === null && child.exit(),
    log: message => messages.push(message),
  })
  children[0].exit(1)
  assert.deepEqual(messages, [
    'apps/a dev: exited (code 1); the other apps keep running.',
  ])
  assert.equal(children[1].exitCode, null)
  await lab.close()
})
