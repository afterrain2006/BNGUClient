import type { RobotBuff, RobotPenalty, RobotInjuryState, RobotRespawnState, RobotSystems } from '@core/models/robot/RobotEffects'

export interface RobotIdentity {
  robotId: number
}

export interface RobotPosition {
  x?: number
  y?: number
  z?: number
}

export interface RobotPose {
  position: RobotPosition
  yaw?: number
}

export interface RobotCombatState {
  currentHealth?: number
  currentHeat?: number
  lastProjectileFireRate?: number

  currentChassisEnergy?: number
  currentBufferEnergy?: number

  currentExperience?: number
  experienceForUpgrade?: number

  totalProjectilesFired?: number
  remainingAmmo?: number

  isOutOfCombat?: boolean
  outOfCombatCountdown?: number

  canRemoteHeal?: boolean
  canRemoteAmmo?: boolean
}

export interface RobotOperationalState {
  connected?: boolean
  onField?: boolean
  lifeState?: 'unknown' | 'alive' | 'destroyed'
}

export interface RobotConfiguration {
  shooterPerformance?: 'cooling' | 'burst' | 'melee' | 'ranged' | 'unknown'
  chassisPerformance?: 'health' | 'power' | 'melee' | 'ranged' | 'unknown'
  sentryControl?: number
  level?: number
  maxHealth?: number
  maxHeat?: number
  heatCooldownRate?: number
  maxPower?: number
  maxBufferEnergy?: number
  maxChassisEnergy?: number
}

export type RobotModuleAvailability = 'offline' | 'online' | 'unknown'

export interface RobotModuleState {
  powerManager?: RobotModuleAvailability
  rfid?: RobotModuleAvailability
  lightStrip?: RobotModuleAvailability
  smallShooter?: RobotModuleAvailability
  bigShooter?: RobotModuleAvailability
  uwb?: RobotModuleAvailability
  armor?: RobotModuleAvailability
  videoTransmission?: RobotModuleAvailability
  capacitor?: RobotModuleAvailability
  mainController?: RobotModuleAvailability
  laserDetectionModule?: RobotModuleAvailability
}

export interface RobotState {
  identity: RobotIdentity

  pose: RobotPose

  combat: RobotCombatState

  operational: RobotOperationalState

  configuration: RobotConfiguration

  modules: RobotModuleState
  injury: RobotInjuryState
  respawn: RobotRespawnState
  buffs: (RobotBuff & { receivedAt: number })[]
  penalties: (RobotPenalty & { receivedAt: number })[]
  systems: RobotSystems

  /** Receipt times: 0 = never received, -1 = session invalidated, positive = last report time. */
  healthUpdatedAt: number
  maxHealthUpdatedAt: number
  modulesUpdatedAt: number
  poseUpdatedAt: number

  lastUpdatedAt: number
}
