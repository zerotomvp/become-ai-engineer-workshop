// Checks that this machine is ready for the workshop: Node, dependencies,
// the seeded request log and access to the model gateway.
// Run it with `pnpm setup-check`.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const checks = [
  ['Node.js 22.18 or later', checkNode],
  ['Dependencies installed', checkDependencies],
  ['Seeded request log', checkFixtures],
  ['OpenRouter access', checkOpenRouter],
]

let ready = true
for (const [name, check] of checks) {
  try {
    console.log(`ok    ${name}: ${await check()}`)
  } catch (error) {
    ready = false
    console.log(`FAIL  ${name}: ${error.message}`)
  }
}
console.log(ready ? '\nReady for the workshop.' : '\nFix the failures above.')
process.exitCode = ready ? 0 : 1

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 18)) {
    throw new Error(`found ${process.version}; install Node.js 22.18+`)
  }
  return process.version
}

function checkDependencies() {
  const missing = []
  for (const app of readdirSync('apps')) {
    // Time travel back can leave a later phase's folder, holding only
    // ignored files; without a package.json it is no app.
    const manifest = join('apps', app, 'package.json')
    if (!existsSync(manifest)) continue
    const { dependencies = {}, devDependencies = {} } = JSON.parse(
      readFileSync(manifest, 'utf8')
    )
    for (const name of Object.keys({ ...dependencies, ...devDependencies })) {
      if (!existsSync(join('apps', app, 'node_modules', name))) {
        missing.push(`${app}: ${name}`)
      }
    }
  }
  if (missing.length) {
    throw new Error(`missing ${missing.join(', ')}; run pnpm install`)
  }
  return 'all apps'
}

function checkFixtures() {
  const path = join('apps', 'payments-api', 'fixtures', 'seed.json')
  const { requests } = JSON.parse(readFileSync(path, 'utf8'))
  const failed = requests.filter(request => request.status >= 400)
  if (!failed.length) throw new Error(`${path} has no failed requests`)
  return `${failed.length} failed requests`
}

async function checkOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    throw new Error(
      'OPENROUTER_API_KEY is not set; copy .env.example to .env and paste the key from the attendee page'
    )
  }
  const response = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(error => {
    throw new Error(`cannot reach openrouter.ai (${error.message})`)
  })
  if (response.status === 401) throw new Error('the key was rejected')
  if (!response.ok) throw new Error(`openrouter.ai answered ${response.status}`)
  const { data } = await response.json()
  return data.limit_remaining == null
    ? 'key accepted'
    : `key accepted, $${data.limit_remaining.toFixed(2)} left`
}
