import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/telemetry/useFreshnessClock.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { getDataFreshness } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)

test('telemetry freshness distinguishes absent, fresh, and invalidated reports', () => {
  assert.equal(getDataFreshness(0, 5000), 'missing')
  assert.equal(getDataFreshness(-1, 5000), 'stale')
  assert.equal(getDataFreshness(1000, 4000), 'fresh')
  assert.equal(getDataFreshness(1000, 4001), 'stale')
})
