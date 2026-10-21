// Runs the lab: every workspace app with a `dev` script, each as its own
// process, with its output prefixed like `apps/explainer dev: `.
// Run it with `pnpm dev`; Ctrl+C stops everything.
// Time travel rewrites the code under the running apps, so it touches a
// marker as its last step. When the marker changes, this stops every app,
// waits for them to exit and starts them again, finding the apps afresh,
// since a phase can add one.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import spawn from 'cross-spawn'
import { timeTravelMarker, workspaceFolders } from './patches.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Every workspace package with a `dev` script, in a stable order.
export function discoverApps(root) {
  const apps = []
  for (const folder of workspaceFolders(root)) {
    const parent = join(root, folder)
    if (!existsSync(parent)) continue
    for (const name of readdirSync(parent).sort()) {
      const dir = join(parent, name)
      const manifest = join(dir, 'package.json')
      if (!existsSync(manifest)) continue
      const dev = JSON.parse(readFileSync(manifest, 'utf8')).scripts?.dev
      if (dev) {
        apps.push({
          name: relative(root, dir).split('\\').join('/'),
          dir,
          dev,
        })
      }
    }
  }
  return apps
}

// How to start an app's dev script without a shell in between, so stopping
// the process stops the app: `node …` runs this Node, and a package's own
// command, such as `vite`, runs its bin script with this Node. Anything else
// goes through `pnpm run dev`.
export function commandFor(app) {
  const words = app.dev.trim().split(/\s+/)
  const plain = !/["'`$&|;<>()]/.test(app.dev)
  if (plain && words[0] === 'node') {
    return { command: process.execPath, args: words.slice(1) }
  }
  const bin = plain && packageBin(app.dir, words[0])
  if (bin) return { command: process.execPath, args: [bin, ...words.slice(1)] }
  return { command: 'pnpm', args: ['run', 'dev'] }
}

function packageBin(dir, name) {
  for (let at = dir; ; at = dirname(at)) {
    const manifest = join(at, 'node_modules', name, 'package.json')
    if (existsSync(manifest)) {
      const { bin } = JSON.parse(readFileSync(manifest, 'utf8'))
      const path = typeof bin === 'string' ? bin : bin?.[name]
      return path && join(dirname(manifest), path)
    }
    if (dirname(at) === at) return undefined
  }
}

// Starts one app, writing each line of its output with the app's prefix.
export function startApp(
  app,
  { spawnProcess = spawn, write = line => process.stdout.write(line) } = {}
) {
  const { command, args } = commandFor(app)
  const child = spawnProcess(command, args, {
    cwd: app.dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group, so stopping it stops what it started too.
    detached: process.platform !== 'win32',
    windowsHide: true,
    env: process.stdout.isTTY
      ? { FORCE_COLOR: '1', ...process.env }
      : process.env,
  })
  const prefix = `${app.name} dev: `
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = ''
    stream?.setEncoding?.('utf8')
    stream?.on('data', text => {
      buffer += text
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) write(`${prefix}${line}\n`)
    })
    stream?.on('end', () => buffer && write(`${prefix}${buffer}\n`))
  }
  return child
}

// Stops a child and everything it started, and resolves once it has exited.
export function stopApp(
  child,
  { platform = process.platform, kill = process.kill, run = spawn.sync } = {}
) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve()
  const exited = new Promise(resolve => child.once('exit', resolve))
  const signal = name => {
    try {
      if (platform === 'win32')
        run('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      else kill(-child.pid, name)
    } catch {
      // Already gone.
    }
  }
  signal('SIGTERM')
  const force = setTimeout(() => signal('SIGKILL'), 5000)
  return exited.finally(() => clearTimeout(force))
}

// The marker's state: its modification time and the phase written into it.
export function readMarker(path) {
  try {
    const { mtimeMs } = statSync(path)
    return { mtimeMs, phase: readFileSync(path, 'utf8').trim() }
  } catch {
    return undefined
  }
}

// Runs the apps and restarts them whenever the marker changes. Returns a
// function that stops everything.
export function runLab({
  root,
  marker = timeTravelMarker(root),
  interval = 500,
  discover = discoverApps,
  start = app => startApp(app),
  stop = child => stopApp(child),
  log = message => console.log(message),
}) {
  let running = []
  let seen = readMarker(marker)
  let restarting
  let stopped = false

  const launch = () => {
    running = discover(root).map(app => {
      const child = start(app)
      child.once('exit', (code, signal) => {
        if (!stopped && !restarting && running.includes(child)) {
          log(
            `${app.name} dev: exited (${signal ?? `code ${code}`}); the other apps keep running.`
          )
        }
      })
      return child
    })
  }
  const stopAll = () => Promise.all(running.map(child => stop(child)))

  const check = async () => {
    if (restarting || stopped) return
    const now = readMarker(marker)
    if (
      !now ||
      (seen && now.mtimeMs === seen.mtimeMs && now.phase === seen.phase)
    )
      return
    seen = now
    restarting = (async () => {
      await stopAll()
      if (stopped) return
      log(`Time travel to ${now.phase}: restarting the lab…`)
      launch()
    })()
    await restarting
    restarting = undefined
    // A second time travel during the restart is picked up next time round.
  }

  launch()
  const timer = setInterval(check, interval)
  return {
    check,
    async close() {
      stopped = true
      clearInterval(timer)
      await restarting
      await stopAll()
    },
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const lab = runLab({ root })
  let closing
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      closing ??= lab.close().then(() => process.exit(0))
    })
  }
}
