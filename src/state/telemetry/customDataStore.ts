import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useCustomDataStore = defineStore('customData', () => {
  const data = reactive(new Map<number, Record<string, unknown>>())
  function set(robotId: number, value: Record<string, unknown>): void { data.set(robotId, value) }
  function clear(): void { data.clear() }
  return { data, set, clear }
})
