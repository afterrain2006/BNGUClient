import type { ClientUpdate, MatchUpdate } from '@/contracts/ClientUpdate'
import type { MatchStage, BaseState, OutpostState, Team } from '@/domain/match/MatchState'
import type { BuffKind, PenaltyKind } from '@/domain/robot/RobotEffects'

type Data = Record<string, unknown>
const stages: MatchStage[] = ['not-started', 'preparation', 'self-check', 'countdown', 'fighting', 'settlement']
const bases: BaseState[] = ['invincible', 'armor-closed', 'armor-open']
const outposts: OutpostState[] = ['invincible', 'rotating', 'stopped', 'destroyed', 'rebuildable', 'rebuilding']
const buffs: BuffKind[] = ['unknown', 'attack', 'defense', 'cooling', 'power', 'healing', 'ammo', 'terrain']
const penalties: PenaltyKind[] = ['unknown', 'yellow-card', 'both-yellow-cards', 'red-card', 'over-power', 'over-heat', 'over-fire-rate']
const events = ['unknown', 'kill', 'outpost-destroyed', 'rune-arms', 'rune-activated', 'ally-hero-snipe-damage', 'enemy-hero-snipe-damage', 'enemy-air-support', 'enemy-air-support-countered', 'dart-hit', 'dart-gate-open', 'base-attacked', 'outpost-stopped', 'base-armor-open', 'assembly-forced-exit', 'assembly-result']
const postures = ['unknown', 'attack', 'defense', 'move'] as const

function number(data: Data, key: string): number | undefined {
  return typeof data[key] === 'number' ? data[key] : undefined
}
function bool(data: Data, key: string): boolean | undefined {
  return typeof data[key] === 'boolean' ? data[key] : undefined
}
function numbers(data: Data, key: string): number[] | undefined {
  return Array.isArray(data[key]) ? data[key].map(Number) : undefined
}
function numericFields<K extends string>(data: Data, keys: readonly K[]): Partial<Record<K, number>> {
  return Object.fromEntries(keys.map(key => [key, number(data, key)])) as Partial<Record<K, number>>
}
function enumValue<T extends string>(data: Data, key: string, values: readonly T[]): T | 'unknown' | undefined {
  const value = number(data, key)
  return value === undefined ? undefined : values[value] ?? 'unknown'
}
export function globalMatchUpdate(data: Data, selfRobotId: number): MatchUpdate | undefined {
  const ally: Team = selfRobotId < 100 ? 'red' : 'blue'
  const enemy: Team = ally === 'red' ? 'blue' : 'red'
  const fields = ['baseHealth', 'baseStatus', 'baseShield', 'outpostHealth', 'outpostStatus', 'enemyBaseHealth', 'enemyBaseStatus', 'enemyBaseShield', 'enemyOutpostHealth', 'enemyOutpostStatus', 'robotBullets', 'totalDamageAlly', 'totalDamageEnemy']
  if (!fields.some(key => data[key] !== undefined)) return undefined
  return { scope: 'match', teams: {
    [ally]: { baseHealth: number(data, 'baseHealth'), baseState: enumValue(data, 'baseStatus', bases), baseShield: number(data, 'baseShield'), outpostHealth: number(data, 'outpostHealth'), outpostState: enumValue(data, 'outpostStatus', outposts), totalDamage: number(data, 'totalDamageAlly'), projectileAllowances: numbers(data, 'robotBullets') },
    [enemy]: { baseHealth: number(data, 'enemyBaseHealth'), baseState: enumValue(data, 'enemyBaseStatus', bases), baseShield: number(data, 'enemyBaseShield'), outpostHealth: number(data, 'enemyOutpostHealth'), outpostState: enumValue(data, 'enemyOutpostStatus', outposts), totalDamage: number(data, 'totalDamageEnemy') }
  } }
}

export function adaptAdditionalTelemetry(type: string, data: Data, selfRobotId: number): ClientUpdate[] {
  const ally: Team = selfRobotId < 100 ? 'red' : 'blue'
  const enemy: Team = ally === 'red' ? 'blue' : 'red'
  switch (type) {
    case 'GameStatus': return [{ scope: 'match', status: {
      ...numericFields(data, ['currentRound', 'totalRounds', 'redScore', 'blueScore']),
      stage: enumValue(data, 'currentStage', stages), countdownSeconds: number(data, 'stageCountdownSec'), elapsedSeconds: number(data, 'stageElapsedSec'), paused: bool(data, 'isPaused')
    } }]
    case 'GlobalLogisticsStatus': return [{ scope: 'match', teams: { [ally]: {
      ...numericFields(data, ['remainingEconomy', 'techLevel', 'encryptionLevel']),
      totalEconomyObtained: data.totalEconomyObtained === undefined ? undefined : String(data.totalEconomyObtained)
    } } }]
    case 'GlobalSpecialMechanism': {
      const ids = numbers(data, 'mechanismId') ?? []
      const times = numbers(data, 'mechanismTimeSec') ?? []
      return [{ scope: 'match', mechanisms: ids.map((id, index) => ({
        kind: id === 1 ? `${ally}-fortress-occupied` : id === 2 ? `${enemy}-fortress-occupied` : 'unknown', remainingSeconds: times[index] ?? 0
      })) }]
    }
    case 'Event': return [{ scope: 'match', event: { kind: events[number(data, 'eventId') ?? 0] ?? 'unknown', parameters: String(data.param ?? '') } }]
    case 'RobotInjuryStat': return [{ robotId: selfRobotId, injury: numericFields(data, ['totalDamage', 'collisionDamage', 'smallProjectileDamage', 'largeProjectileDamage', 'dartSplashDamage', 'moduleOfflineDamage', 'offlineDamage', 'penaltyDamage', 'serverKillDamage', 'killerId']) }]
    case 'RobotRespawnStatus': return [{ robotId: selfRobotId, respawn: {
      ...numericFields(data, ['totalRespawnProgress', 'currentRespawnProgress', 'goldCostForRespawn']), isPendingRespawn: bool(data, 'isPendingRespawn'), canFreeRespawn: bool(data, 'canFreeRespawn'), canPayForRespawn: bool(data, 'canPayForRespawn')
    } }]
    case 'Buff': {
      const robotId = number(data, 'robotId')
      if (robotId === undefined || !Number.isInteger(robotId) || robotId <= 0) return []
      return [{ robotId, buff: { kind: buffs[number(data, 'buffType') ?? 0] ?? 'unknown', level: number(data, 'buffLevel') ?? 0, durationSeconds: number(data, 'buffMaxTime') ?? 0, remainingSeconds: number(data, 'buffLeftTime') ?? 0 } }]
    }
    case 'PenaltyInfo': return [{ robotId: selfRobotId, penalty: { kind: penalties[number(data, 'penaltyType') ?? 0] ?? 'unknown', remainingSeconds: number(data, 'penaltyEffectSec') ?? 0, totalCount: number(data, 'totalPenaltyNum') ?? 0 } }]
    case 'RadarInfoToClient': {
      // Official order: enemies 1,2,3,4,6,7, then allies 1,2,3,4,6,7. Coordinates are cm.
      const ids = [1, 2, 3, 4, 6, 7]
      const robotIds = [...ids.map(id => id + (enemy === 'blue' ? 100 : 0)), ...ids.map(id => id + (ally === 'blue' ? 100 : 0))]
      const entries = (Array.isArray(data.RadarSingleRobotInfo) ? data.RadarSingleRobotInfo : []) as Data[]
      const radar = entries.slice(0, robotIds.length).map((entry, index) => ({
        robotId: robotIds[index], x: number(entry, 'targetPosX') === undefined ? undefined : Number(entry.targetPosX) / 100,
        y: number(entry, 'targetPosY') === undefined ? undefined : Number(entry.targetPosY) / 100,
        highlighted: entry.isHighLight === undefined ? undefined : Number(entry.isHighLight) > 0, positioningOffline: entry.isHighLight === 2
      }))
      return [{ scope: 'match', radar }, ...radar.filter(entry => !entry.positioningOffline).map(entry => ({ robotId: entry.robotId, pose: { position: { x: entry.x, y: entry.y } } }))]
    }
    case 'CustomByteBlock': return [{ scope: 'custom', robotId: selfRobotId, bytes: Uint8Array.from(numbers(data, 'data') ?? []) }]
    case 'RuneStatusSync': return [{ scope: 'match', rune: { state: enumValue(data, 'runeStatus', ['unknown', 'inactive', 'activating', 'active'] as const), ...numericFields(data, ['activatedArms', 'averageRings']) } }]
    case 'SentryStatusSync': return [{ robotId: selfRobotId, systems: { sentry: { posture: enumValue(data, 'postureId', postures), weakened: bool(data, 'isWeakened') } } }]
    case 'AirSupportStatusSync': return [{ robotId: selfRobotId, systems: { airSupport: { state: enumValue(data, 'airsupportStatus', ['idle', 'active', 'locked'] as const), remainingSeconds: number(data, 'leftTime'), cost: number(data, 'costCoins'), targeted: data.isBeingTargeted === undefined ? undefined : Boolean(data.isBeingTargeted), shooterState: number(data, 'shooterStatus') } } }]
    case 'TechCoreMotionStateSync': return [{ robotId: selfRobotId, systems: { engineering: numericFields(data, ['maximumDifficultyLevel', 'basicState', 'putinState', 'moveState', 'rotateState', 'enemyCoreStatus', 'remainTimeAll', 'remainTimeStep']) } }]
    case 'RobotPerformanceSelectionSync': return [{ robotId: selfRobotId, configuration: {
      shooterPerformance: enumValue(data, 'shooter', ['unknown', 'cooling', 'burst', 'melee', 'ranged'] as const),
      chassisPerformance: enumValue(data, 'chassis', ['unknown', 'health', 'power', 'melee', 'ranged'] as const), sentryControl: number(data, 'sentryControl')
    } }]
    case 'DeployModeStatusSync': return [{ robotId: selfRobotId, systems: { deployment: { deployed: data.status === undefined ? undefined : data.status === 1 } } }]
    case 'DartSelectTargetStatusSync': return [{ robotId: selfRobotId, systems: { dart: { target: enumValue(data, 'targetId', ['unknown', 'outpost', 'base-fixed', 'base-random-fixed', 'base-random-moving', 'base-end-moving'] as const), gateOpen: data.open === undefined ? undefined : Boolean(data.open) } } }]
    case 'SentryCtrlResult': return [{ robotId: selfRobotId, systems: { controlResult: numericFields(data, ['commandId', 'resultCode']) } }]
    case 'RobotPathPlanInfo': {
      const senderId = number(data, 'senderId')
      if (senderId === undefined || senderId <= 0) return []
      const x = number(data, 'startPosX') ?? 0
      const y = number(data, 'startPosY') ?? 0
      const offsetX = numbers(data, 'offsetX') ?? []
      const offsetY = numbers(data, 'offsetY') ?? []
      return [{ robotId: senderId, systems: { path: { intention: enumValue(data, 'intention', postures), points: [{ x: x / 10, y: y / 10 }, ...offsetX.map((dx, index) => ({ x: (x + dx) / 10, y: (y + (offsetY[index] ?? 0)) / 10 }))] } } }]
    }
    default: return []
  }
}
