import type { RawMqttMessage } from '@/contracts/RawMqttMessage'
import type { ClientUpdate } from '@/contracts/ClientUpdate'
import type { OperatorInput, OperatorInputPolicy } from '@/contracts/OperatorInput'
import type { OutboundMqttMessage } from '@/contracts/OutboundMqttMessage'

export interface MqttRule {
  handle(message: RawMqttMessage): ClientUpdate[]
  reset(): void
}

export interface MqttControlRule {
  inputPolicy: OperatorInputPolicy
  encode(input: OperatorInput): Promise<OutboundMqttMessage[]>
}
