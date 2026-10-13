import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: `
      import { createPinia, setActivePinia } from 'pinia'
      import { useRobotStore } from '../src/state/telemetry/robotStore'
      export function createStore() {
        setActivePinia(createPinia())
        return useRobotStore()
      }
    `,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { createStore } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)

test('robotStore applies defined patch fields including zero and false', () => {
  const store = createStore()
  store.applyUpdate({
    robotId: 7,
    pose: { position: { x: 5, y: 2 }, yaw: 3 },
    combat: { currentHealth: 100, isOutOfCombat: true },
    operational: { connected: true },
    configuration: { level: 2 },
    modules: { powerManager: 'online', rfid: 'offline', laserDetectionModule: 'unknown' }
  })

  const before = store.getRobot(7).lastUpdatedAt
  store.applyUpdate({
    robotId: 7,
    pose: { position: { x: 0, y: undefined }, yaw: 0 },
    combat: { currentHealth: 0, isOutOfCombat: false },
    operational: { connected: false },
    configuration: { level: 0 },
    modules: { powerManager: 'offline', rfid: undefined }
  })

  const robot = store.getRobot(7)
  assert.equal(robot.pose.position.x, 0)
  assert.equal(robot.pose.position.y, 2)
  assert.equal(robot.pose.yaw, 0)
  assert.equal(robot.combat.currentHealth, 0)
  assert.equal(robot.combat.isOutOfCombat, false)
  assert.equal(robot.operational.connected, false)
  assert.equal(robot.configuration.level, 0)
  assert.equal(robot.modules.powerManager, 'offline')
  assert.equal(robot.modules.rfid, 'offline')
  assert.equal(robot.modules.laserDetectionModule, 'unknown')
  assert.ok(robot.lastUpdatedAt >= before)
})

test('module freshness changes only on module reports and is invalidated between connections', () => {
  const store = createStore()
  assert.equal(store.getOrCreateRobot(3).modulesUpdatedAt, 0)

  store.applyUpdate({ robotId: 3, modules: { powerManager: 'online' } })
  const receivedAt = store.getRobot(3).modulesUpdatedAt
  assert.ok(receivedAt > 0)

  store.applyUpdate({ robotId: 3, combat: { currentHealth: 50 } })
  store.applyUpdate({ robotId: 3, modules: { rfid: undefined } })
  assert.equal(store.getRobot(3).modulesUpdatedAt, receivedAt)

  store.invalidateSessionFreshness()
  assert.equal(store.getRobot(3).modulesUpdatedAt, -1)
  assert.equal(store.getRobot(3).modules.powerManager, 'online')

  store.applyUpdate({ robotId: 3, combat: { currentHealth: 40 } })
  assert.equal(store.getRobot(3).modulesUpdatedAt, -1)
  store.applyUpdate({ robotId: 3, modules: { powerManager: 'offline' } })
  assert.ok(store.getRobot(3).modulesUpdatedAt > 0)
})

test('health receipt times remain independent and reconnect waits for new field reports', context => {
  let now = 1000
  context.mock.method(Date, 'now', () => now)
  const store = createStore()
  store.applyUpdate({ robotId: 3, configuration: { maxHealth: 600 } })
  assert.equal(store.getRobot(3).healthUpdatedAt, 0)
  assert.equal(store.getRobot(3).maxHealthUpdatedAt, 1000)

  now = 2000
  store.applyUpdate({ robotId: 3, combat: { currentHealth: 0 } })
  assert.equal(store.getRobot(3).healthUpdatedAt, 2000)
  assert.equal(store.getRobot(3).combat.currentHealth, 0)

  now = 3000
  store.applyUpdate({ robotId: 3, modules: { powerManager: 'online' } })
  store.applyUpdate({ robotId: 3, combat: { currentHeat: 20, currentHealth: undefined } })
  assert.equal(store.getRobot(3).healthUpdatedAt, 2000)
  assert.equal(store.getRobot(3).maxHealthUpdatedAt, 1000)

  store.invalidateSessionFreshness()
  assert.equal(store.getRobot(3).healthUpdatedAt, -1)
  assert.equal(store.getRobot(3).maxHealthUpdatedAt, -1)
  assert.equal(store.getRobot(3).modulesUpdatedAt, -1)

  now = 4000
  store.applyUpdate({ robotId: 3, combat: { currentHealth: 100 } })
  assert.equal(store.getRobot(3).healthUpdatedAt, 4000)
  assert.equal(store.getRobot(3).maxHealthUpdatedAt, -1)
  assert.equal(store.getRobot(3).modulesUpdatedAt, -1)
})
