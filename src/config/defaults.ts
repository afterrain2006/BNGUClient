/**
 * Dashboard 组件常量定义
 * 包含视频约束、MQTT 与 UDP 等配置常量
 */

// ==================== 视频配置常量 ====================

/**
 * 视频约束配置
 */
export const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 }
} as const

// ==================== 准星显示常量 ====================

/**
 * 环形半径
 */
export const RING_RADIUS = 36

// ==================== UDP 图传配置常量 ====================

/**
 * 默认 UDP 配置
 */
export const DEFAULT_UDP_CONFIG = {
  host: '0.0.0.0',
  sourceHost: '',
  port: 3334,
  bufferSize: 4 * 1024 * 1024,
  codec: 'auto' as const
}

/**
 * UDP 编码类型选项
 */
export const UDP_CODEC_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'mjpeg', label: 'MJPEG' },
  { value: 'h264', label: 'H.264（前端解码已移除）', disabled: true },
  { value: 'h265', label: 'H.265 (HEVC，后端解码)' }
] as const

// ==================== MQTT 配置常量 ====================

/**
 * 默认 MQTT 配置
 * 主题名称直接使用 Proto 消息名称，无前缀
 */
export { DEFAULT_MQTT_CONFIG } from '@rules/rm2026'

/**
 * 默认本地 MQTT Broker 端口
 */
export const DEFAULT_LOCAL_BROKER_PORT = 1883

/**
 * 最大 MQTT 消息数量
 */
export const MAX_MQTT_MESSAGES = 50

// ==================== 机器人状态常量 ====================

/**
 * 默认机器人血量
 */
export const DEFAULT_ROBOT_HEALTH = 200

/**
 * 默认机器人等级
 */
export const DEFAULT_ROBOT_LEVEL = 1

/**
 * 默认机器人弹药
 */
export const DEFAULT_ROBOT_AMMO = 500

/**
 * 默认超电容量
 */
export const DEFAULT_CAPACITOR_ENERGY = 0

/**
 * 默认最大超电容量
 */
export const DEFAULT_MAX_CAPACITOR_ENERGY = 150

/**
 * 默认缓冲能量
 */
export const DEFAULT_BUFFER_ENERGY = 60

/**
 * 默认最大缓冲能量
 */
export const DEFAULT_MAX_BUFFER_ENERGY = 60

/**
 * 默认可兑换弹量
 */
export const DEFAULT_EXCHANGEABLE_AMMO = 100

// ==================== UI 常量 ====================

/**
 * 默认视频状态文本
 */
export const DEFAULT_VIDEO_STATUS = '按 Esc 打开操作菜单，配置图传与连接'

/**
 * 默认摄像头状态
 */
export const DEFAULT_CAMERA_STATUS = '未连接'

// ==================== 虚拟摄像头过滤关键词 ====================

/**
 * 虚拟摄像头过滤关键词
 */
export const VIRTUAL_CAMERA_KEYWORDS = ['virtual', 'obs', 'eshare', 'snap camera'] as const

// ==================== UDP 统计常量 ====================

/**
 * 默认 UDP 统计信息
 */
export const DEFAULT_UDP_STATS = {
  receivedFrames: 0,
  fps: 0,
  bitrate: 0,
  lastFrameTime: 0,
  totalBytes: 0,
  droppedFrames: 0,
  droppedOldFrames: 0,
  errors: 0,
  decodeQueueDepth: 0,
  decoderWaitingKeyframe: false,
  decoderBackend: 'unknown',
  decodedWidth: 0,
  decodedHeight: 0,
  outputWidth: 0,
  outputHeight: 0
}

// ==================== MQTT 统计常量 ====================

/**
 * 默认 MQTT 统计信息
 */
export const DEFAULT_MQTT_STATS = {
  messagesSent: 0,
  messagesReceived: 0,
  lastMessageTime: 0
}

// ==================== 比赛状态常量 ====================

/**
 * 默认比赛时长 (秒)
 */
export const DEFAULT_MATCH_DURATION = 10 * 60

/**
 * 默认比分
 */
export const DEFAULT_SCORE = {
  red: 0,
  blue: 0
}

/**
 * 默认机器人状态标志
 */
export const DEFAULT_ROBOT_STATUS_FLAGS = {
  aimAssist: false,
  gyro: false,
  deployed: false,
  noAmmo: false,
  overcharge: 0,
  bufferEnergy: 60,
  actualEnergy: 0,
  maxBufferEnergy: 60,
  maxActualEnergy: 150,
  hasCapacitor: true
}
