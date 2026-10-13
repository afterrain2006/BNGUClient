import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { RobotState } from '@core/models/robot/RobotState'
import type { RobotUpdate } from '@core/contracts/RobotUpdate'
import { mergeDefined } from '@/state/telemetry/patch'

function createRobotState(robotId: number): RobotState {
  return {
    identity: {
      robotId
    },

    pose: {
      position: {}
    },

    combat: {},

    operational: {},

    configuration: {},

    modules: {},
    injury: {},
    respawn: {},
    buffs: [],
    penalties: [],
    systems: {},
    healthUpdatedAt: 0,
    maxHealthUpdatedAt: 0,
    modulesUpdatedAt: 0,
    poseUpdatedAt: 0,

    lastUpdatedAt: Date.now()
  }
}

export const useRobotStore = defineStore('robot', () => {
  const robots = reactive<Record<number, RobotState>>({})

  function getRobot(robotId: number): RobotState | undefined {
    return robots[robotId]
  }

  function getOrCreateRobot(robotId: number): RobotState {
    let robot = robots[robotId]

    if (!robot) {
      robot = createRobotState(robotId)
      robots[robotId] = robot
    }

    return robot
  }

  function removeRobot(robotId: number): void {
    delete robots[robotId]
  }

  function invalidateSessionFreshness(): void {
    for (const robot of Object.values(robots)) {
      if (robot.healthUpdatedAt > 0) robot.healthUpdatedAt = -1
      if (robot.maxHealthUpdatedAt > 0) robot.maxHealthUpdatedAt = -1
      if (robot.modulesUpdatedAt > 0) robot.modulesUpdatedAt = -1
      if (robot.poseUpdatedAt > 0) robot.poseUpdatedAt = -1
      robot.combat.canRemoteHeal = undefined
      robot.combat.canRemoteAmmo = undefined
      robot.buffs = []
      robot.penalties = []
      robot.injury = {}
      robot.respawn = {}
      robot.systems = {}
    }
  }

  function applyUpdate(update: RobotUpdate): void {
    if (!Number.isInteger(update.robotId) || update.robotId <= 0) {
      console.warn('[Robot Store] cannot apply update with invalid robotId')
      return
    }

    const robot = getOrCreateRobot(update.robotId)
    const updatedAt = Date.now()
    const position = update.pose?.position
    if (position?.x !== undefined) robot.pose.position.x = position.x
    if (position?.y !== undefined) robot.pose.position.y = position.y
    if (position?.z !== undefined) robot.pose.position.z = position.z
    if (update.pose?.yaw !== undefined) robot.pose.yaw = update.pose.yaw
    if (update.pose && (update.pose.yaw !== undefined || Object.values(position ?? {}).some(value => value !== undefined))) {
      robot.poseUpdatedAt = updatedAt
    }

    const combat = update.combat
    if (combat?.currentHealth !== undefined) {
      robot.combat.currentHealth = combat.currentHealth
      robot.healthUpdatedAt = updatedAt
    }
    if (combat?.currentHeat !== undefined) robot.combat.currentHeat = combat.currentHeat
    if (combat?.lastProjectileFireRate !== undefined) robot.combat.lastProjectileFireRate = combat.lastProjectileFireRate
    if (combat?.currentChassisEnergy !== undefined) robot.combat.currentChassisEnergy = combat.currentChassisEnergy
    if (combat?.currentBufferEnergy !== undefined) robot.combat.currentBufferEnergy = combat.currentBufferEnergy
    if (combat?.currentExperience !== undefined) robot.combat.currentExperience = combat.currentExperience
    if (combat?.experienceForUpgrade !== undefined) robot.combat.experienceForUpgrade = combat.experienceForUpgrade
    if (combat?.totalProjectilesFired !== undefined) robot.combat.totalProjectilesFired = combat.totalProjectilesFired
    if (combat?.remainingAmmo !== undefined) robot.combat.remainingAmmo = combat.remainingAmmo
    if (combat?.isOutOfCombat !== undefined) robot.combat.isOutOfCombat = combat.isOutOfCombat
    if (combat?.outOfCombatCountdown !== undefined) robot.combat.outOfCombatCountdown = combat.outOfCombatCountdown
    if (combat?.canRemoteHeal !== undefined) robot.combat.canRemoteHeal = combat.canRemoteHeal
    if (combat?.canRemoteAmmo !== undefined) robot.combat.canRemoteAmmo = combat.canRemoteAmmo

    const operational = update.operational
    if (operational?.connected !== undefined) robot.operational.connected = operational.connected
    if (operational?.onField !== undefined) robot.operational.onField = operational.onField
    if (operational?.lifeState !== undefined) robot.operational.lifeState = operational.lifeState

    const configuration = update.configuration
    if (configuration) mergeDefined(robot.configuration, configuration)
    if (configuration?.maxHealth !== undefined) {
      robot.maxHealthUpdatedAt = updatedAt
    }

    const modules = update.modules
    if (modules?.powerManager !== undefined) robot.modules.powerManager = modules.powerManager
    if (modules?.rfid !== undefined) robot.modules.rfid = modules.rfid
    if (modules?.lightStrip !== undefined) robot.modules.lightStrip = modules.lightStrip
    if (modules?.smallShooter !== undefined) robot.modules.smallShooter = modules.smallShooter
    if (modules?.bigShooter !== undefined) robot.modules.bigShooter = modules.bigShooter
    if (modules?.uwb !== undefined) robot.modules.uwb = modules.uwb
    if (modules?.armor !== undefined) robot.modules.armor = modules.armor
    if (modules?.videoTransmission !== undefined) robot.modules.videoTransmission = modules.videoTransmission
    if (modules?.capacitor !== undefined) robot.modules.capacitor = modules.capacitor
    if (modules?.mainController !== undefined) robot.modules.mainController = modules.mainController
    if (modules?.laserDetectionModule !== undefined) robot.modules.laserDetectionModule = modules.laserDetectionModule

    if (modules && Object.values(modules).some(status => status !== undefined)) {
      robot.modulesUpdatedAt = updatedAt
    }

    if (update.injury) mergeDefined(robot.injury, update.injury)
    if (update.respawn) mergeDefined(robot.respawn, update.respawn)
    if (update.buff) {
      robot.buffs = robot.buffs.filter(buff => buff.kind !== update.buff!.kind)
      if (update.buff.remainingSeconds > 0) robot.buffs.push({ ...update.buff, receivedAt: updatedAt })
    }
    if (update.penalty) {
      robot.penalties = robot.penalties.filter(penalty => penalty.kind !== update.penalty!.kind)
      if (update.penalty.remainingSeconds > 0) robot.penalties.push({ ...update.penalty, receivedAt: updatedAt })
    }
    if (update.systems) {
      for (const key of Object.keys(update.systems) as (keyof RobotState['systems'])[]) {
        const patch = update.systems[key]
        if (patch) {
          Object.assign(robot.systems, { [key]: { ...robot.systems[key], ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) } })
        }
      }
    }
    robot.lastUpdatedAt = updatedAt
  }

  return {
    robots,
    getRobot,
    getOrCreateRobot,
    removeRobot,
    invalidateSessionFreshness,
    applyUpdate
  }
})
