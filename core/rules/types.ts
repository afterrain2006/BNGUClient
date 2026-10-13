import type { RawMqttMessage } from '@core/contracts/RawMqttMessage'
import type { ClientUpdate } from '@core/contracts/ClientUpdate'
import type { OperatorInput, OperatorInputPolicy } from '@core/contracts/OperatorInput'
import type { OutboundMqttMessage } from '@core/contracts/OutboundMqttMessage'

export interface MqttRule {
  handle(message: RawMqttMessage): ClientUpdate[]
  reset(): void
}

export interface MqttControlRule {
  inputPolicy: OperatorInputPolicy
  encode(input: OperatorInput): Promise<OutboundMqttMessage[]>
}
