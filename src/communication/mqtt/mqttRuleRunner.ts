import type { UnlistenFn } from '@tauri-apps/api/event'
import { mqttAdapter } from '@/communication/mqtt/mqttAdapter'
import type { MqttRule } from '@core/rules/types'
import { useRobotStore } from '@/state/telemetry/robotStore'
import { useMatchStore } from '@/state/telemetry/matchStore'
import { useConnectionStore } from '@/state/telemetry/connectionStore'
import { useCustomDataStore } from '@/state/telemetry/customDataStore'
import { createCustomDataInput } from '@/communication/custom-data/customDataInput'

export async function startMqttRule(rule: MqttRule): Promise<UnlistenFn> {
  const robotStore = useRobotStore()
  const matchStore = useMatchStore()
  const connectionStore = useConnectionStore()
  const customDataStore = useCustomDataStore()
  const customInput = createCustomDataInput({
    loadConfig: () => window.api.getRobotConfig(),
    parse: (path, bytes) => window.api.parseCustomData(path, bytes),
    apply: customDataStore.set
  })
  let acceptingMessages = true

  const unlistenStatus = await mqttAdapter.onStatus(status => {
    acceptingMessages = status.connected
    if (!status.connected) {
      rule.reset()
      customInput.reset()
    }
  })

  try {
    const unlistenMessage = await mqttAdapter.onMessage(message => {
      if (!acceptingMessages) return
      connectionStore.recordMessage()

      try {
        for (const update of rule.handle(message)) {
          if (!('scope' in update)) robotStore.applyUpdate(update)
          else if (update.scope === 'match') matchStore.applyUpdate(update)
          else customInput.handle(update)
        }
      } catch (error) {
        console.error('[MQTT Rule Runner] failed to process message', error)
      }
    })

    return () => {
      acceptingMessages = false
      customInput.dispose()
      unlistenMessage()
      unlistenStatus()
      rule.reset()
    }
  } catch (error) {
    customInput.dispose()
    unlistenStatus()
    rule.reset()
    throw error
  }
}
