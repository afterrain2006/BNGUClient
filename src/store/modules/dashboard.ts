/**
 * Dashboard Pinia Store
 * 统一管理 Dashboard 模块的状态、配置和业务逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// ==================== 类型导入 ====================
import type {
  VideoSource,
  TabType,
  TeamType,
  UdpConfig,
  UdpStats,
  MqttConfig,
  MqttMessage,
  MqttStats,
  GlobalConfig,
  GlobalState,
  MatchStatus,
  Score,
  RobotStatusFlags
} from '@/components/Dashboard/types'

// ==================== 常量导入 ====================
import {
  DEFAULT_UDP_CONFIG,
  DEFAULT_MQTT_CONFIG,
  DEFAULT_UDP_STATS,
  DEFAULT_MQTT_STATS,
  DEFAULT_VIDEO_STATUS,
  DEFAULT_CAMERA_STATUS,
  DEFAULT_ROBOT_HEALTH,
  DEFAULT_ROBOT_LEVEL,
  DEFAULT_ROBOT_AMMO,
  DEFAULT_BUFFER_ENERGY,
  DEFAULT_CAPACITOR_ENERGY,
  DEFAULT_EXCHANGEABLE_AMMO,
  MAX_MQTT_MESSAGES,
  DEFAULT_MATCH_DURATION,
  DEFAULT_SCORE,
  DEFAULT_ROBOT_STATUS_FLAGS
} from '@/components/Dashboard/constants'

// ==================== Store 定义 ====================
export const useDashboardStore = defineStore('dashboard', () => {
  // ==================== 全局配置状态 ====================
  /**
   * globalConfig: 统一管理所有配置参数
   */
  const globalConfig = ref<GlobalConfig>({
    udp: { ...DEFAULT_UDP_CONFIG },
    mqtt: { ...DEFAULT_MQTT_CONFIG }
  })

  /**
   * globalState: 统一管理所有运行时状态
   */
  const globalState = ref<GlobalState>({
    videoSource: 'udp',
    videoConnected: false,
    udpStreamStatus: 'disconnected',
    mqttStatus: 'disconnected'
  })

  // ==================== UI 状态 ====================
  const isSettingsVisible = ref(false)
  const isCrosshairSettingsVisible = ref(false)
  const isAmmoPurchaseVisible = ref(false)
  const isRemoteAmmoPurchaseVisible = ref(false)
  const activeTab = ref<TabType>('video')
  const isHudInteractive = ref(false)
  const isDrawingMode = ref(false)
  // 调试模式：启用后设置面板会显示 MQTT 指令发送等内部调试工具
  const DEBUG_MODE_STORAGE_KEY = 'bnguclient.debugMode'
  const isDebugMode = ref<boolean>(
    (() => {
      try {
        return localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === '1'
      } catch {
        return false
      }
    })()
  )
  watch(isDebugMode, (value) => {
    try {
      localStorage.setItem(DEBUG_MODE_STORAGE_KEY, value ? '1' : '0')
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  })

  // ==================== 视频状态 ====================
  const videoStatus = ref(DEFAULT_VIDEO_STATUS)
  const cameraStatus = ref(DEFAULT_CAMERA_STATUS)
  const videoSource = ref<VideoSource>('udp')
  const videoFilePath = ref('')
  const selectedCameraId = ref('')
  const isConnecting = ref(false)
  const wasConnected = ref(false)
  const videoElement = ref<HTMLVideoElement | null>(null)
  const videoSize = ref({ width: 0, height: 0 }) // 视频尺寸

  // ==================== UDP 状态 ====================
  const udpStreamStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const udpStats = ref<UdpStats>({ ...DEFAULT_UDP_STATS })

  // ==================== MQTT 状态 ====================
  const mqttStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const mqttMessages = ref<MqttMessage[]>([])
  const mqttStats = ref<MqttStats>({ ...DEFAULT_MQTT_STATS })
  const useLocalBroker = ref(false)
  const localBrokerPort = ref(1883)
  const localBrokerStatus = ref<'stopped' | 'starting' | 'running' | 'error'>('stopped')

  // ==================== 机器人状态 ====================
  const robotTypes = ref<string[]>([])
  const selectedRobot = ref('')
  const robotHealth = ref(DEFAULT_ROBOT_HEALTH)
  const robotMaxHealth = ref(DEFAULT_ROBOT_HEALTH)
  const robotLevel = ref(DEFAULT_ROBOT_LEVEL)
  const remainingAmmo = ref(DEFAULT_ROBOT_AMMO)
  const exchangeableAmmo = ref(DEFAULT_EXCHANGEABLE_AMMO)
  const bufferEnergy = ref(DEFAULT_BUFFER_ENERGY)
  const capacitorEnergy = ref(DEFAULT_CAPACITOR_ENERGY)

  // ==================== 比赛状态 (StatusBar) ====================
  const matchStatus = ref<MatchStatus>('waiting')
  const matchRemainingTime = ref(DEFAULT_MATCH_DURATION)
  const score = ref<Score>({ ...DEFAULT_SCORE })
  const robotStatusFlags = ref<RobotStatusFlags>({ ...DEFAULT_ROBOT_STATUS_FLAGS })
  const showRemainingTime = ref(true)
  let matchTimer: ReturnType<typeof setInterval> | null = null

  // ==================== 计算属性 ====================

  /**
   * UDP 配置 (映射到 globalConfig)
   */
  const udpConfig = computed({
    get: () => globalConfig.value.udp,
    set: (val: UdpConfig) => {
      globalConfig.value.udp = val
    }
  })

  /**
   * MQTT 配置 (映射到 globalConfig)
   */
  const mqttConfig = computed({
    get: () => globalConfig.value.mqtt,
    set: (val: MqttConfig) => {
      globalConfig.value.mqtt = val
    }
  })

  /**
   * 根据机器人名称判断所属队伍
   */
  const selectedTeam = computed<TeamType>(() => {
    const name = selectedRobot.value
    if (name.includes('红')) return 'red'
    if (name.includes('蓝')) return 'blue'
    return null
  })

  /**
   * 摄像头状态样式类
   */
  const cameraStatusClass = computed(() => {
    const status = cameraStatus.value
    if (status.includes('直连') || status.includes('UDP') || status.includes('播放中')) return 'status-active'
    if (status.includes('未连接')) return 'status-idle'
    if (status.includes('错误') || status.includes('失败')) return 'status-error'
    return 'status-warning'
  })

  // ==================== Actions ====================

  /**
   * 更新 UDP 配置
   */
  function updateUdpConfig(config: Partial<UdpConfig>): void {
    globalConfig.value.udp = {
      ...globalConfig.value.udp,
      ...config
    }
  }

  /**
   * 更新 MQTT 配置
   */
  function updateMqttConfig(config: Partial<MqttConfig>): void {
    globalConfig.value.mqtt = {
      ...globalConfig.value.mqtt,
      ...config
    }
  }

  /**
   * 设置视频源
   */
  function setVideoSource(source: VideoSource): void {
    videoSource.value = source
    globalState.value.videoSource = source
  }

  /**
   * 设置视频连接状态
   */
  function setVideoConnected(connected: boolean): void {
    wasConnected.value = connected
    globalState.value.videoConnected = connected

    if (connected) {
      cameraStatus.value =
        videoSource.value === 'camera'
          ? '摄像头 (直连)'
          : videoSource.value === 'file'
            ? '视频文件播放中'
            : `UDP (${globalConfig.value.udp.port})`
    } else {
      cameraStatus.value = DEFAULT_CAMERA_STATUS
    }
  }

  /**
   * 设置视频文件路径
   */
  function setVideoFilePath(path: string): void {
    videoFilePath.value = path
  }

  /**
   * 设置选中的摄像头 ID
   */
  function setSelectedCameraId(id: string): void {
    selectedCameraId.value = id
  }

  /**
   * 设置视频元素引用
   */
  function setVideoElement(element: HTMLVideoElement | null): void {
    videoElement.value = element
  }

  /**
   * 设置 UDP 流状态
   */
  function setUdpStreamStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error'): void {
    udpStreamStatus.value = status
    globalState.value.udpStreamStatus = status
  }

  /**
   * 更新 UDP 统计信息
   */
  function updateUdpStats(stats: Partial<UdpStats>): void {
    udpStats.value = {
      ...udpStats.value,
      ...stats
    }
  }

  /**
   * 重置 UDP 统计信息
   */
  function resetUdpStats(): void {
    udpStats.value = { ...DEFAULT_UDP_STATS }
  }

  /**
   * 设置 MQTT 状态
   */
  function setMqttStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error'): void {
    mqttStatus.value = status
    globalState.value.mqttStatus = status
  }

  /**
   * 添加 MQTT 消息
   */
  function addMqttMessage(message: MqttMessage): void {
    mqttMessages.value.unshift(message)
    if (mqttMessages.value.length > MAX_MQTT_MESSAGES) {
      mqttMessages.value.pop()
    }
    mqttStats.value.messagesReceived++
    mqttStats.value.lastMessageTime = Date.now()
  }

  /**
   * 清空 MQTT 消息
   */
  function clearMqttMessages(): void {
    mqttMessages.value = []
  }

  /**
   * 更新 MQTT 统计信息
   */
  function updateMqttStats(stats: Partial<MqttStats>): void {
    mqttStats.value = {
      ...mqttStats.value,
      ...stats
    }
  }

  /**
   * 设置本地 Broker 状态
   */
  function setLocalBrokerStatus(status: 'stopped' | 'starting' | 'running' | 'error'): void {
    localBrokerStatus.value = status
  }

  /**
   * 设置机器人类型列表
   */
  function setRobotTypes(types: string[]): void {
    robotTypes.value = types
    if (types.length > 0 && !selectedRobot.value) {
      selectedRobot.value = types[0]
    }
  }

  /**
   * 选择机器人
   */
  function selectRobot(robot: string): void {
    selectedRobot.value = robot
  }

  /**
   * 更新机器人血量
   */
  function updateRobotHealth(health: number, maxHealth?: number): void {
    robotHealth.value = health
    if (maxHealth !== undefined) {
      robotMaxHealth.value = maxHealth
    }
  }

  /**
   * 更新机器人等级
   */
  function updateRobotLevel(level: number): void {
    robotLevel.value = level
  }

  /**
   * 更新机器人能量
   */
  function updateRobotEnergy(buffer: number, capacitor: number): void {
    bufferEnergy.value = buffer
    capacitorEnergy.value = capacitor
  }

  /**
   * 更新弹药数量
   */
  function updateAmmo(remaining: number, exchangeable?: number): void {
    remainingAmmo.value = remaining
    if (exchangeable !== undefined) {
      exchangeableAmmo.value = exchangeable
    }
  }

  /**
   * 购买弹药
   */
  function purchaseAmmo(amount: number): number {
    const actualAmount = Math.min(amount, exchangeableAmmo.value)
    exchangeableAmmo.value -= actualAmount
    remainingAmmo.value += actualAmount
    console.log(
      `[DashboardStore] 购买弹丸: ${actualAmount} 发，剩余可兑换: ${exchangeableAmmo.value}`
    )
    return actualAmount
  }

  /**
   * 切换设置菜单可见性
   */
  function toggleSettings(): void {
    isSettingsVisible.value = !isSettingsVisible.value
  }

  /**
   * 设置活动标签页
   */
  function setActiveTab(tab: TabType): void {
    activeTab.value = tab
  }

  /**
   * 切换 HUD 交互模式
   */
  function toggleHudInteractive(): void {
    isHudInteractive.value = !isHudInteractive.value
  }

  /**
   * 设置 HUD 交互模式
   */
  function setHudInteractive(interactive: boolean): void {
    isHudInteractive.value = interactive
  }

  /**
   * 设置绘图模式
   */
  function setDrawingMode(mode: boolean): void {
    isDrawingMode.value = mode
  }

  // ==================== 比赛状态 Actions ====================

  /**
   * 格式化剩余时间为 MM:SS
   */
  const formattedMatchTime = computed(() => {
    const minutes = Math.floor(matchRemainingTime.value / 60)
    const seconds = matchRemainingTime.value % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  /**
   * 设置比赛状态
   */
  function setMatchStatus(status: MatchStatus): void {
    const oldStatus = matchStatus.value
    matchStatus.value = status

    if (status === 'running' && oldStatus !== 'running') {
      startMatchTimer()
    } else if (status !== 'running' && oldStatus === 'running') {
      stopMatchTimer()
    }

    // 重置时间（如果需要）
    if (status === 'waiting') {
      matchRemainingTime.value = DEFAULT_MATCH_DURATION
    }
  }

  /**
   * 启动比赛计时器
   */
  function startMatchTimer(): void {
    if (matchTimer || matchStatus.value !== 'running') return

    matchTimer = setInterval(() => {
      if (matchRemainingTime.value > 0) {
        matchRemainingTime.value--
      } else {
        stopMatchTimer()
        matchStatus.value = 'waiting'
      }
    }, 1000)
  }

  /**
   * 停止比赛计时器
   */
  function stopMatchTimer(): void {
    if (matchTimer) {
      clearInterval(matchTimer)
      matchTimer = null
    }
  }

  /**
   * 更新比分
   */
  function updateScore(team: 'red' | 'blue', increment: number): void {
    if (team === 'red') {
      score.value.red = Math.max(0, score.value.red + increment)
    } else {
      score.value.blue = Math.max(0, score.value.blue + increment)
    }
  }

  /**
   * 重置比分
   */
  function resetScore(): void {
    score.value = { ...DEFAULT_SCORE }
  }

  /**
   * 更新机器人状态标志
   */
  function updateRobotStatusFlags(flags: Partial<RobotStatusFlags>): void {
    Object.assign(robotStatusFlags.value, flags)
  }

  /**
   * 弹丸购买操作
   */
  function purchaseAmmoFromExchange(amount: number): void {
    const actualAmount = Math.min(amount, exchangeableAmmo.value)
    if (actualAmount > 0) {
      remainingAmmo.value += actualAmount
      exchangeableAmmo.value -= actualAmount
      console.log(`[Store] 购买弹丸: ${actualAmount}，当前弹量: ${remainingAmmo.value}`)
    }
  }

  /**
   * 重置所有状态到默认值
   */
  function resetState(): void {
    // 重置 globalConfig
    globalConfig.value = {
      udp: { ...DEFAULT_UDP_CONFIG },
      mqtt: { ...DEFAULT_MQTT_CONFIG }
    }

    // 重置 globalState
    globalState.value = {
      videoSource: 'udp',
      videoConnected: false,
      udpStreamStatus: 'disconnected',
      mqttStatus: 'disconnected'
    }

    // 重置其他状态
    udpStats.value = { ...DEFAULT_UDP_STATS }
    mqttStats.value = { ...DEFAULT_MQTT_STATS }
    mqttMessages.value = []

    console.log('[DashboardStore] 状态已重置')
  }

  // ==================== 返回 Store ====================
  return {
    // 全局配置
    globalConfig,
    globalState,

    // UI 状态
    isSettingsVisible,
    isCrosshairSettingsVisible,
    isAmmoPurchaseVisible,
    isRemoteAmmoPurchaseVisible,
    activeTab,
    isHudInteractive,
    isDrawingMode,
    isDebugMode,

    // 视频状态
    videoStatus,
    cameraStatus,
    videoSource,
    videoFilePath,
    selectedCameraId,
    isConnecting,
    wasConnected,
    videoElement,
    videoSize,

    // UDP 状态
    udpStreamStatus,
    udpStats,

    // MQTT 状态
    mqttStatus,
    mqttMessages,
    mqttStats,
    useLocalBroker,
    localBrokerPort,
    localBrokerStatus,

    // 机器人状态
    robotTypes,
    selectedRobot,
    robotHealth,
    robotMaxHealth,
    robotLevel,
    remainingAmmo,
    exchangeableAmmo,
    bufferEnergy,
    capacitorEnergy,

    // 比赛状态 (StatusBar)
    matchStatus,
    matchRemainingTime,
    score,
    robotStatusFlags,
    showRemainingTime,
    formattedMatchTime,

    // 计算属性
    udpConfig,
    mqttConfig,
    selectedTeam,
    cameraStatusClass,

    // Actions - 配置更新
    updateUdpConfig,
    updateMqttConfig,

    // Actions - 视频控制
    setVideoSource,
    setVideoConnected,
    setVideoFilePath,
    setSelectedCameraId,
    setVideoElement,

    // Actions - UDP 控制
    setUdpStreamStatus,
    updateUdpStats,
    resetUdpStats,

    // Actions - MQTT 控制
    setMqttStatus,
    addMqttMessage,
    clearMqttMessages,
    updateMqttStats,
    setLocalBrokerStatus,

    // Actions - 机器人控制
    setRobotTypes,
    selectRobot,
    updateRobotHealth,
    updateRobotLevel,
    updateRobotEnergy,
    updateAmmo,
    purchaseAmmo,

    // Actions - UI 控制
    toggleSettings,
    setActiveTab,
    toggleHudInteractive,
    setHudInteractive,
    setDrawingMode,

    // Actions - 比赛状态控制
    setMatchStatus,
    startMatchTimer,
    stopMatchTimer,
    updateScore,
    resetScore,
    updateRobotStatusFlags,
    purchaseAmmoFromExchange,

    // Actions - 重置
    resetState
  }
})

// ==================== 类型导出 ====================
export type DashboardStore = ReturnType<typeof useDashboardStore>
