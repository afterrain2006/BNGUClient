import { mqttAdapter } from '@/communication/mqtt/mqttAdapter'
import { createRm2026ControlRule } from '@rules/rm2026'
import type { MqttControlRule } from '@core/rules/types'
import { createControlSender } from '@/communication/control/controlSender'

// The composition point for switching the control protocol; UI stays unchanged.
export function createClientControlOutput(rule: MqttControlRule = createRm2026ControlRule()) {
  let lastErrorAt = 0
  const sender = createControlSender({
    rule,
    publish: message => mqttAdapter.publishRaw(message.topic, message.payload, message),
    onError(error) {
      const now = Date.now()
      if (now - lastErrorAt < 1000) return
      lastErrorAt = now
      console.warn('[ControlOutput] 键鼠输入发送失败:', error)
    }
  })
  return { rule, sender }
}
