import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Pass explicit files: shell glob expansion differs on Windows and Linux.
const testDir = fileURLToPath(new URL('../tests/', import.meta.url))
const files = readdirSync(testDir).filter(name => name.endsWith('.test.mjs')).sort()
const result = spawnSync(process.execPath, ['--test', ...files.map(name => `${testDir}/${name}`)], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
