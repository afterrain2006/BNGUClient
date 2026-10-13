import protobuf from 'protobufjs/light'
import Long from 'long'
import mqttProtoJson from '@rules/rm2026/generated/mqtt-proto.json'

protobuf.util.Long = Long
protobuf.configure()

/**
 * RM2026 协议解码后的原始消息。
 *
 * 注意：
 * This is RM2026-internal data; it does not cross the Rule boundary.
 */
export interface Rm2026DecodedMessage<
  T extends Record<string, unknown> = Record<string, unknown>
> {
  topic: string
  messageType: string
  data: T
}

let protoRoot: protobuf.Root | null = null

/**
 * 获取 RM2026 Protobuf Root。
 *
 * Root 只创建一次，后续重复使用。
 */
export function getProtoRoot(): protobuf.Root {
  if (!protoRoot) {
    protoRoot = protobuf.Root.fromJSON(mqttProtoJson)
  }

  return protoRoot
}

/**
 * 从 MQTT Topic 中取得 Protobuf Message 名称。
 *
 * 例如：
 *
 * "RobotDynamicStatus"
 *      -> RobotDynamicStatus
 *
 * "robot/RobotDynamicStatus"
 *      -> RobotDynamicStatus
 *
 * "foo.bar.RobotDynamicStatus"
 *      -> RobotDynamicStatus
 */
function getMessageTypeName(topic: string): string {
  const slashSegment = topic.split('/').pop()?.trim()

  if (!slashSegment) {
    throw new Error(`Invalid RM2026 topic: "${topic}"`)
  }

  const messageType =
    slashSegment.split('.').pop()?.trim()

  if (!messageType) {
    throw new Error(`Cannot determine RM2026 message type from topic: "${topic}"`)
  }

  return messageType
}

/**
 * 将 RM2026 MQTT payload 解码成 Protobuf Message。
 *
 * 这里只负责：
 *
 * bytes -> Protobuf Object
 *
 * 不负责：
 * - 更新 Store
 * - RobotState 整合
 * - RobotUpdate mapping
 * - UI
 */
export function decodeRm2026Message(
  topic: string,
  payload: Uint8Array
): Rm2026DecodedMessage | undefined {
  const messageType = getMessageTypeName(topic)

  const root = getProtoRoot()
  const MessageType = root.lookup(messageType)
  if (!(MessageType instanceof protobuf.Type)) return undefined

  const decoded = MessageType.decode(payload)

  const data = MessageType.toObject(decoded, {
    longs: String,
    enums: Number,
    bytes: Array
  }) as Record<string, unknown>

  return {
    topic,
    messageType,
    data
  }
}
