import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import protobuf from 'protobufjs/light.js'

const proto = JSON.parse(readFileSync(new URL('../rules/rm2026/generated/mqtt-proto.json', import.meta.url), 'utf8'))
const root = protobuf.Root.fromJSON(proto)
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../rules/rm2026/index.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { createRm2026Rule, parseRm2026ClientId } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)

function mqttMessage(type, data) {
  const messageType = root.lookupType(type)
  return {
    topic: type,
    payload: messageType.encode(messageType.fromObject(data)).finish()
  }
}

test('RM2026 Rule uses fixed connection identity and checks StaticStatus', () => {
  const rule = createRm2026Rule({ selfRobotId: 3 })
  const secondRule = createRm2026Rule({ selfRobotId: 4 })
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))

  try {
    const dynamic = mqttMessage('RobotDynamicStatus', {
      currentHealth: 0,
      isOutOfCombat: false
    })
    assert.equal(rule.handle(dynamic)[0].robotId, 3)
    assert.equal(rule.handle(dynamic)[0].combat.currentHealth, 0)
    assert.equal(rule.handle(dynamic)[0].combat.isOutOfCombat, false)
    assert.equal(secondRule.handle(dynamic)[0].robotId, 4)

    const position = rule.handle(mqttMessage('RobotPosition', {
      robotId: 7,
      x: 0,
      yaw: 0
    }))
    assert.equal(position[0].robotId, 7)
    assert.equal(position[0].pose.position.x, 0)
    assert.equal(position[0].pose.yaw, 0)

    const staticUpdates = rule.handle(mqttMessage('RobotStaticStatus', {
      robotId: 3,
      connectionState: 0,
      fieldState: 1,
      level: 0
    }))
    assert.equal(staticUpdates[0].robotId, 3)
    assert.equal(staticUpdates[0].operational.connected, false)
    assert.equal(staticUpdates[0].operational.onField, false)
    assert.equal(staticUpdates[0].configuration.level, 0)

    assert.deepEqual(rule.handle(mqttMessage('RobotStaticStatus', { robotId: 4 })), [])
    assert.deepEqual(rule.handle(mqttMessage('RobotStaticStatus', { robotId: 4 })), [])
    assert.equal(warnings.length, 1)
    assert.ok(warnings[0].includes('robotId 4 does not match active client robotId 3'))
    assert.equal(rule.handle(dynamic)[0].robotId, 3)

    rule.reset()
    assert.equal(rule.handle(dynamic)[0].robotId, 3)
  } finally {
    console.warn = originalWarn
  }
})

test('RM2026 Client ID parser accepts only documented robot ID ranges', () => {
  assert.equal(parseRm2026ClientId('3'), 3)
  assert.equal(parseRm2026ClientId('103'), 103)
  for (const invalid of ['', '0', '12', '100', '112', '03', '3.0', ' 3 ', 'abc']) {
    assert.equal(parseRm2026ClientId(invalid), null)
  }
  assert.throws(() => createRm2026Rule({ selfRobotId: 12 }), RangeError)
})

test('RobotModuleStatus routes to active client identity and maps all module states', () => {
  const rule = createRm2026Rule({ selfRobotId: 3 })
  const secondRule = createRm2026Rule({ selfRobotId: 103 })
  const message = mqttMessage('RobotModuleStatus', {
    powerManager: 0,
    rfid: 1,
    lightStrip: 2,
    smallShooter: 0,
    bigShooter: 1,
    uwb: 0,
    armor: 1,
    videoTransmission: 0,
    capacitor: 1,
    mainController: 0,
    laserDetectionModule: 1
  })

  const [update] = rule.handle(message)
  assert.equal(update.robotId, 3)
  assert.deepEqual(update.modules, {
    powerManager: 'offline',
    rfid: 'online',
    lightStrip: 'unknown',
    smallShooter: 'offline',
    bigShooter: 'online',
    uwb: 'offline',
    armor: 'online',
    videoTransmission: 'offline',
    capacitor: 'online',
    mainController: 'offline',
    laserDetectionModule: 'online'
  })
  assert.equal(secondRule.handle(message)[0].robotId, 103)

  const [partialUpdate] = rule.handle(mqttMessage('RobotModuleStatus', { rfid: 0 }))
  assert.equal(partialUpdate.modules.rfid, 'offline')
  assert.equal(partialUpdate.modules.powerManager, undefined)
})

test('GlobalUnitStatus routes documented ally/enemy health order from both team perspectives', () => {
  const message = mqttMessage('GlobalUnitStatus', {
    robotHealth: [100, 200, 300, 400, 0, 500, 600, 700, 800, 900]
  })
  const red = createRm2026Rule({ selfRobotId: 3 }).handle(message)
  const blue = createRm2026Rule({ selfRobotId: 103 }).handle(message)

  assert.deepEqual(red.map(update => update.robotId), [1, 2, 3, 4, 7, 101, 102, 103, 104, 107])
  assert.deepEqual(blue.map(update => update.robotId), [101, 102, 103, 104, 107, 1, 2, 3, 4, 7])
  assert.equal(red[4].combat.currentHealth, 0)
  assert.equal(blue[4].combat.currentHealth, 0)
  assert.deepEqual(Object.keys(red[0]), ['robotId', 'combat'])
  assert.deepEqual(createRm2026Rule({ selfRobotId: 3 }).handle(mqttMessage('GlobalUnitStatus', {})), [])
})
