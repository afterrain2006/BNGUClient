import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import protobuf from 'protobufjs/light.js'
import Long from 'long'

protobuf.util.Long = Long
protobuf.configure()

const root = protobuf.Root.fromJSON(JSON.parse(readFileSync(new URL('../rules/rm2026/generated/mqtt-proto.json', import.meta.url), 'utf8')))
const bundle = await build({
  stdin: {
    contents: `
      import { createPinia, setActivePinia } from 'pinia'
      import { effectScope } from 'vue'
      import { useRobotStore } from '../src/state/telemetry/robotStore'
      import { useMatchStore } from '../src/state/telemetry/matchStore'
      import { useRobotSelectionStore } from '../src/state/ui/robotSelectionStore'
      import { useConnectionStore } from '../src/state/telemetry/connectionStore'
      import { useTelemetryView } from '../src/telemetry/useTelemetryView'
      export { createRm2026Rule, encodeRm2026Command } from '../rules/rm2026'
      export { createCustomDataInput } from '../src/communication/custom-data/customDataInput'
      export function fixture() {
        setActivePinia(createPinia())
        const robots = useRobotStore(), match = useMatchStore(), selection = useRobotSelectionStore(), connection = useConnectionStore()
        return { robots, match, selection, connection, view() {
          const scope = effectScope()
          const value = scope.run(useTelemetryView)
          return { value, stop: () => scope.stop() }
        } }
      }
    `,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { fixture, createRm2026Rule, createCustomDataInput, encodeRm2026Command } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)
function message(type, data) {
  const schema = root.lookupType(type)
  return { topic: `robomaster/${type}`, payload: schema.encode(schema.fromObject(data)).finish() }
}
function apply(state, rule, type, data) {
  const updates = rule.handle(message(type, data))
  for (const update of updates) {
    if (!('scope' in update)) state.robots.applyUpdate(update)
    else if (update.scope === 'match') state.match.applyUpdate(update)
  }
  return updates
}

test('match updates are separate from robots, patch correctly, and retain uint64 precision', () => {
  const state = fixture(), rule = createRm2026Rule({ selfRobotId: 103 })
  apply(state, rule, 'GameStatus', { currentRound: 2, redScore: 1, blueScore: 4, currentStage: 4, isPaused: true, stageCountdownSec: 300 })
  apply(state, rule, 'GameStatus', { redScore: 0, isPaused: false })
  assert.equal(state.match.state.status.stage, 'fighting')
  assert.equal(state.match.state.status.redScore, 0)
  assert.equal(state.match.state.status.blueScore, 4)
  assert.equal(state.match.state.status.paused, false)
  apply(state, rule, 'GlobalLogisticsStatus', { remainingEconomy: 0, totalEconomyObtained: '18446744073709551615' })
  assert.equal(state.match.state.teams.blue.remainingEconomy, 0)
  assert.equal(state.match.state.teams.blue.totalEconomyObtained, '18446744073709551615')
  assert.deepEqual(Object.keys(state.robots.robots), [])
})

test('global units map both teams, including rebuilt outposts, without creating base robots', () => {
  for (const selfRobotId of [3, 103]) {
    const state = fixture(), rule = createRm2026Rule({ selfRobotId })
    apply(state, rule, 'GlobalUnitStatus', { baseHealth: 0, baseStatus: 2, outpostStatus: 5, enemyBaseHealth: 4500, totalDamageAlly: 10, totalDamageEnemy: 20, robotBullets: [-1, 0, 20], robotHealth: [100, 200, 0, 400, 500, 110, 210, 310, 410, 510] })
    const ally = selfRobotId < 100 ? 'red' : 'blue', enemy = ally === 'red' ? 'blue' : 'red'
    assert.equal(state.match.state.teams[ally].baseHealth, 0)
    assert.equal(state.match.state.teams[ally].baseState, 'armor-open')
    assert.equal(state.match.state.teams[ally].outpostState, 'rebuilding')
    assert.equal(state.match.state.teams[enemy].baseHealth, 4500)
    assert.deepEqual([...state.match.state.teams[ally].projectileAllowances], [-1, 0, 20])
    assert.equal(state.robots.getRobot(selfRobotId).combat.currentHealth, 0)
    assert.equal(state.robots.getRobot(selfRobotId < 100 ? 10 : 110), undefined)
  }
})

test('injury, respawn, penalties, buffs and specialized reports route to the correct robot', () => {
  const state = fixture(), rule = createRm2026Rule({ selfRobotId: 103 })
  apply(state, rule, 'RobotInjuryStat', { totalDamage: 90, offlineDamage: 12, killerId: 0 })
  apply(state, rule, 'RobotRespawnStatus', { isPendingRespawn: true, currentRespawnProgress: 20, totalRespawnProgress: 100, canPayForRespawn: false })
  apply(state, rule, 'PenaltyInfo', { penaltyType: 5, penaltyEffectSec: 10, totalPenaltyNum: 2 })
  apply(state, rule, 'Buff', { robotId: 104, buffType: 1, buffLevel: 0, buffMaxTime: 10, buffLeftTime: 5 })
  assert.equal(state.robots.getRobot(103).injury.offlineDamage, 12)
  assert.equal(state.robots.getRobot(103).respawn.canPayForRespawn, false)
  assert.equal(state.robots.getRobot(103).penalties[0].kind, 'over-heat')
  assert.equal(state.robots.getRobot(104).buffs[0].level, 0)
  assert.equal(state.robots.getRobot(103).buffs.length, 0)
  apply(state, rule, 'Buff', { robotId: 104, buffType: 1, buffLeftTime: 0 })
  apply(state, rule, 'PenaltyInfo', { penaltyType: 5, penaltyEffectSec: 0 })
  assert.equal(state.robots.getRobot(104).buffs.length, 0)
  assert.equal(state.robots.getRobot(103).penalties.length, 0)
  for (const [type, data] of [
    ['SentryStatusSync', { postureId: 2, isWeakened: false }],
    ['AirSupportStatusSync', { airsupportStatus: 1, leftTime: 20, isBeingTargeted: 0 }],
    ['TechCoreMotionStateSync', { basicState: 3, remainTimeAll: 12 }],
    ['RobotPerformanceSelectionSync', { shooter: 2, chassis: 1 }],
    ['DeployModeStatusSync', { status: 0 }],
    ['DartSelectTargetStatusSync', { targetId: 1, open: 0 }],
    ['SentryCtrlResult', { commandId: 1, resultCode: 0 }]
  ]) apply(state, rule, type, data)
  const robot = state.robots.getRobot(103)
  assert.equal(robot.systems.sentry.posture, 'defense')
  assert.equal(robot.systems.airSupport.targeted, false)
  assert.equal(robot.systems.engineering.remainTimeAll, 12)
  assert.equal(robot.configuration.shooterPerformance, 'burst')
  assert.equal(robot.systems.deployment.deployed, false)
  assert.equal(robot.systems.dart.gateOpen, false)
  assert.equal(robot.systems.controlResult.resultCode, 0)
})

test('radar maps all twelve identities in official order and converts cm to metres', () => {
  for (const selfRobotId of [3, 103]) {
    const state = fixture(), rule = createRm2026Rule({ selfRobotId })
    apply(state, rule, 'RadarInfoToClient', { RadarSingleRobotInfo: Array.from({ length: 12 }, (_, index) => ({ targetPosX: 100 + index, targetPosY: 200, isHighLight: index === 1 ? 2 : 1 })) })
    const radar = state.match.state.radar
    assert.deepEqual(radar.map(target => target.robotId), selfRobotId === 3 ? [101,102,103,104,106,107,1,2,3,4,6,7] : [1,2,3,4,6,7,101,102,103,104,106,107])
    assert.equal(radar[0].x, 1)
    assert.equal(radar[0].y, 2)
    assert.equal(state.robots.getRobot(radar[1].robotId), undefined)
    assert.equal(state.robots.getRobot(radar[0].robotId).pose.position.x, 1)
  }
})

test('global mechanisms and revised event meanings are resolved inside Rule', () => {
  const state = fixture(), rule = createRm2026Rule({ selfRobotId: 103 })
  apply(state, rule, 'GlobalSpecialMechanism', { mechanismId: [1, 2], mechanismTimeSec: [20, 0] })
  assert.deepEqual(state.match.state.mechanisms.map(item => item.kind), ['blue-fortress-occupied', 'red-fortress-occupied'])
  apply(state, rule, 'Event', { eventId: 7, param: '' })
  assert.equal(state.match.state.events[0].kind, 'enemy-air-support')
  apply(state, rule, 'RuneStatusSync', { runeStatus: 3, averageRings: 9.5 })
  assert.equal(state.match.state.rune.state, 'active')
  apply(state, rule, 'GlobalSpecialMechanism', {})
  assert.equal(state.match.state.mechanisms.length, 0)
})

test('UI selection and persisted field bindings read only the new state', async () => {
  globalThis.window = { setInterval, clearInterval, api: { getRobotConfig: async () => ({ robotMappings: {
    blue: { id: 103, type: 'infantry', team: 'blue', number: 3 }, red: { id: 4, type: 'infantry', team: 'red', number: 4 }
  } }) } }
  const state = fixture(), rule = createRm2026Rule({ selfRobotId: 103 })
  await state.selection.selectRobot('red')
  state.connection.perspectiveTeam = 'blue'
  apply(state, rule, 'RobotDynamicStatus', { currentHealth: 420, remainingAmmo: 20 })
  apply(state, rule, 'RobotPosition', { robotId: 4, x: 0, y: 2 })
  apply(state, rule, 'GlobalLogisticsStatus', { remainingEconomy: 12 })
  apply(state, rule, 'Buff', { robotId: 103, buffType: 2, buffLeftTime: 5 })
  const view = state.view()
  try {
    assert.equal(view.value.currentRobotId, 4)
    assert.equal(view.value.getRobot(4).x, 0)
    assert.equal(view.value.getRobot(103).currentHealth, 420)
    assert.equal(view.value.logisticsStatus.remainingEconomy, 12)
    assert.equal(view.value.activeBuffs[0].buffType, 2)
    assert.equal(view.value.activeBuffs[0].buffLeftTime, 5)
    await state.selection.selectRobot('blue')
    assert.equal(view.value.currentRobotId, 103)
    assert.equal(state.robots.getRobot(4).pose.position.y, 2)
    state.robots.applyUpdate({ robotId: 103, combat: { canRemoteAmmo: true } })
    state.robots.invalidateSessionFreshness()
    state.match.reset()
    assert.equal(view.value.activeBuffs.length, 0)
    assert.equal(state.robots.getRobot(4).poseUpdatedAt, -1)
    assert.equal(state.robots.getRobot(103).combat.canRemoteAmmo, undefined)
    assert.equal(view.value.logisticsStatus.remainingEconomy, undefined)
  } finally { view.stop(); delete globalThis.window }
})

test('custom streams bind their parser to incoming identity and discard old async sessions', async () => {
  const results = [], parsedPaths = []
  let resolveOld
  const input = createCustomDataInput({
    loadConfig: async () => ({ robotMappings: { blue: { id: 103, type: 'infantry' } }, robotTypes: { infantry: { customDataProto: 'infantry.proto' } } }),
    parse: (path, bytes) => {
      parsedPaths.push(path)
      return bytes[0] === 1 ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve({ mode: 0, pureDataFields: { health: bytes[0] } })
    },
    apply: (robotId, value) => results.push({ robotId, value })
  })
  input.handle({ scope: 'custom', robotId: 103, bytes: Uint8Array.of(1) })
  await new Promise(resolve => setImmediate(resolve))
  input.reset()
  input.handle({ scope: 'custom', robotId: 103, bytes: Uint8Array.of(2) })
  resolveOld({ mode: 0, pureDataFields: { health: 999 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(results.length, 1)
  assert.equal(results[0].robotId, 103)
  assert.equal(results[0].value.pureDataFields.health, 2)
  assert.deepEqual(results[0].value.rawBuffer, [2])
  assert.deepEqual(parsedPaths, ['infantry.proto', 'infantry.proto'])
  input.dispose()
})

test('outbound codecs retain keyboard and normal protobuf encoding', async () => {
  const bytes = await encodeRm2026Command('KeyboardMouseControl', { mouseX: -2, mouseY: 5, keyboardValue: 9, leftButtonDown: true })
  const value = root.lookupType('KeyboardMouseControl').toObject(root.lookupType('KeyboardMouseControl').decode(bytes))
  assert.equal(value.mouseX, -2)
  assert.equal(value.keyboardValue, 9)
  assert.equal(value.leftButtonDown, true)
  const command = await encodeRm2026Command('AssemblyCommand', { operation: 2, difficulty: 4 })
  assert.equal(root.lookupType('AssemblyCommand').decode(command).operation, 2)
})

test('unknown MQTT topics are not robot telemetry and do not produce updates', () => {
  const rule = createRm2026Rule({ selfRobotId: 3 })
  assert.deepEqual(rule.handle({ topic: 'foreign/status', payload: Uint8Array.of(1, 2, 3) }), [])
  assert.deepEqual(rule.handle(message('KeyboardMouseControl', { mouseX: 1 })), [])
})

test('old ingress files are gone and new domain, stores and UI do not import protocol internals', () => {
  for (const path of ['store/modules/mqtt_data.ts', 'mqtt/mqttDecoder.worker.ts', 'mqtt/mqttPayloadDecoder.ts', 'utils/mqtt_protocol.ts', 'utils/mqtt_protocol_constants.ts']) {
    assert.equal(existsSync(new URL(`../src/${path}`, import.meta.url)), false, path)
  }
  function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(new URL(`${entry.name}/`, dir)) : [new URL(entry.name, dir)]) }
  for (const file of ['src', 'core', 'rules'].flatMap(folder => files(new URL(`../${folder}/`, import.meta.url))).filter(file => /\.(ts|vue)$/.test(file.pathname))) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:mqtt_data|mqtt_protocol|mqttPayloadDecoder|mqttDecoder)/, file.pathname)
    if (!file.pathname.includes('/rules/rm2026/')) assert.doesNotMatch(source, /(?:from\s+|import\()['"][^'"]*rules\/rm2026\/(?:decoder|adapter|telemetry|types|commands)/, file.pathname)
    if (/\/(?:core|src\/state)\//.test(file.pathname)) assert.doesNotMatch(source, /(?:from\s+|import\()['"][^'"]*(?:rm2026|protobuf|tauri|mqtt-proto)/, file.pathname)
  }
  assert.doesNotMatch(readFileSync(new URL('../src/desktop/api.ts', import.meta.url), 'utf8'), /listen\(['"]mqtt-message/)
  assert.doesNotMatch(readFileSync(new URL('../src/pages/Cockpit.vue', import.meta.url), 'utf8'), /mqtt\.onMessage|handleMessage\(/)
})
