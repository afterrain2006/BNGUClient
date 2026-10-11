<script setup lang="ts">
import { computed } from 'vue'
import { useRobotStore } from '@/stores/robotStore'
import { useRobotSelectionStore } from '@/stores/robotSelectionStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMatchStore } from '@/stores/matchStore'
import { useDashboardStore } from '@/store'
import { getDataFreshness, useFreshnessClock } from '@/composables/useFreshnessClock'
import RobotHealthBar from './Dashboard/RobotStatus/RobotHealthBar.vue'
import MiniMap from './Dashboard/MiniMap.vue'

defineProps<{ focusMode: boolean }>()
const robots = useRobotStore()
const selection = useRobotSelectionStore()
const connection = useConnectionStore()
const match = useMatchStore()
const dashboard = useDashboardStore()
const now = useFreshnessClock()
const robot = computed(() => robots.getRobot(selection.selectedRobotId))
const healthFreshness = computed(() => getDataFreshness(robot.value?.healthUpdatedAt ?? 0, now.value))
const stageNames: Record<string, string> = { 'not-started': '未开始', preparation: '准备阶段', 'self-check': '自检阶段', countdown: '开赛倒计时', fighting: '比赛中', settlement: '结算阶段', unknown: '阶段未知' }
const countdown = computed(() => {
  const seconds = match.state.status.countdownSeconds
  if (seconds === undefined) return '—:—'
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
})
const linkLabel = computed(() => !connection.connected ? 'OFFLINE · 未连接' : !connection.lastMessageTime ? 'MQTT 已连接 · 等待消息' : now.value - connection.lastMessageTime > 3000 ? 'MQTT 已连接 · 消息已过期' : 'LIVE · 正在接收')
const videoFresh = computed(() => dashboard.udpStreamStatus === 'connected' && dashboard.udpStats.lastFrameTime > 0 && now.value - dashboard.udpStats.lastFrameTime < 3000)
const heatPercent = computed(() => {
  const heat = robot.value?.combat.currentHeat
  const max = robot.value?.configuration.maxHeat
  return heat === undefined || max === undefined || max <= 0 ? 0 : Math.max(0, Math.min(100, heat / max * 100))
})
</script>

<template>
  <div class="cockpit-overlay" :class="{ focused: focusMode }">
    <header class="cockpit-identity"><strong>BNGUCLIENT <span>//</span> {{ selection.selectedRobotId || '—' }}</strong><small>{{ selection.selectedRobotName || '尚未选择显示机器人' }}</small><span class="cockpit-link" :class="{ online: connection.connected }"><i />{{ linkLabel }}</span></header>
    <section class="cockpit-match" aria-label="比赛状态"><span class="score red">{{ match.state.status.redScore ?? '—' }}</span><div><strong>{{ countdown }}</strong><small>{{ match.state.status.paused ? '比赛暂停' : stageNames[match.state.status.stage ?? 'unknown'] }}</small></div><span class="score blue">{{ match.state.status.blueScore ?? '—' }}</span></section>
    <section class="cockpit-unit" aria-label="当前机器人状态">
      <div class="unit-heading"><span>当前机器人</span><span>{{ healthFreshness === 'fresh' ? '血量已同步' : healthFreshness === 'stale' ? '血量已过期' : '等待血量' }}</span></div>
      <div class="unit-hp">{{ robot?.combat.currentHealth ?? '—' }}<small>/ {{ robot?.configuration.maxHealth ?? '—' }}</small></div>
      <RobotHealthBar :current-health="robot?.combat.currentHealth ?? null" :max-health="robot?.configuration.maxHealth ?? null" :status="healthFreshness" />
      <div class="unit-metrics"><div><span>剩余弹量</span><strong>{{ robot?.combat.remainingAmmo ?? '—' }}<small>发</small></strong></div><div><span>底盘能量</span><strong>{{ robot?.combat.currentChassisEnergy ?? '—' }}<small>J</small></strong></div></div>
      <div class="unit-heat"><span>射击热量</span><span>{{ robot?.combat.currentHeat?.toFixed(1) ?? '—' }} / {{ robot?.configuration.maxHeat ?? '—' }}</span></div><div class="heat-track"><i :style="{ width: heatPercent + '%' }" /></div>
    </section>
    <section class="cockpit-map" aria-label="场地位置示意"><div class="unit-heading"><span>场地位置</span><span>示意</span></div><div class="cockpit-map-canvas"><MiniMap :show-legend="false" /></div><p>X {{ robot?.pose.position.x?.toFixed(2) ?? '—' }} · Y {{ robot?.pose.position.y?.toFixed(2) ?? '—' }} · {{ getDataFreshness(robot?.poseUpdatedAt ?? 0, now) === 'fresh' ? '位置已同步' : '等待新鲜位置' }}</p><small>地图标定需实机核对</small></section>
    <footer class="cockpit-footer"><span>连接身份 {{ connection.activeClientId ?? '—' }} · RX {{ connection.messagesReceived }}</span><span>{{ videoFresh ? dashboard.udpStats.fps.toFixed(0) + ' FPS' : '— FPS' }} · {{ dashboard.cameraStatus }}</span></footer>
  </div>
</template>

<style scoped>
.cockpit-overlay { position: absolute; inset: 0; z-index: 60; pointer-events: none; color: #d6e8ed; text-shadow: 0 1px 5px #000; }
.cockpit-identity { position: absolute; left: 28px; top: 24px; display: flex; flex-direction: column; gap: 7px; }
.cockpit-identity strong { font: 18px var(--font-tech-mono); letter-spacing: .14em; }
.cockpit-identity strong span { color: #acdce5; }
.cockpit-identity small { color: #92b0bd; font-size: 11px; }
.cockpit-link { display: flex; align-items: center; gap: 7px; width: fit-content; padding: 4px 8px; border-left: 2px solid #7c939d; background: #0b1821b8; font-size: 10px; color: #93a9b3; }
.cockpit-link i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.cockpit-link.online { border-color: #b0d6b3; color: #badbbd; }
.cockpit-match { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: 24px; width: 320px; padding: 8px 24px; border-top: 1px solid #92bac75c; background: linear-gradient(90deg, transparent, #0b1922c9 20%, #0b1922c9 80%, transparent); }
.cockpit-match > div { display: flex; flex-direction: column; align-items: center; }
.cockpit-match strong { font: 30px var(--font-tech-mono); letter-spacing: .1em; }
.cockpit-match small { font-size: 10px; color: #a8bbc4; }
.score { font: 25px var(--font-tech-mono); } .red { color: #d29c97; } .blue { color: #93bbd4; }
.cockpit-unit { position: absolute; bottom: 56px; left: 28px; width: 270px; padding: 15px 18px; border-left: 2px solid #aadee477; background: linear-gradient(100deg,#07131be6,#07131b80); }
.unit-heading { display: flex; justify-content: space-between; gap: 8px; color: #93aeb9; font-size: 10px; }
.unit-hp { font: 44px var(--font-tech-mono); margin-top: 9px; color: #b8e7ed; }
.unit-hp small { font-size: 15px; margin-left: 10px; color: #91a9b0; }
.cockpit-unit :deep(.health-text) { display: none; }
.cockpit-unit :deep(.health-bar-wrapper) { height: 16px; }
.cockpit-unit :deep(.health-state) { display: none; }
.unit-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; padding-bottom: 16px; }
.unit-metrics > div { display: flex; flex-direction: column; gap: 3px; }
.unit-metrics > div + div { border-left: 1px solid #38546088; padding-left: 16px; }
.unit-metrics span, .unit-heat { color: #9bb2bd; font-size: 11px; }
.unit-metrics strong { font: 24px var(--font-tech-mono); } .unit-metrics small { font-size: 10px; color: #91a9b0; margin-left: 6px; }
.unit-heat { display: flex; justify-content: space-between; }
.heat-track { height: 3px; background: #38546077; margin-top: 8px; } .heat-track i { display: block; height: 100%; background: #d6c79c; }
.cockpit-map { position: absolute; bottom: 56px; right: 28px; width: 220px; padding: 12px; border: 1px solid #7697a433; background: #07131bc9; }
.cockpit-map-canvas { height: 125px; margin-top: 8px; }
.cockpit-map p { font: 10px var(--font-tech-mono); margin-top: 7px; color: #a3bac6; line-height: 1.7; }
.cockpit-map small { display: block; margin-top: 5px; font-size: 9px; color: #7894a2; }
.cockpit-footer { position: absolute; bottom: 16px; left: 28px; right: 28px; display: flex; justify-content: space-between; gap: 16px; color: #91a9b4; font: 10px var(--font-tech-mono); }
.focused .cockpit-unit, .focused .cockpit-map { display: none; }
@media (max-width: 480px) { .cockpit-footer > span:last-child { display: none; } }
@media (max-width: 1100px) { .cockpit-unit { width: 230px; } .cockpit-map { width: 185px; } .cockpit-match { width: 260px; } }
@media (max-width: 700px) { .cockpit-identity { left: 16px; top: 16px; } .cockpit-match { top: 112px; width: 250px; } .cockpit-unit { width: 190px; left: 16px; bottom: 65px; padding: 12px; } .unit-hp { font-size: 34px; } .unit-metrics { gap: 10px; } .unit-metrics strong { font-size: 20px; } .cockpit-map { right: 16px; width: 145px; bottom: 65px; } .cockpit-map-canvas { height: 90px; } .cockpit-map p { line-height: 1.7; } .cockpit-footer { left: 16px; right: 16px; font-size: 9px; bottom: 12px; } }
@media (max-height: 600px) { .cockpit-unit { bottom: 40px; } .cockpit-map { bottom: 40px; } }
</style>
