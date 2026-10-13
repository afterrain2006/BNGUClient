import type { MqttRule } from '@core/rules/types'
import { adaptRm2026Message, isValidRobotId } from '@rules/rm2026/adapter'
import { decodeRm2026Message } from '@rules/rm2026/decoder'
import type { Rm2026RobotStaticStatus } from '@rules/rm2026/types'
import type { Team } from '@core/models/match/MatchState'
export { DEFAULT_MQTT_CONFIG } from './defaults'
export { encodeRm2026Command } from '@rules/rm2026/commands'
export { createRm2026ControlRule } from '@rules/rm2026/control'

export interface Rm2026RuleOptions {
  selfRobotId: number
}

function isSupportedSelfRobotId(robotId: number): boolean {
  return Number.isInteger(robotId) && (
    (robotId >= 1 && robotId <= 11) ||
    (robotId >= 101 && robotId <= 111)
  )
}

export function parseRm2026ClientId(clientId: string): number | null {
  if (!/^(?:[1-9]|1[01]|10[1-9]|11[01])$/.test(clientId)) return null
  const robotId = Number(clientId)
  return isSupportedSelfRobotId(robotId) ? robotId : null
}

// Protocol numbering is interpreted here; the client session only consumes identity.
export function parseRm2026Identity(clientId: string): { robotId: number; team: Team } | null {
  const robotId = parseRm2026ClientId(clientId)
  return robotId === null ? null : { robotId, team: robotId < 100 ? 'red' : 'blue' }
}

// One Rule instance is bound to one established MQTT connection identity.
export function createRm2026Rule(options: Rm2026RuleOptions): MqttRule {
  if (!isSupportedSelfRobotId(options.selfRobotId)) {
    throw new RangeError(`Invalid RM2026 selfRobotId: ${options.selfRobotId}`)
  }

  const selfRobotId = options.selfRobotId
  let warnedMismatchedStaticRobotId: number | undefined

  return {
    handle(message) {
      const decoded = decodeRm2026Message(message.topic, message.payload)
      if (!decoded) return []

      if (decoded.messageType === 'RobotStaticStatus') {
        const messageRobotId = (decoded.data as Rm2026RobotStaticStatus).robotId
        if (!isValidRobotId(messageRobotId) || messageRobotId !== selfRobotId) {
          if (warnedMismatchedStaticRobotId !== messageRobotId) {
            warnedMismatchedStaticRobotId = messageRobotId
            console.warn(`[RM2026 Rule] RobotStaticStatus robotId ${String(messageRobotId)} does not match active client robotId ${selfRobotId}; update ignored`)
          }
          return []
        }
        warnedMismatchedStaticRobotId = undefined
      }

      return adaptRm2026Message(decoded, selfRobotId)
    },

    reset() {
      warnedMismatchedStaticRobotId = undefined
    }
  }
}
