<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import * as protobuf from 'protobufjs/light'
import RobotStateManager from '@/ui/cockpit/RobotStateManager.vue'
import { useRobotStore } from '@/state/telemetry/robotStore'
import { useRobotSelectionStore } from '@/state/ui/robotSelectionStore'
import { useMatchStore } from '@/state/telemetry/matchStore'
import { createRm2026RuleLifecycle } from '@/app/rm2026RuleLifecycle'
import type { MqttRule } from '@core/rules/types'
import mqttProto from '@rules/rm2026/generated/mqtt-proto.json'

const params = new URLSearchParams(location.search)
const robotId = Number(params.get('clientId') ?? 3)
const team = robotId < 100 ? 'red' : 'blue'
const robotName = `${team === 'red' ? '红' : '蓝'}方3号步兵`
const store = useRobotStore()
const matchStore = useMatchStore()
const selection = useRobotSelectionStore()
selection.config = { robotMappings: { [robotName]: { id: robotId, type: 'infantry', team, number: 3 } } }
selection.selectedRobotName = robotName
window.api = {
  getRobotConfig: async () => selection.config
} as unknown as typeof window.api
const root = protobuf.Root.fromJSON(mqttProto)
let rule: MqttRule
let revision = 0
const lifecycle = createRm2026RuleLifecycle(async nextRule => {
  rule = nextRule
  return () => {}
}, store.invalidateSessionFreshness)

const scenarios = {
  missing: ['等待数据', '连接已经建立，尚未收到机器人状态。血条等待数据，模块灯保持灰色。'],
  live: ['正常上报', '当前血量和最大血量都已收到；在线模块为绿色，明确离线的模块为红色。'],
  zero: ['零血量', '0 是实际血量。血条显示 0 / 600，不会将它误判为缺失数据。'],
  timeout: ['停止上报', '模拟最后一次血量和模块报告已过去四秒。其他消息不会让这些状态重新变新鲜。'],
  disconnected: ['连接断开', '连接结束后，旧报告立即失效。保留最后一次血量供查看，模块灯变灰。'],
  reconnected: ['重连待报告', '同一 Client ID 重新连接后，旧血量和旧模块状态仍处于过期状态。'],
  recovered: ['重连恢复', '重连后收到新的静态、动态和模块报告，血条与模块灯恢复正常显示。']
} as const
type Scenario = keyof typeof scenarios
const scenario = ref<Scenario>((params.get('scenario') ?? 'live') as Scenario)

function connection(connected: boolean) {
  lifecycle.reconcile({
    connected,
    status: connected ? 'connected' : 'disconnected',
    clientId: connected ? String(robotId) : null,
    revision: ++revision
  })
}

function send(topic: string, data: Record<string, unknown>) {
  const type = root.lookupType(topic)
  const payload = type.encode(type.fromObject(data)).finish()
  for (const update of rule.handle({ topic, payload })) {
    if (!('scope' in update)) store.applyUpdate(update)
    else if (update.scope === 'match') matchStore.applyUpdate(update)
  }
}

function report() {
  send('RobotStaticStatus', {
    robotId, connectionState: 1, fieldState: 0, aliveState: 1,
    level: 3, maxHealth: 600, maxPower: 100, maxBufferEnergy: 60, maxChassisEnergy: 200
  })
  send('GlobalUnitStatus', { robotHealth: [600, 600, 420, 600, 600, 600, 600, 500, 600, 600] })
  send('RobotDynamicStatus', {
    currentHealth: 420, currentBufferEnergy: 42, currentChassisEnergy: 135,
    isOutOfCombat: false, currentExperience: 250, experienceForUpgrade: 500
  })
  send('RobotModuleStatus', {
    mainController: 1, powerManager: 1, videoTransmission: 1,
    rfid: 1, uwb: 0, armor: 1, smallShooter: 1,
    bigShooter: 0, capacitor: 1, lightStrip: 1, laserDetectionModule: 1
  })
}

function show(next: Scenario) {
  scenario.value = next
  connection(false)
  for (const id of Object.keys(store.robots)) store.removeRobot(Number(id))
  connection(true)
  if (next === 'missing') return
  report()
  if (next === 'zero') send('RobotDynamicStatus', { currentHealth: 0 })
  if (next === 'timeout') {
    const robot = store.getRobot(robotId)!
    robot.healthUpdatedAt = Date.now() - 4000
    robot.modulesUpdatedAt = Date.now() - 4000
    send('RobotPosition', { robotId, x: 10, y: 20 })
  }
  if (['disconnected', 'reconnected', 'recovered'].includes(next)) connection(false)
  if (['reconnected', 'recovered'].includes(next)) connection(true)
  if (next === 'recovered') report()
}

show(scenario.value)
onUnmounted(lifecycle.dispose)
</script>

<template>
  <main>
    <p class="eyebrow">BNGUCLIENT · 状态组件预览</p>
    <h1>血条与模块灯</h1>
    <p class="intro">使用项目中的真实 Vue 组件和 RM2026 Protobuf 消息，检查当前重构后的显示效果。</p>
    <nav aria-label="选择模拟场景">
      <button
        v-for="(item, key) in scenarios" :key="key"
        :class="{ selected: scenario === key }"
        @click="show(key)"
      >{{ item[0] }}</button>
    </nav>
    <section class="preview">
      <RobotStateManager :robot-name="robotName" :team="team" />
    </section>
    <section class="description">
      <h2>{{ scenarios[scenario][0] }}</h2>
      <p>{{ scenarios[scenario][1] }}</p>
      <p class="legend"><span class="online">● 在线</span><span class="offline">● 离线</span><span class="unknown">● 未收到 / 未知 / 已过期</span></p>
    </section>
    <p class="hint">正常场景是一次性上报；停留超过三秒后，血量和模块会自然进入过期状态。</p>
  </main>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #0b111b; color: #e2e8f0; font-family: 'Microsoft YaHei', sans-serif; }
main { max-width: 1100px; margin: 80px auto; padding: 32px; }
.eyebrow { font-size: 12px; color: #94a3b8; letter-spacing: 2px; }
h1 { margin: 12px 0; font-size: 32px; }
.intro, .hint { color: #94a3b8; line-height: 1.8; }
nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 30px 0; }
button { background: #172131; border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; padding: 10px 16px; cursor: pointer; }
button.selected { background: #173a47; border-color: #38bdf8; color: #e0f2fe; }
.preview { padding: 30px 20px; border: 1px solid #334155; border-radius: 12px; background: #101a29; min-height: 160px; }
.description { margin-top: 24px; padding: 4px 0; }
h2 { font-size: 19px; }
.description p { color: #cbd5e1; line-height: 1.8; }
.legend { display: flex; gap: 24px; font-size: 13px; }
.online { color: #84cc16; } .offline { color: #ef4444; } .unknown { color: #94a3b8; }
.hint { font-size: 12px; }
</style>
