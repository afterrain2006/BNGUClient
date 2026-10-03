export interface OutboundMqttMessage {
  topic: string
  payload: Uint8Array
  qos: 0 | 1 | 2
  retain: boolean
}
