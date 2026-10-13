import type { UnlistenFn } from '@tauri-apps/api/event'
import type { MqttStatus } from '@/communication/mqtt/mqttAdapter'
import type { MqttRule } from '@core/rules/types'
import { createRm2026Rule, parseRm2026Identity } from '@rules/rm2026'
import type { Team } from '@core/models/match/MatchState'

// Owns only the Rule runner for one active MQTT connection identity.
export function createRm2026RuleLifecycle(
  startRule: (rule: MqttRule) => Promise<UnlistenFn>,
  invalidateSessionData: () => void,
  onSessionTeamChange: (team: Team | null) => void = () => {}
): { reconcile: (status: MqttStatus) => void; dispose: () => void } {
  let stopRule: UnlistenFn | undefined
  let disposed = false
  let generation = 0
  let desiredClientId: string | null = null
  let lastStatusRevision = -1

  function stopCurrentRule(): void {
    generation += 1
    stopRule?.()
    stopRule = undefined
    desiredClientId = null
    onSessionTeamChange(null)
    invalidateSessionData()
  }

  function reconcile(status: MqttStatus): void {
    if (disposed) return
    if (!Number.isSafeInteger(status.revision) || status.revision < 0) {
      console.warn('[RM2026] MQTT status has no valid revision; refusing to infer connection identity')
      return
    }
    if (status.revision <= lastStatusRevision) return
    lastStatusRevision = status.revision

    if (!status.connected) {
      stopCurrentRule()
      return
    }

    const clientId = status.clientId
    if (!clientId) {
      stopCurrentRule()
      console.warn('[RM2026] connected MQTT status has no active clientId; Rule not started')
      return
    }
    if (clientId === desiredClientId) return

    stopCurrentRule()
    const identity = parseRm2026Identity(clientId)
    if (identity === null) {
      console.error(`[RM2026] active MQTT clientId "${clientId}" is not a supported robot ID; Rule not started`)
      return
    }

    desiredClientId = clientId
    onSessionTeamChange(identity.team)
    const currentGeneration = generation
    const rule = createRm2026Rule({ selfRobotId: identity.robotId })
    void startRule({
      handle(message) {
        return !disposed && currentGeneration === generation ? rule.handle(message) : []
      },
      reset() {
        rule.reset()
      }
    }).then(unlisten => {
      if (disposed || currentGeneration !== generation) {
        unlisten()
        return
      }
      stopRule = unlisten
      console.log(`[startup] RM2026 Rule started for active clientId ${clientId}`)
    }).catch(error => {
      if (currentGeneration !== generation || disposed) return
      desiredClientId = null
      console.warn('[startup] RM2026 Rule listener unavailable', error)
    })
  }

  return {
    reconcile,
    dispose() {
      if (disposed) return
      disposed = true
      stopCurrentRule()
    }
  }
}
