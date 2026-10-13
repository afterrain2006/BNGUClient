import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RobotConfigFile } from '@/config/robot-config'

// UI selection only. Never used to route incoming telemetry or change MQTT identity.
export const useRobotSelectionStore = defineStore('robotSelection', () => {
  const selectedRobotName = ref('')
  const config = ref<RobotConfigFile>({})
  const selectedRobotId = computed(() => config.value.robotMappings?.[selectedRobotName.value]?.id ?? 0)
  let loading: Promise<void> | undefined
  async function loadMappings(): Promise<void> {
    loading ??= window.api.getRobotConfig().then((value: RobotConfigFile) => { config.value = value })
    await loading
  }
  async function selectRobot(name: string): Promise<void> {
    selectedRobotName.value = name
    await loadMappings()
  }
  return { selectedRobotName, selectedRobotId, config, loadMappings, selectRobot }
})
