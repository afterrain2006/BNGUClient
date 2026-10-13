import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { RawMqttMessage } from '@core/contracts/RawMqttMessage'

export interface MqttStatus {
  status: string
  connected: boolean
  reconnectAttempt?: number
  clientId: string | null
  revision: number
}

export interface MqttPublishOptions {
  qos?: number
  retain?: boolean
}

type TauriRawMqttMessage = {
  topic: string
  payload: unknown
}

function normalizePayload(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload
  }

  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload)
  }

  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength
    )
  }

  if (Array.isArray(payload)) {
    return Uint8Array.from(
      payload.map(value => Number(value) & 0xff)
    )
  }

  throw new Error(
    `Unsupported MQTT payload: ${Object.prototype.toString.call(payload)}`
  )
}

function normalizeMessage(
  message: TauriRawMqttMessage
): RawMqttMessage {
  return {
    topic: message.topic,
    payload: normalizePayload(message.payload)
  }
}

export const mqttAdapter = {
  async connect(config: Record<string, unknown>): Promise<boolean> {
    return await invoke<boolean>('mqtt_connect', { config })
  },

  async disconnect(): Promise<boolean> {
    return await invoke<boolean>('mqtt_disconnect')
  },

  async subscribe(topics: string[]): Promise<boolean> {
    return await invoke<boolean>('mqtt_subscribe', { topics })
  },

  async unsubscribe(topics: string[]): Promise<boolean> {
    return await invoke<boolean>('mqtt_unsubscribe', { topics })
  },

  async publishRaw(
    topic: string,
    payload: Uint8Array,
    options: MqttPublishOptions = {}
  ): Promise<boolean> {
    return await invoke<boolean>('mqtt_publish_raw', {
      data: {
        topic,
        payload: Array.from(payload),
        qos: options.qos ?? 1,
        retain: options.retain ?? false
      }
    })
  },

  async getStatus(): Promise<MqttStatus> {
    return await invoke<MqttStatus>('mqtt_get_status')
  },

  async onStatus(
    handler: (status: MqttStatus) => void
  ): Promise<UnlistenFn> {
    return await listen<MqttStatus>(
      'mqtt-status',
      event => handler(event.payload)
    )
  },

  async onMessage(
    handler: (message: RawMqttMessage) => void
  ): Promise<UnlistenFn> {
    const unlistenSingle = await listen<TauriRawMqttMessage>(
      'mqtt-message',
      event => {
        handler(normalizeMessage(event.payload))
      }
    )

    try {
      const unlistenBatch = await listen<TauriRawMqttMessage[]>(
        'mqtt-message-batch',
        event => {
          for (const message of event.payload) {
            handler(normalizeMessage(message))
          }
        }
      )

      return () => {
        unlistenSingle()
        unlistenBatch()
      }
    } catch (error) {
      unlistenSingle()
      throw error
    }
  }
}
