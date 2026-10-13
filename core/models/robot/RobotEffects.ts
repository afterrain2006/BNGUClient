export type BuffKind = 'attack' | 'defense' | 'cooling' | 'power' | 'healing' | 'ammo' | 'terrain' | 'unknown'
export type PenaltyKind = 'yellow-card' | 'both-yellow-cards' | 'red-card' | 'over-power' | 'over-heat' | 'over-fire-rate' | 'unknown'
export interface RobotBuff {
  kind: BuffKind
  level: number
  durationSeconds: number
  remainingSeconds: number
}
export interface RobotPenalty {
  kind: PenaltyKind
  remainingSeconds: number
  totalCount: number
}
export interface RobotInjuryState {
  totalDamage?: number
  collisionDamage?: number
  smallProjectileDamage?: number
  largeProjectileDamage?: number
  dartSplashDamage?: number
  moduleOfflineDamage?: number
  offlineDamage?: number
  penaltyDamage?: number
  serverKillDamage?: number
  killerId?: number
}
export interface RobotRespawnState {
  isPendingRespawn?: boolean
  totalRespawnProgress?: number
  currentRespawnProgress?: number
  canFreeRespawn?: boolean
  goldCostForRespawn?: number
  canPayForRespawn?: boolean
}
export interface RobotSystems {
  sentry?: { posture?: 'attack' | 'defense' | 'move' | 'unknown'; weakened?: boolean }
  airSupport?: { state?: 'idle' | 'active' | 'locked' | 'unknown'; remainingSeconds?: number; cost?: number; targeted?: boolean; shooterState?: number }
  deployment?: { deployed?: boolean }
  engineering?: { maximumDifficultyLevel?: number; basicState?: number; putinState?: number; moveState?: number; rotateState?: number; enemyCoreStatus?: number; remainTimeAll?: number; remainTimeStep?: number }
  dart?: { target?: 'outpost' | 'base-fixed' | 'base-random-fixed' | 'base-random-moving' | 'base-end-moving' | 'unknown'; gateOpen?: boolean }
  controlResult?: { commandId?: number; resultCode?: number }
  path?: { intention?: 'attack' | 'defense' | 'move' | 'unknown'; points: { x: number; y: number }[] }
}
