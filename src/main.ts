import './assets/main.css'
import './assets/modals.css'


import { createApp, watch } from 'vue'
import App from './App.vue'
import pinia from './store'
import { addLog } from './store/log'
import { startMqttRule } from './input/mqttRuleRunner'
import { createRm2026RuleLifecycle } from './input/rm2026RuleLifecycle'
import { mqttAdapter } from './adaptor/tauri/mqttAdapter'
import { useRobotStore } from './stores/robotStore'
import { useMatchStore } from './stores/matchStore'
import { useCustomDataStore } from './stores/customDataStore'
import { useConnectionStore } from './stores/connectionStore'
import type { UnlistenFn } from '@tauri-apps/api/event'

let stopMqttStatus: UnlistenFn | undefined
let mqttRuleDisposed = false
const rm2026RuleLifecycle = createRm2026RuleLifecycle(
  startMqttRule,
  () => {
    useRobotStore(pinia).invalidateSessionFreshness()
    useMatchStore(pinia).reset()
    useCustomDataStore(pinia).clear()
  },
  team => { useConnectionStore(pinia).perspectiveTeam = team }
)

import.meta.hot?.dispose(() => {
  mqttRuleDisposed = true
  stopMqttStatus?.()
  stopMqttStatus = undefined
  rm2026RuleLifecycle.dispose()
})

function observeRobotStateInDev(): void {
  if (!import.meta.env.DEV) return

  const robotStore = useRobotStore()
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest: Array<{
    robotId: number
    level?: number
    position: { x?: number; y?: number; z?: number }
    yaw?: number
    currentHealth?: number
  }> = []

  const stop = watch(
    () => Object.values(robotStore.robots).map(robot => ({
      robotId: robot.identity.robotId,
      level: robot.configuration.level,
      position: { ...robot.pose.position },
      yaw: robot.pose.yaw,
      currentHealth: robot.combat.currentHealth
    })),
    snapshot => {
      latest = snapshot
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        console.debug('[RobotState DEV]', latest)
      }, 1000)
    }
  )

  import.meta.hot?.dispose(() => {
    stop()
    if (timer !== undefined) clearTimeout(timer)
  })
}

// --- 新增: 覆盖 console 函数 ---
const originalLog = console.log
console.log = (...args: unknown[]) => {
  addLog('log', ...args)
  originalLog.apply(console, args)
}

const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  addLog('warn', ...args)
  originalWarn.apply(console, args)
}

const originalError = console.error
console.error = (...args: unknown[]) => {
  addLog('error', ...args)
  originalError.apply(console, args)
}
// --- 结束 ---

// 创建 Vue 应用并注册 Pinia
async function bootstrap(): Promise<void> {
  const startupAt = performance.now()
  const apiShimAt = performance.now()
  await import('./api-shim')
  console.log(`[startup] api-shim loaded in ${(performance.now() - apiShimAt).toFixed(1)}ms`)

  const app = createApp(App)
  app.use(pinia)
  app.mount('#app')
  observeRobotStateInDev()
  console.log(`[startup] vue mounted in ${(performance.now() - startupAt).toFixed(1)}ms`)

  try {
    const connectionStore = useConnectionStore(pinia)
    let lastConnectionRevision = -1
    const reconcileStatus = (status: Awaited<ReturnType<typeof mqttAdapter.getStatus>>) => {
      if (!Number.isSafeInteger(status.revision) || status.revision <= lastConnectionRevision) return
      lastConnectionRevision = status.revision
      connectionStore.connected = status.connected
      connectionStore.activeClientId = status.connected ? status.clientId : null
      rm2026RuleLifecycle.reconcile(status)
    }
    const unlisten = await mqttAdapter.onStatus(reconcileStatus)
    if (mqttRuleDisposed) {
      unlisten()
    } else {
      stopMqttStatus = unlisten
      try {
        reconcileStatus(await mqttAdapter.getStatus())
      } catch (error) {
        console.warn('[startup] MQTT status snapshot unavailable', error)
      }
    }
  } catch (error) {
    console.warn('[startup] RM2026 MQTT status listener unavailable', error)
  }

  // Signal the Rust side to reveal the window now that the UI is mounted,
  // eliminating the initial white flash.
  try {
    const { emit } = await import('@tauri-apps/api/event')
    await emit('frontend-ready')
    console.log(`[startup] frontend-ready emitted in ${(performance.now() - startupAt).toFixed(1)}ms`)
  } catch {
    // Non-Tauri environment (e.g., plain `vite` dev) — safe to ignore.
  }
}

void bootstrap()
