import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import protobuf from 'protobufjs/light.js'

const proto = JSON.parse(readFileSync(new URL('../rules/rm2026/generated/mqtt-proto.json', import.meta.url), 'utf8'))
const root = protobuf.Root.fromJSON(proto)
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/app/rm2026RuleLifecycle.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { createRm2026RuleLifecycle } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)

const dynamicType = root.lookupType('RobotDynamicStatus')
const dynamicMessage = {
  topic: 'RobotDynamicStatus',
  payload: dynamicType.encode(dynamicType.fromObject({ currentHealth: 42 })).finish()
}
const status = (revision, connected, clientId = null) => ({
  revision, connected, clientId, status: connected ? 'connected' : 'disconnected'
})

test('RM2026 lifecycle replaces and stops Rule listeners only when active identity changes', async () => {
  const rules = []
  const stops = []
  let invalidations = 0
  const lifecycle = createRm2026RuleLifecycle(async rule => {
    rules.push(rule)
    const index = rules.length - 1
    return () => stops.push(index)
  }, () => { invalidations += 1 })

  lifecycle.reconcile(status(1, true, '3'))
  await Promise.resolve()
  assert.equal(rules.length, 1)
  assert.equal(invalidations, 1)
  assert.equal(rules[0].handle(dynamicMessage)[0].robotId, 3)

  lifecycle.reconcile(status(2, true, '3'))
  lifecycle.reconcile(status(1, true, '4')) // stale snapshot must not undo a newer event
  assert.equal(rules.length, 1)
  assert.equal(invalidations, 1)
  assert.deepEqual(stops, [])

  lifecycle.reconcile(status(3, true, '4'))
  await Promise.resolve()
  assert.deepEqual(stops, [0])
  assert.equal(invalidations, 2)
  assert.equal(rules.length, 2)
  assert.deepEqual(rules[0].handle(dynamicMessage), [])
  assert.equal(rules[1].handle(dynamicMessage)[0].robotId, 4)

  lifecycle.reconcile(status(4, false))
  assert.deepEqual(stops, [0, 1])
  assert.equal(invalidations, 3)
  assert.deepEqual(rules[1].handle(dynamicMessage), [])
  lifecycle.dispose()
  assert.equal(invalidations, 4)
})

test('RM2026 lifecycle closes a pending listener after dispose', async () => {
  let resolveStart
  let stopCount = 0
  const lifecycle = createRm2026RuleLifecycle(() => new Promise(resolve => {
    resolveStart = resolve
  }), () => {})
  lifecycle.reconcile(status(1, true, '3'))
  lifecycle.dispose()
  resolveStart(() => { stopCount += 1 })
  await Promise.resolve()
  assert.equal(stopCount, 1)
  lifecycle.reconcile(status(2, true, '4'))
  assert.equal(stopCount, 1)
})
