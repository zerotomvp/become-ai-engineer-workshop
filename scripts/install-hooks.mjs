import { spawnSync } from 'node:child_process'
import { chmodSync } from 'node:fs'

// Git for Windows supplies the shell that launches the Node hook.
const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'inherit',
})
if (result.error || result.status !== 0) process.exit(1)
if (process.platform !== 'win32') chmodSync('.githooks/pre-push', 0o755)
