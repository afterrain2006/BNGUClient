import { mergeOperatorInputs, type OperatorInput } from '@core/contracts/OperatorInput'
import type { OutboundMqttMessage } from '@core/contracts/OutboundMqttMessage'
import type { MqttControlRule } from '@core/rules/types'

// One active send and one coalesced pending input. Relative motion accumulates;
// key/button state is replaced. A release frame discards pending motion.
export function createControlSender(options: {
  rule: MqttControlRule
  publish(message: OutboundMqttMessage): Promise<boolean>
  onError(error: unknown): void
}) {
  let generation = 0
  let connection: string | null = null
  let disposed = false
  let sendingGeneration: number | undefined
  let pending: OperatorInput | null = null

  async function dispatch(input: OperatorInput, session: number): Promise<void> {
    sendingGeneration = session
    try {
      const messages = await options.rule.encode(input)
      for (const message of messages) {
        if (session !== generation || disposed || connection === null) return
        if (!await options.publish(message)) throw new Error('MQTT control publish failed')
      }
    } catch (error) {
      if (session === generation && !disposed) options.onError(error)
    } finally {
      if (sendingGeneration === session) {
        sendingGeneration = undefined
        const next = pending
        pending = null
        if (next) void dispatch(next, session)
      }
    }
  }

  return {
    setConnection(identity: string | null): void {
      if (identity === connection) return
      connection = identity
      generation += 1
      pending = null
      sendingGeneration = undefined
    },
    send(input: OperatorInput, options: { force?: boolean } = {}): void {
      if (disposed || connection === null) return
      if (sendingGeneration === generation) {
        pending = options.force || !pending ? input : mergeOperatorInputs(pending, input)
      } else {
        void dispatch(input, generation)
      }
    },
    dispose(): void {
      disposed = true
      generation += 1
      pending = null
      sendingGeneration = undefined
    }
  }
}
