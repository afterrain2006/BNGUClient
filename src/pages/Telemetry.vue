<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRobotStore } from '@/state/telemetry/robotStore'
import { useRobotSelectionStore } from '@/state/ui/robotSelectionStore'
import { useConnectionStore } from '@/state/telemetry/connectionStore'
import { useMatchStore } from '@/state/telemetry/matchStore'
import { getDataFreshness, useFreshnessClock } from '@/telemetry/useFreshnessClock'
import RobotHealthBar from '@/ui/cockpit/robot-status/RobotHealthBar.vue'

const robots = useRobotStore()
const selection = useRobotSelectionStore()
const connection = useConnectionStore()
const match = useMatchStore()
const now = useFreshnessClock()
const robot = computed(() => robots.getRobot(selection.selectedRobotId))
const healthFreshness = computed(() => getDataFreshness(robot.value?.healthUpdatedAt ?? 0, now.value))
const moduleFreshness = computed(() => getDataFreshness(robot.value?.modulesUpdatedAt ?? 0, now.value))
const history = ref<{ at: number; value: number }[]>([])
let sampledHealthAt = 0
const exportMessage = ref('')
const moduleLabels = {
  powerManager: '电源管理', rfid: 'RFID', lightStrip: '灯条', smallShooter: '17 mm 发射',
  bigShooter: '42 mm 发射', uwb: '定位', armor: '装甲', videoTransmission: '图传',
  capacitor: '电容', mainController: '主控', laserDetectionModule: '激光检测'
} as const
watch(() => [selection.selectedRobotId, connection.activeClientId, connection.connected], () => {
  history.value = []
  sampledHealthAt = 0
  exportMessage.value = ''
}, { flush: 'sync' })
watch(now, () => {
  const current = robot.value
  if (!connection.connected || healthFreshness.value !== 'fresh' || current?.combat.currentHealth === undefined || current.healthUpdatedAt === sampledHealthAt) return
  sampledHealthAt = current.healthUpdatedAt
  history.value = [...history.value, { at: current.healthUpdatedAt, value: current.combat.currentHealth }].slice(-120)
})
const chartMax = computed(() => Math.max(1, robot.value?.configuration.maxHealth ?? 0, ...history.value.map(sample => sample.value)))
const chartPoints = computed(() => history.value.map((sample, index) => {
  const x = history.value.length <= 1 ? 0 : index / (history.value.length - 1) * 600
  return x + ',' + (110 - sample.value / chartMax.value * 100)
}).join(' '))
function display(value: unknown) {
  if (typeof value === 'number') return Number(value.toFixed(2)).toString()
  return value === undefined || value === null ? '—' : String(value)
}
function exportSnapshot() {
  const snapshot = { exportedAt: new Date().toISOString(), connection: { connected: connection.connected, activeClientId: connection.activeClientId, messagesReceived: connection.messagesReceived, lastMessageTime: connection.lastMessageTime }, selectedRobotId: selection.selectedRobotId, robots: robots.robots, match: match.state, healthSamples: history.value }
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'bnguclient-telemetry-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
  link.click()
  URL.revokeObjectURL(url)
  exportMessage.value = '已导出当前状态快照，不包含连接密码。'
}
</script>

<template>
  <div class="telemetry-page">
    <header class="telemetry-heading"><div><p class="eyebrow">TELEMETRY / LIVE STATE</p><h1>遥测检查</h1><p>只读当前数据链；没有收到的字段显示为「—」，不会填入演示值。</p></div><button @click="exportSnapshot">导出状态快照</button></header>
    <p v-if="exportMessage" class="export-notice" role="status">{{ exportMessage }}</p>
    <div class="telemetry-grid">
      <section class="telemetry-card">
        <h2>显示机器人 <span>{{ selection.selectedRobotName || '未选择' }} / {{ selection.selectedRobotId || '—' }}</span></h2>
        <RobotHealthBar :current-health="robot?.combat.currentHealth ?? null" :max-health="robot?.configuration.maxHealth ?? null" :status="healthFreshness" />
        <dl class="metric-grid"><div><dt>剩余弹量</dt><dd>{{ display(robot?.combat.remainingAmmo) }}</dd></div><div><dt>射击热量</dt><dd>{{ display(robot?.combat.currentHeat) }} / {{ display(robot?.configuration.maxHeat) }}</dd></div><div><dt>底盘能量 / J</dt><dd>{{ display(robot?.combat.currentChassisEnergy) }}</dd></div><div><dt>缓冲能量 / J</dt><dd>{{ display(robot?.combat.currentBufferEnergy) }}</dd></div><div><dt>等级</dt><dd>{{ display(robot?.configuration.level) }}</dd></div><div><dt>位置 / m</dt><dd>{{ display(robot?.pose.position.x) }}, {{ display(robot?.pose.position.y) }}</dd></div></dl>
      </section>
      <section class="telemetry-card"><h2>链路信息</h2><dl class="connection-list"><div><dt>MQTT</dt><dd :class="{ online: connection.connected }">{{ connection.connected ? '已连接' : '未连接' }}</dd></div><div><dt>连接 Client ID</dt><dd>{{ connection.activeClientId ?? '—' }}</dd></div><div><dt>累计接收消息</dt><dd>{{ connection.messagesReceived }}</dd></div><div><dt>最后一条消息</dt><dd>{{ connection.lastMessageTime ? new Date(connection.lastMessageTime).toLocaleTimeString() : '尚未收到' }}</dd></div><div><dt>已记录机器人</dt><dd>{{ Object.keys(robots.robots).length }}</dd></div></dl><p class="card-note">显示机器人与连接身份分别管理；切换显示对象不会修改消息路由。</p></section>
      <section class="telemetry-card history-card"><h2>血量变化 <span>{{ history.length }} / 120 个采样点</span></h2><div v-if="history.length" class="history-chart"><svg viewBox="0 0 600 120" role="img" aria-label="最近血量采样趋势" preserveAspectRatio="none"><path d="M0 10H600 M0 60H600 M0 110H600" class="chart-grid" /><polyline :points="chartPoints" class="chart-line" /><circle v-for="(sample, index) in history" :key="sample.at" :cx="history.length <= 1 ? 0 : index / (history.length - 1) * 600" :cy="110 - sample.value / chartMax * 100" r="2" /></svg></div><div v-else class="telemetry-empty">等待当前机器人的新鲜血量报告</div><p class="card-note">每秒最多采样一次新报告，保留最近 120 点；切换机器人或连接后清空。不是完整报文录制。</p></section>
      <section class="telemetry-card"><h2>模块状态 <span>{{ moduleFreshness === 'fresh' ? '报告有效' : moduleFreshness === 'stale' ? '报告已过期' : '等待报告' }}</span></h2><div class="module-grid"><div v-for="(label, key) in moduleLabels" :key="key" :class="{ online: moduleFreshness === 'fresh' && robot?.modules[key] === 'online', offline: moduleFreshness === 'fresh' && robot?.modules[key] === 'offline' }"><i /><span>{{ label }}</span><small>{{ moduleFreshness !== 'fresh' ? '—' : robot?.modules[key] === 'online' ? '在线' : robot?.modules[key] === 'offline' ? '离线' : '未知' }}</small></div></div></section>
    </div>
    <section class="telemetry-card robot-list"><h2>已接收机器人</h2><div v-if="!Object.keys(robots.robots).length" class="telemetry-empty">连接后等待遥测数据。可在操作中心配置 MQTT。</div><div v-else class="robot-table-scroll"><table><thead><tr><th>机器人 ID</th><th>血量</th><th>热量</th><th>位置 X / Y</th><th>血量有效性</th></tr></thead><tbody><tr v-for="entry in robots.robots" :key="entry.identity.robotId"><td>{{ entry.identity.robotId }}</td><td>{{ display(entry.combat.currentHealth) }} / {{ display(entry.configuration.maxHealth) }}</td><td>{{ display(entry.combat.currentHeat) }}</td><td>{{ display(entry.pose.position.x) }} / {{ display(entry.pose.position.y) }}</td><td>{{ getDataFreshness(entry.healthUpdatedAt, now) === 'fresh' ? '新鲜' : getDataFreshness(entry.healthUpdatedAt, now) === 'stale' ? '已过期' : '未收到' }}</td></tr></tbody></table></div></section>
  </div>
</template>

<style scoped>
.telemetry-page { color: #d7e7ed; padding: 30px; max-width: 1350px; margin: 0 auto; }
.telemetry-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; }
.eyebrow { font: 11px var(--font-tech-mono); letter-spacing: .12em; color: #86a5b4; }
h1 { font-size: 27px; font-weight: 500; margin: 12px 0 10px; }
.telemetry-heading p:last-child, .card-note { font-size: 12px; color: #8faab7; line-height: 1.8; }
button { border: 1px solid #6d8e9a88; background: #1e343f; color: #bfe4eb; border-radius: 4px; padding: 10px 16px; cursor: pointer; white-space: nowrap; }
button:hover { background: #2b4856; } button:focus-visible { outline: 2px solid #b1dfe5; outline-offset: 3px; }
.telemetry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.telemetry-card { padding: 23px; border: 1px solid #46616e66; background: #14242c88; border-radius: 4px; min-width: 0; }
h2 { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; font-weight: 500; margin-bottom: 24px; }
h2 span { font-size: 10px; color: #8faab7; }
.metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
dt { font-size: 11px; color: #8faab7; } dd { margin: 5px 0 0; font: 20px var(--font-tech-mono); overflow-wrap: anywhere; }
.connection-list > div { display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-bottom: 13px; }
.connection-list dd { font-size: 14px; margin: 0; }
.card-note { margin-top: 16px; }
.online { color: #b4d9b2; }
.telemetry-empty { display: grid; min-height: 130px; place-items: center; color: #7f9eac; font-size: 12px; text-align: center; }
.history-chart { height: 140px; padding: 10px 4px; } .history-chart svg { width: 100%; height: 100%; overflow: visible; }
.chart-grid { stroke: #38546066; fill: none; } .chart-line { stroke: #b1dfe5; stroke-width: 2; fill: none; vector-effect: non-scaling-stroke; }
.history-chart circle { fill: #b1dfe5; }
.module-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.module-grid > div { display: flex; gap: 8px; align-items: center; color: #829aa5; font-size: 11px; }
.module-grid i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.module-grid small { margin-left: auto; font-size: 10px; }
.module-grid .offline { color: #d29c97; }
.robot-list { margin-top: 18px; } .robot-table-scroll { overflow: auto; }
table { width: 100%; text-align: left; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
th { color: #8faab7; font-weight: 400; } td, th { padding: 12px; border-bottom: 1px solid #38546066; }
.export-notice { color: #b4d9b2; font-size: 12px; margin: 0 0 18px; }
@media (max-width: 1050px) { .telemetry-grid { grid-template-columns: 1fr; } }
@media (max-width: 700px) { .telemetry-page { padding: 20px 16px; } .telemetry-heading { flex-direction: column; } .telemetry-card { padding: 16px; } .module-grid { gap: 12px; } }
</style>
