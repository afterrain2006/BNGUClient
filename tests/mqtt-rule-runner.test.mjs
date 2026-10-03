import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/input/mqttRuleRunner.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  plugins: [{
    name: 'mock-mqtt-runner-boundaries',
    setup(builder) {
      builder.onResolve({ filter: /^@\/adaptor\/tauri\/mqttAdapter$/ }, () => ({
        path: 'mqtt-adapter', namespace: 'mock'
      }))
      builder.onResolve({ filter: /^@\/stores\/robotStore$/ }, () => ({
        path: 'robot-store', namespace: 'mock'
      }))
      builder.onResolve({ filter: /^@\/stores\/(matchStore|connectionStore|customDataStore)$/ }, args => ({
        path: args.path.split('/').pop(), namespace: 'mock'
      }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({
        contents: path === 'mqtt-adapter'
          ? `export const mqttAdapter = {
               onStatus: async handler => {
                 globalThis.__mqttRunnerTest.status = handler
                 return () => { globalThis.__mqttRunnerTest.status = null }
               },
               onMessage: async handler => {
                 globalThis.__mqttRunnerTest.message = handler
                 return () => { globalThis.__mqttRunnerTest.message = null }
               }
             }`
          : path === 'robot-store' ? 'export const useRobotStore = () => globalThis.__mqttRunnerTest.store'
          : path === 'matchStore' ? 'export const useMatchStore = () => ({ applyUpdate(update) { (globalThis.__mqttRunnerTest.matchUpdates ??= []).push(update) } })'
          : path === 'connectionStore' ? 'export const useConnectionStore = () => ({ recordMessage() { globalThis.__mqttRunnerTest.received = (globalThis.__mqttRunnerTest.received ?? 0) + 1 } })'
          : 'export const useCustomDataStore = () => ({ set(robotId, value) { (globalThis.__mqttRunnerTest.customUpdates ??= []).push({ robotId, value }) } })',
        loader: 'js'
      }))
    }
  }]
})
const { startMqttRule } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)

test('MQTT runner stops routing messages while disconnected', async () => {
  const calls = { updates: 0, resets: 0 }
  globalThis.__mqttRunnerTest = {
    store: {
      applyUpdate() { calls.updates += 1 }
    },
    status: null,
    message: null
  }
  const session = globalThis.__mqttRunnerTest
  const stop = await startMqttRule({
    handle() { return [{ robotId: 3, modules: { powerManager: 'online' } }] },
    reset() { calls.resets += 1 }
  })

  session.message({ topic: 'RobotModuleStatus', payload: new Uint8Array() })
  assert.equal(calls.updates, 1)

  session.status({ connected: false })
  assert.equal(calls.resets, 1)
  session.message({ topic: 'RobotModuleStatus', payload: new Uint8Array() })
  assert.equal(calls.updates, 1)

  session.status({ connected: true })
  session.message({ topic: 'RobotModuleStatus', payload: new Uint8Array() })
  assert.equal(calls.updates, 2)

  stop()
  assert.equal(session.status, null)
  assert.equal(session.message, null)
  delete globalThis.__mqttRunnerTest
})

test('runner dispatches robot, match and custom updates through one ingress callback', async () => {
  const robotUpdates = []
  globalThis.__mqttRunnerTest = { store: { applyUpdate(update) { robotUpdates.push(update) } } }
  globalThis.window = { api: { getRobotConfig: async () => ({}) } }
  const session = globalThis.__mqttRunnerTest
  const stop = await startMqttRule({
    handle() { return [
      { robotId: 103, combat: { currentHealth: 0 } },
      { scope: 'match', status: { paused: false } },
      { scope: 'custom', robotId: 103, bytes: Uint8Array.of(0, 2) }
    ] }, reset() {}
  })
  const retainedCallback = session.message
  try {
    session.message({ topic: 'test', payload: new Uint8Array() })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(robotUpdates[0].combat.currentHealth, 0)
    assert.equal(session.matchUpdates[0].status.paused, false)
    assert.deepEqual(session.customUpdates[0].value.rawBuffer, [0, 2])
    assert.equal(session.customUpdates[0].robotId, 103)
    assert.equal(session.received, 1)
    stop()
    retainedCallback({ topic: 'test', payload: new Uint8Array() })
    assert.equal(session.received, 1)
    assert.equal(robotUpdates.length, 1)
  } finally { stop(); delete globalThis.__mqttRunnerTest; delete globalThis.window }
})
