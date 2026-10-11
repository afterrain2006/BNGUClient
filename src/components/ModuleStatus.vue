<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/store'

const store = useDashboardStore()
const { cameraStatus, mqttStatus, udpStats, videoSource } = storeToRefs(store)
const cameraStatusClass = computed(() => store.cameraStatusClass)
const mqttStatusText = computed(() => ({
  connected: '已连接', connecting: '连接中', disconnected: '未连接', error: '连接异常'
})[mqttStatus.value])
const mqttStatusClass = computed(() => mqttStatus.value === 'connected'
  ? 'status-active' : mqttStatus.value === 'error' ? 'status-error' : 'status-warning')
</script>

<template>
  <div class="module-status-container">
    <div class="status-row">
      <span>视频:</span>
      <span class="value status-badge" :class="cameraStatusClass">{{ cameraStatus }}</span>
    </div>
    <div class="status-row">
      <span>MQTT:</span>
      <span class="value status-badge" :class="mqttStatusClass">{{ mqttStatusText }}</span>
    </div>
    <div v-if="videoSource === 'udp'" class="status-row">
      <span>图传帧率:</span>
      <span class="value">{{ udpStats.fps.toFixed(1) }} FPS</span>
    </div>
  </div>
</template>

<style scoped>
.module-status-container { display: flex; flex-direction: column; gap: 8px; padding: 4px; }
.status-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: rgba(255, 255, 255, 0.8); padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.status-row:last-child { border-bottom: none; }
.value { font-family: 'JetBrains Mono', monospace; font-weight: 500; }
.status-badge { padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); font-size: 12px; }
.status-active { color: #10b981; background: rgba(16,185,129,0.1); }
.status-warning { color: #f59e0b; background: rgba(245,158,11,0.1); }
.status-error { color: #ef4444; background: rgba(239,68,68,0.1); }
</style>
