import { computed, reactive } from 'vue'
import { useRobotStore } from '@/stores/robotStore'
import { useMatchStore } from '@/stores/matchStore'
import { useRobotSelectionStore } from '@/stores/robotSelectionStore'
import { useCustomDataStore } from '@/stores/customDataStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useFreshnessClock } from './useFreshnessClock'
import type { RobotState } from '@/domain/robot/RobotState'

// Display/binding vocabulary for saved Dashboard XML paths. These projections
// hold no telemetry state, decode no messages, and never fall back to an old Store.
const stages = ['not-started', 'preparation', 'self-check', 'countdown', 'fighting', 'settlement']
const buffKinds = ['unknown', 'attack', 'defense', 'cooling', 'power', 'healing', 'ammo', 'terrain']
const penaltyKinds = ['unknown', 'yellow-card', 'both-yellow-cards', 'red-card', 'over-power', 'over-heat', 'over-fire-rate']
const eventKinds = ['unknown', 'kill', 'outpost-destroyed', 'rune-arms', 'rune-activated', 'ally-hero-snipe-damage', 'enemy-hero-snipe-damage', 'enemy-air-support', 'enemy-air-support-countered', 'dart-hit', 'dart-gate-open', 'base-attacked', 'outpost-stopped', 'base-armor-open', 'assembly-forced-exit', 'assembly-result']
export enum CurrentStage { NOT_STARTED = 0, PREPARATION = 1, SELF_CHECK = 2, COUNTDOWN_5S = 3, FIGHTING = 4, SETTLEMENT = 5 }
export enum BuffType { ATTACK_BOOST = 1, DEFENSE_BOOST = 2, HEAT_COOLING_BOOST = 3, CHASSIS_POWER_BOOST = 4, HEALTH_REGEN = 5, EXCHANGEABLE_AMMO = 6, TERRAIN_CROSSING = 7 }
export enum PenaltyType { YELLOW_CARD = 1, BOTH_YELLOW_CARDS = 2, RED_CARD = 3, OVER_POWER = 4, OVER_HEAT = 5, OVER_FIRE_RATE = 6 }

export function useTelemetryView() {
  const robots = useRobotStore()
  const match = useMatchStore()
  const selection = useRobotSelectionStore()
  const custom = useCustomDataStore()
  const connection = useConnectionStore()
  const now = useFreshnessClock()
  function projectRobot(robot: RobotState) {
    const robotId = robot.identity.robotId
    return {
      ...robot.combat, ...robot.configuration, ...robot.pose.position,
      robotId, team: (robotId >= 100 ? 'blue' : 'red') as 'red' | 'blue',
      robotType: Object.values(selection.config.robotMappings ?? {}).find(mapping => mapping.id === robotId)?.type,
      yaw: robot.pose.yaw,
      isAlive: robot.combat.currentHealth === 0 || robot.operational.lifeState === 'destroyed' ? false : robot.operational.lifeState === 'alive' ? true : robot.combat.currentHealth === undefined ? undefined : robot.combat.currentHealth > 0,
      isPendingRespawn: robot.respawn.isPendingRespawn,
      moduleStatus: Object.fromEntries(Object.entries(robot.modules).map(([key, value]) => [key, value === 'online' ? 1 : value === 'offline' ? 0 : undefined])),
      lastUpdate: robot.lastUpdatedAt, healthUpdatedAt: robot.healthUpdatedAt, maxHealthUpdatedAt: robot.maxHealthUpdatedAt, poseUpdatedAt: robot.poseUpdatedAt
    }
  }
  const allRobots = computed(() => Object.values(robots.robots).map(projectRobot))
  const redRobotList = computed(() => allRobots.value.filter(robot => robot.team === 'red'))
  const blueRobotList = computed(() => allRobots.value.filter(robot => robot.team === 'blue'))
  const redRobots = computed(() => new Map(redRobotList.value.map(robot => [robot.robotId, robot])))
  const blueRobots = computed(() => new Map(blueRobotList.value.map(robot => [robot.robotId, robot])))
  const ally = computed(() => connection.perspectiveTeam ? match.state.teams[connection.perspectiveTeam] : {})
  const enemy = computed(() => connection.perspectiveTeam ? match.state.teams[connection.perspectiveTeam === 'red' ? 'blue' : 'red'] : {})
  const activeBuffs = computed(() => Object.values(robots.robots).flatMap(robot => robot.buffs.map(buff => ({
    robotId: robot.identity.robotId, buffType: buffKinds.indexOf(buff.kind), buffLevel: buff.level,
    buffMaxTime: buff.durationSeconds, buffLeftTime: Math.max(0, buff.remainingSeconds - Math.max(0, Math.floor((now.value - buff.receivedAt) / 1000)))
  }))).filter(buff => buff.buffLeftTime > 0))
  const activePenalties = computed(() => new Map((robots.getRobot(selection.selectedRobotId)?.penalties ?? []).map(penalty => ({
    penaltyType: penaltyKinds.indexOf(penalty.kind), totalPenaltyNum: penalty.totalCount, startTime: penalty.receivedAt,
    penaltyEffectSec: Math.max(0, penalty.remainingSeconds - Math.max(0, Math.floor((now.value - penalty.receivedAt) / 1000)))
  })).filter(penalty => penalty.penaltyEffectSec > 0).map(penalty => [penalty.penaltyType, penalty])))
  const selected = computed(() => robots.getRobot(selection.selectedRobotId))
  function getRobot(robotId: number) { const robot = robots.getRobot(robotId); return robot ? projectRobot(robot) : undefined }
  return reactive({
    currentRobotId: computed(() => selection.selectedRobotId),
    currentRobotType: computed(() => selection.selectedRobotName),
    allRobots, redRobotList, blueRobotList, redRobots, blueRobots, getRobot,
    gameStatus: computed(() => ({ ...match.state.status, currentStage: stages.indexOf(match.state.status.stage ?? 'unknown'), stageCountdownSec: match.state.status.countdownSeconds ?? 0, stageElapsedSec: match.state.status.elapsedSeconds ?? 0, isPaused: match.state.status.paused ?? false })),
    globalUnitStatus: computed(() => ({ ...ally.value, baseStatus: ['invincible', 'armor-closed', 'armor-open'].indexOf(ally.value.baseState ?? 'unknown'), outpostStatus: ['invincible', 'rotating', 'stopped', 'destroyed', 'rebuildable', 'rebuilding'].indexOf(ally.value.outpostState ?? 'unknown'), enemyBaseHealth: enemy.value.baseHealth, enemyOutpostHealth: enemy.value.outpostHealth, robotHealth: allRobots.value.map(robot => robot.currentHealth), robotBullets: ally.value.projectileAllowances ?? [], totalDamageRed: match.state.teams.red.totalDamage, totalDamageBlue: match.state.teams.blue.totalDamage })),
    logisticsStatus: computed(() => ally.value),
    specialMechanisms: computed(() => ({ mechanismId: match.state.mechanisms.map(mechanism => mechanism.kind === 'unknown' ? 0 : mechanism.kind === `${connection.perspectiveTeam}-fortress-occupied` ? 1 : 2), mechanismTimeSec: match.state.mechanisms.map(mechanism => mechanism.remainingSeconds) })),
    activeBuffs, activePenalties, penaltyInfo: computed(() => activePenalties.value.values().next().value ?? null),
    injuryStats: computed(() => new Map(Object.values(robots.robots).map(robot => [robot.identity.robotId, robot.injury]))),
    respawnStatus: computed(() => new Map(Object.values(robots.robots).map(robot => [robot.identity.robotId, robot.respawn]))),
    getRobotInjuryStat: (id: number) => robots.getRobot(id)?.injury,
    getRobotRespawnStatus: (id: number) => robots.getRobot(id)?.respawn,
    customData: computed(() => custom.data),
    sentinelStatus: computed(() => selected.value?.systems.sentry ? { postureId: ['unknown', 'attack', 'defense', 'move'].indexOf(selected.value.systems.sentry.posture ?? 'unknown'), isWeakened: selected.value.systems.sentry.weakened } : null),
    runeStatus: computed(() => ({ ...match.state.rune, runeStatus: ['unknown', 'inactive', 'activating', 'active'].indexOf(match.state.rune.state ?? 'unknown') })),
    airSupportStatus: computed(() => ({ airsupportStatus: ['idle', 'active', 'locked'].indexOf(selected.value?.systems.airSupport?.state ?? 'unknown'), leftTime: selected.value?.systems.airSupport?.remainingSeconds, costCoins: selected.value?.systems.airSupport?.cost })),
    radarDetections: computed(() => match.state.radar.map(target => ({ targetRobotId: target.robotId, targetPosX: target.x, targetPosY: target.y, isHighLight: target.highlighted ? target.positioningOffline ? 2 : 1 : 0 }))),
    recentEvents: computed(() => match.state.events.slice(0, 10).map(event => ({ eventId: eventKinds.indexOf(event.kind), param: event.parameters }))),
    aliveRedCount: computed(() => redRobotList.value.filter(robot => robot.isAlive).length),
    aliveBlueCount: computed(() => blueRobotList.value.filter(robot => robot.isAlive).length),
    redTotalHealth: computed(() => redRobotList.value.reduce((sum, robot) => sum + (robot.currentHealth ?? 0), 0)),
    blueTotalHealth: computed(() => blueRobotList.value.reduce((sum, robot) => sum + (robot.currentHealth ?? 0), 0)),
    redHealthPercentage: computed(() => healthPercentage(redRobotList.value)),
    blueHealthPercentage: computed(() => healthPercentage(blueRobotList.value)),
    activeBuffCount: computed(() => activeBuffs.value.length)
  })
}

function healthPercentage(robots: { currentHealth?: number; maxHealth?: number }[]): number {
  const max = robots.reduce((sum, robot) => sum + (robot.maxHealth ?? 0), 0)
  return max > 0 ? robots.reduce((sum, robot) => sum + (robot.currentHealth ?? 0), 0) / max * 100 : 0
}
