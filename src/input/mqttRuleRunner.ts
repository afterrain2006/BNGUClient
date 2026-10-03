import type { UnlistenFn } from '@tauri-apps/api/event'
import { mqttAdapter } from '@/adaptor/tauri/mqttAdapter'
import type { MqttRule } from '@/rules/types'
import { useRobotStore } from '@/stores/robotStore'
import { useMatchStore } from '@/stores/matchStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useCustomDataStore } from '@/stores/customDataStore'
import { createCustomDataInput } from './customDataInput'

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
