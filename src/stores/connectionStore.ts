import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Team } from '@/domain/match/MatchState'

export const useConnectionStore = defineStore('connection', () => {
  const connected = ref(false)
  const activeClientId = ref<string | null>(null)
  const perspectiveTeam = ref<Team | null>(null)
  const messagesReceived = ref(0)
  const lastMessageTime = ref(0)
  function recordMessage(): void {
    messagesReceived.value += 1
    lastMessageTime.value = Date.now()
  }
  return { connected, activeClientId, perspectiveTeam, messagesReceived, lastMessageTime, recordMessage }
})
