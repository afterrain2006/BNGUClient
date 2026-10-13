import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { MatchState } from '@core/models/match/MatchState'
import type { MatchUpdate } from '@core/contracts/ClientUpdate'
import { mergeDefined } from '@/state/telemetry/patch'

export const useMatchStore = defineStore('match', () => {
  const state = reactive<MatchState>({ status: {}, teams: { red: {}, blue: {} }, mechanisms: [], events: [], rune: {}, radar: [], updatedAt: 0 })
  function applyUpdate(update: MatchUpdate): void {
    if (update.status) mergeDefined(state.status, update.status)
    for (const team of ['red', 'blue'] as const) {
      const patch = update.teams?.[team]
      if (patch) mergeDefined(state.teams[team], patch)
    }
    if (update.mechanisms) state.mechanisms = update.mechanisms
    if (update.rune) mergeDefined(state.rune, update.rune)
    if (update.radar) state.radar = update.radar
    if (update.event) state.events = [update.event, ...state.events].slice(0, 100)
    state.updatedAt = Date.now()
  }
  function reset(): void {
    state.status = {}
    state.teams = { red: {}, blue: {} }
    state.mechanisms = []
    state.events = []
    state.rune = {}
    state.radar = []
    state.updatedAt = 0
  }
  return { state, applyUpdate, reset }
})
