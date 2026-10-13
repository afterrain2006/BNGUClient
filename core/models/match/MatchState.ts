export type Team = 'red' | 'blue'
export type MatchStage = 'not-started' | 'preparation' | 'self-check' | 'countdown' | 'fighting' | 'settlement' | 'unknown'
export type BaseState = 'invincible' | 'armor-closed' | 'armor-open' | 'unknown'
export type OutpostState = 'invincible' | 'rotating' | 'stopped' | 'destroyed' | 'rebuildable' | 'rebuilding' | 'unknown'

export interface MatchStatus {
  currentRound?: number
  totalRounds?: number
  redScore?: number
  blueScore?: number
  stage?: MatchStage
  countdownSeconds?: number
  elapsedSeconds?: number
  paused?: boolean
}

export interface TeamState {
  baseHealth?: number
  baseState?: BaseState
  baseShield?: number
  outpostHealth?: number
  outpostState?: OutpostState
  totalDamage?: number
  remainingEconomy?: number
  totalEconomyObtained?: string
  techLevel?: number
  encryptionLevel?: number
  projectileAllowances?: number[]
}

export interface MatchEvent {
  kind: string
  parameters: string
}

export interface MatchState {
  status: MatchStatus
  teams: Record<Team, TeamState>
  mechanisms: { kind: 'red-fortress-occupied' | 'blue-fortress-occupied' | 'unknown'; remainingSeconds: number }[]
  events: MatchEvent[]
  rune: { state?: 'inactive' | 'activating' | 'active' | 'unknown'; activatedArms?: number; averageRings?: number }
  radar: { robotId: number; x?: number; y?: number; highlighted?: boolean; positioningOffline?: boolean }[]
  updatedAt: number
}
