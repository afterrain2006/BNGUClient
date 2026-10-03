export interface Rm2026RobotDynamicStatus {
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

export interface Rm2026RobotStaticStatus {
  connectionState?: number
  fieldState?: number
  aliveState?: number
  robotId?: number
  robotType?: number
  performanceSystemShooter?: number
  performanceSystemChassis?: number
  level?: number
  maxHealth?: number
  maxHeat?: number
  heatCooldownRate?: number
  maxPower?: number
  maxBufferEnergy?: number
  maxChassisEnergy?: number
}

export interface Rm2026RobotPosition {
  x?: number
  y?: number
  z?: number
  yaw?: number
  robotId?: number
}

export interface Rm2026RobotModuleStatus {
  powerManager?: number
  rfid?: number
  lightStrip?: number
  smallShooter?: number
  bigShooter?: number
  uwb?: number
  armor?: number
  videoTransmission?: number
  capacitor?: number
  mainController?: number
  laserDetectionModule?: number
}

export interface Rm2026GlobalUnitStatus {
  robotHealth?: number[]
}
