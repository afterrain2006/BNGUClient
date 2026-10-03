/** Transport-neutral MQTT message passed from an input adapter to a Rule. */
export interface RawMqttMessage {
  topic: string
  payload: Uint8Array
}
