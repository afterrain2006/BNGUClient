import type { ClientUpdate } from '@/contracts/ClientUpdate'
import { adaptAdditionalTelemetry, globalMatchUpdate } from './telemetry'
import type { RobotModuleAvailability } from '@/domain/robot/RobotState'
import type { Rm2026DecodedMessage } from './decoder'
import type {
  Rm2026GlobalUnitStatus,
  Rm2026RobotDynamicStatus,
  Rm2026RobotModuleStatus,
  Rm2026RobotPosition,
  Rm2026RobotStaticStatus
} from './types'

export function isValidRobotId(robotId: number | undefined): robotId is number {
  return robotId !== undefined && Number.isInteger(robotId) && robotId > 0
}

function toModuleAvailability(status: number | undefined): RobotModuleAvailability | undefined {
  if (status === undefined) return undefined
  if (status === 0) return 'offline'
  if (status === 1) return 'online'
  return 'unknown'
}

export function adaptRm2026Message(
  message: Rm2026DecodedMessage,
  selfRobotId: number
): ClientUpdate[] {
  switch (message.messageType) {
    case 'GlobalUnitStatus': {
      const data = message.data as Rm2026GlobalUnitStatus
      const allyOffset = selfRobotId < 100 ? 0 : 100
      const enemyOffset = selfRobotId < 100 ? 100 : 0
      // RM2026 V1.3.0 section 2.2.4: allies 1,2,3,4,7, then enemies 1,2,3,4,7.
      const teamRobotIds = [1, 2, 3, 4, 7]
      const robotIds = [
        ...teamRobotIds.map(id => id + allyOffset),
        ...teamRobotIds.map(id => id + enemyOffset)
      ]

      const updates: ClientUpdate[] = robotIds.flatMap((robotId, index) => {
        const currentHealth = data.robotHealth?.[index]
        return currentHealth === undefined ? [] : [{ robotId, combat: { currentHealth } }]
      })
      const match = globalMatchUpdate(message.data, selfRobotId)
      if (match) updates.push(match)
      return updates
    }

    case 'RobotPosition': {
      const data = message.data as Rm2026RobotPosition
      if (!isValidRobotId(data.robotId)) return []

      return [{
        robotId: data.robotId,
        pose: {
          position: { x: data.x, y: data.y, z: data.z },
          yaw: data.yaw
        }
      }]
    }

    case 'RobotStaticStatus': {
      const data = message.data as Rm2026RobotStaticStatus
      if (!isValidRobotId(data.robotId)) return []

      return [{
        robotId: data.robotId,
        operational: {
          connected: data.connectionState === 0
            ? false
            : data.connectionState === 1 ? true : undefined,
          onField: data.fieldState === 0
            ? true
            : data.fieldState === 1 ? false : undefined,
          lifeState: data.aliveState === 0
            ? 'unknown'
            : data.aliveState === 1
              ? 'alive'
              : data.aliveState === 2 ? 'destroyed' : undefined
        },
        configuration: {
          shooterPerformance: data.performanceSystemShooter === undefined ? undefined : (['unknown', 'cooling', 'burst', 'melee', 'ranged'] as const)[data.performanceSystemShooter] ?? 'unknown',
          chassisPerformance: data.performanceSystemChassis === undefined ? undefined : (['unknown', 'health', 'power', 'melee', 'ranged'] as const)[data.performanceSystemChassis] ?? 'unknown',
          level: data.level,
          maxHealth: data.maxHealth,
          maxHeat: data.maxHeat,
          heatCooldownRate: data.heatCooldownRate,
          maxPower: data.maxPower,
          maxBufferEnergy: data.maxBufferEnergy,
          maxChassisEnergy: data.maxChassisEnergy
        }
      }]
    }

    case 'RobotDynamicStatus': {
      const data = message.data as Rm2026RobotDynamicStatus

      return [{
        robotId: selfRobotId,
        combat: {
          currentHealth: data.currentHealth,
          currentHeat: data.currentHeat,
          lastProjectileFireRate: data.lastProjectileFireRate,
          currentChassisEnergy: data.currentChassisEnergy,
          currentBufferEnergy: data.currentBufferEnergy,
          currentExperience: data.currentExperience,
          experienceForUpgrade: data.experienceForUpgrade,
          totalProjectilesFired: data.totalProjectilesFired,
          remainingAmmo: data.remainingAmmo,
          isOutOfCombat: data.isOutOfCombat,
          outOfCombatCountdown: data.outOfCombatCountdown,
          canRemoteHeal: data.canRemoteHeal,
          canRemoteAmmo: data.canRemoteAmmo
        }
      }]
    }

    case 'RobotModuleStatus': {
      const data = message.data as Rm2026RobotModuleStatus

      return [{
        robotId: selfRobotId,
        modules: {
          powerManager: toModuleAvailability(data.powerManager),
          rfid: toModuleAvailability(data.rfid),
          lightStrip: toModuleAvailability(data.lightStrip),
          smallShooter: toModuleAvailability(data.smallShooter),
          bigShooter: toModuleAvailability(data.bigShooter),
          uwb: toModuleAvailability(data.uwb),
          armor: toModuleAvailability(data.armor),
          videoTransmission: toModuleAvailability(data.videoTransmission),
          capacitor: toModuleAvailability(data.capacitor),
          mainController: toModuleAvailability(data.mainController),
          laserDetectionModule: toModuleAvailability(data.laserDetectionModule)
        }
      }]
    }

    default:
      return adaptAdditionalTelemetry(message.messageType, message.data, selfRobotId)
  }
}
