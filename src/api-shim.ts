import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Buffer } from 'buffer';
import { encodeRm2026Command } from '@/rules/rm2026';
import { version as clientVersion } from '../package.json';

type CommandResult = {
  success: boolean;
  error?: string;
  [key: string]: unknown;
};

function toCommandResult(result: unknown): CommandResult {
  if (typeof result === 'boolean') {
    return { success: result };
  }

  if (result && typeof result === 'object' && 'success' in result) {
    const typedResult = result as Record<string, unknown>;
    return {
      ...typedResult,
      success: Boolean(typedResult.success),
      error: typeof typedResult.error === 'string' ? typedResult.error : undefined
    };
  }

  return { success: Boolean(result) };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return String(error);
}

function normalizeUint8Array(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }

  if (data && typeof data === 'object') {
    const entries = Object.entries(data)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === 'number')
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (entries.length > 0) {
      return new Uint8Array(entries.map(([, value]) => value));
    }
  }

  throw new Error(`Unsupported UDP frame payload: ${Object.prototype.toString.call(data)}`);
}

function normalizeBinaryPayload(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data.map((value) => Number(value) & 0xff));
  }

  if (data && typeof data === 'object') {
    const entries = Object.entries(data)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === 'number')
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (entries.length > 0) {
      return Uint8Array.from(entries.map(([, value]) => Number(value) & 0xff));
    }
  }

  throw new Error(`Unsupported MQTT payload: ${Object.prototype.toString.call(data)}`);
}

export interface UdpFrameInfo {
  type: string; // 'jpeg' | 'h264' | 'h265' | 'unknown'
  isKeyframe: boolean;
}

let udpFrameCallback: ((frame: { data: Uint8Array; info: UdpFrameInfo }) => void) | null = null;
let udpFrameGeneration = 0;

// ==================== Binary Frame Protocol ====================
//
// Compact (4-byte) header: JPEG / H.264 / H.265 passthrough.
//   [type: u8] [is_keyframe: u8] [reserved: u16] [payload...]
//
// Type codes:
//   0x00 = jpeg, 0x01 = h264, 0x02 = h265, 0xFF = unknown

const FRAME_TYPE_LABEL: Record<number, string> = {
  0x00: 'jpeg',
  0x01: 'h264',
  0x02: 'h265',
  0xff: 'unknown'
};
const IPC_HEADER_SIZE = 4;

function dispatchChannelFrame(raw: unknown, generation: number): void {
  if (!udpFrameCallback || generation !== udpFrameGeneration) {
    return;
  }

  try {
    const u8 =
      typeof raw === 'string'
        ? Buffer.from(raw, 'base64')
        : normalizeUint8Array(raw);
    if (u8.byteLength < IPC_HEADER_SIZE) {
      throw new Error(`Frame too small: ${u8.byteLength}B`);
    }

    const typeCode = u8[0];
    const isKeyframe = u8[1] === 1;

    const payload = u8.subarray(IPC_HEADER_SIZE);
    udpFrameCallback({
      data: payload,
      info: {
        type: FRAME_TYPE_LABEL[typeCode] ?? 'unknown',
        isKeyframe
      }
    });
  } catch (error) {
    console.error('[UDP] Failed to dispatch binary frame:', error);
  }
}

type MqttStatusPayload = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected: boolean;
  clientId: string | null;
  revision: number;
};

function normalizeMqttStatusPayload(payload: unknown): MqttStatusPayload {
  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Partial<MqttStatusPayload>;
    const status =
      typedPayload.status === 'connected' ||
      typedPayload.status === 'connecting' ||
      typedPayload.status === 'error' ||
      typedPayload.status === 'disconnected'
        ? typedPayload.status
        : typedPayload.connected
          ? 'connected'
          : 'disconnected';

    return {
      status,
      connected: Boolean(typedPayload.connected ?? (status === 'connected')),
      clientId: typeof typedPayload.clientId === 'string' ? typedPayload.clientId : null,
      revision: typeof typedPayload.revision === 'number' && Number.isSafeInteger(typedPayload.revision)
        ? typedPayload.revision
        : 0
    };
  }

  return {
    status: Boolean(payload) ? 'connected' : 'disconnected',
    connected: Boolean(payload),
    clientId: null,
    revision: 0
  };
}

function normalizeLocalBrokerStatus(payload: unknown): { status: string; port: number } {
  if (payload && typeof payload === 'object') {
    const typedPayload = payload as { status?: unknown; port?: unknown };
    return {
      status: typeof typedPayload.status === 'string' ? typedPayload.status : 'stopped',
      port: typeof typedPayload.port === 'number' ? typedPayload.port : 3333
    };
  }

  return { status: 'stopped', port: 3333 };
}

// @ts-ignore - Ignore complex type issues temporarily for Phase 1

// Frontend-side F11 handler (registered on demand via setF11Shortcut).
// Uses capture phase + preventDefault to beat the webview's default handler.
let f11KeyHandler: ((ev: KeyboardEvent) => void) | null = null;
function installF11Handler(): void {
  if (f11KeyHandler) return;
  const handler = (ev: KeyboardEvent): void => {
    if (ev.key === 'F11' && !ev.repeat) {
      ev.preventDefault();
      ev.stopPropagation();
      invoke('toggle_fullscreen').catch((err) => {
        console.error('[F11] toggle_fullscreen failed:', err);
      });
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  f11KeyHandler = handler;
}
function uninstallF11Handler(): void {
  if (!f11KeyHandler) return;
  window.removeEventListener('keydown', f11KeyHandler, { capture: true } as unknown as EventListenerOptions);
  f11KeyHandler = null;
}

const api: any = {
  selectDirectory: async () => await invoke('select_directory'),
  selectFile: async () => await invoke('select_file'),
  sendRobotCommand: async (cmd: string, payload?: any) => { console.log("MOCK: sendRobotCommand", cmd, payload); },
  invokeRobot: async (method: string, ...args: any[]) => { console.log("MOCK: invokeRobot", method, args); },
  onTelemetry: (_cb: any) => { return () => {}; },
  
  getBoundaryCorners: async () => [],
  setBoundaryCorners: async (_corners: any) => {},
  
  getSetting: async (key: string) => await invoke('get_setting', { key }),
  saveSetting: async (key: string, value: any) => await invoke('save_setting', { key, value }),
  
  readModelFile: async (relativePath: string) => {
    try {
        const res = await fetch(`/${relativePath}`);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
    } catch {
        return null;
    }
  },
  getPreloadedModel: async () => null,
  isModelPreloaded: async () => false,
  
  getCrosshairPresets: async () => [],
  saveCrosshairPreset: async (_preset: any) => {},
  deleteCrosshairPreset: async (_presetName: string) => {},
  
  getCustomDataBlocks: async () => [],
  saveCustomDataBlocks: async (_blocks: any) => {},
  syncSendDataProto: async (_blocks: any) => {},
  parseCustomData: async (_protoPath: string, _buffer: Uint8Array) => null,
  
  getAppInfo: async () => ({ name: 'BNGUClient', version: clientVersion }),
  getRobotTypes: async () => await invoke('get_robot_types'),
  getRobotConfig: async () => await invoke('get_robot_config'),
  getRobotConfigByName: async (name: string) => await invoke('get_robot_config_by_name', { name }),
  readYamlConfig: async (filename: string) => await invoke('read_yaml_config', { filename }),
  
  hud: {
    getTemplates: async () => await invoke('hud_get_templates'),
    saveTemplate: async (filename: string, content: string) =>
      await invoke('hud_save_template', { filename, content }),
    updateTemplateTitle: async (id: string, title: string) =>
      await invoke('hud_update_template_title', { id, title }),
    deleteTemplate: async (id: string) => await invoke('hud_delete_template', { id }),
    onTemplateChanged: (cb: any) => {
      let unlisten: any;
      listen('hud-template-changed', (event) => cb(event.payload)).then(u => unlisten = u);
      return () => unlisten?.();
    }
  },
  
  dashboardConfig: {
    list: async () => await invoke('dashboard_config_list'),
    load: async (filename: string) => await invoke('dashboard_config_load', { filename }),
    save: async (filename: string, content: string) => await invoke('dashboard_config_save', { filename, content }),
    delete: async (filename: string) => await invoke('dashboard_config_delete', { filename }),
    checkPanelUsage: async (panelId: string) => await invoke('dashboard_config_check_panel_usage', { panelId })
  },
  
  graphic: {
    getAllCategories: async () => await invoke('graphic_get_all_categories'),
    getList: async () => await invoke('graphic_get_list'),
    save: async (filename: string, content: string) =>
      await invoke('graphic_save', { filename, content }),
    delete: async (filename: string) => await invoke('graphic_delete', { filename }),
    rename: async (oldName: string, newName: string) =>
      await invoke('graphic_rename', { oldName, newName })
  },
  
  saveTerrainData: async (_data: any) => {},
  loadTerrainData: async () => null,
  
  mapConfig: {
    list: async () => [],
    load: async (_filename: string) => null,
    detect: async (_data: any) => {},
    sendProtocolData: async (_data: unknown) => {},
    delete: async (_filename: string) => {}
  },
  
  openDevTools: async () => {
    try {
      await invoke('open_devtools');
    } catch (err) {
      console.warn('[devtools] open failed:', err);
    }
  },
  closeDevTools: async () => {},
  isDevToolsOpened: async () => false,
  setF11Shortcut: (enabled: boolean) => {
    if (enabled) {
      installF11Handler();
    } else {
      uninstallF11Handler();
    }
  },
  toggleFullscreen: async () => await invoke('toggle_fullscreen'),
  setFullscreen: async (fullscreen: boolean) =>
    await invoke('set_fullscreen', { fullscreen }),
  logWorkerMessage: () => {},
  getRandomBytes: (size: number) => new Uint8Array(size),
  readVideoFile: async (_filePath: string) => {
    // Return empty array for now or fetch if it's relative
    return new Uint8Array();
  },
  
  setMatchStatus: () => {},
  onMatchStatusChanged: () => { return () => {}; },
  minimize: async () => {
    try { await invoke('window_minimize'); } catch (err) { console.warn('[window] minimize failed:', err); }
  },
  maximize: async () => {
    try { await invoke('window_toggle_maximize'); } catch (err) { console.warn('[window] toggle maximize failed:', err); }
  },
  close: async () => {
    try { await invoke('app_close'); } catch (err) { console.warn('[window] close failed:', err); }
  },
  onMaximizedStateChanged: () => { return () => {}; },
  
  udpStream: {
    getDecodeCapabilities: async () => await invoke('get_decode_capabilities'),
    start: async (config: any) => {
      try {
        const generation = ++udpFrameGeneration;
        // Raw bytes channel carrying [type, keyframe, 0, 0, payload...].
        const frameChannel = new Channel<unknown>((message) => {
          dispatchChannelFrame(message, generation);
        });

        return toCommandResult(await invoke('udp_stream_start', { config, frameChannel }));
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error)
        };
      }
    },
    stop: async () => {
      try {
        udpFrameGeneration++;
        udpFrameCallback = null;
        return toCommandResult(await invoke('udp_stream_stop'));
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error)
        };
      }
    },
    getStatus: async () => await invoke('udp_stream_get_status'),
    getLatestMjpegFrame: async () => await invoke('udp_stream_get_latest_mjpeg_frame'),
    onFrame: async (cb: any) => {
        udpFrameCallback = cb;
        return () => {
          if (udpFrameCallback === cb) {
            udpFrameCallback = null;
          }
        };
    },
    onError: (cb: any) => {
        let unlisten: any;
        listen('udp-stream-error', (event) => cb(event.payload)).then(u => unlisten = u);
        return () => unlisten?.();
    },
    onStats: (cb: any) => {
        let unlisten: any;
        listen('udp-stream-stats', (event) => cb(event.payload)).then(u => unlisten = u);
        return () => unlisten?.();
    }
  },
  
  startSignalingServer: async () => {},
  stopSignalingServer: async () => {},
  
  getVehicleAttitudeMap: async (_vehicleId: number) => null,
  listVehiclePhysicsConfigs: async () => [],
  
  onSignalingStatus: () => { return () => {}; },
  onSignalingOffer: () => { return () => {}; },
  sendSignalingAnswer: () => {},
  sendSignalingCandidate: () => {},
  
  mqtt: {
    connect: async (config: any) => await invoke('mqtt_connect', { config }),
    disconnect: async () => await invoke('mqtt_disconnect'),
    publish: async (data: any) => {
      try {
        const payload = await encodeRm2026Command(
          data.messageType || data.topic,
          data.payload ?? {}
        );
        const result = await invoke('mqtt_publish', {
          data: {
            topic: data.topic,
            payload: Array.from(payload),
            qos: data.qos ?? 1,
            retain: data.retain ?? false
          }
        });

        return toCommandResult(result);
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error)
        };
      }
    },
    publishRaw: async (data: any) => {
      try {
        const payloadBytes = data.payload instanceof Uint8Array
          ? Array.from(data.payload)
          : Array.isArray(data.payload)
            ? data.payload
            : Array.from(normalizeBinaryPayload(data.payload));
        const result = await invoke('mqtt_publish_raw', {
          data: {
            topic: data.topic,
            payload: payloadBytes,
            qos: data.qos ?? 1,
            retain: data.retain ?? false
          }
        });
        return toCommandResult(result);
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error)
        };
      }
    },
    subscribe: async (topics: any) => await invoke('mqtt_subscribe', { topics }),
    unsubscribe: async (topics: any) => await invoke('mqtt_unsubscribe', { topics }),
    getStatus: async () => normalizeMqttStatusPayload(await invoke('mqtt_get_status')),
    onStatus: (cb: any) => {
        let unlisten: any;
        listen('mqtt-status', (event) => cb(normalizeMqttStatusPayload(event.payload))).then(u => unlisten = u);
        return () => unlisten?.();
    },
    onRobotStatus: () => { return () => {}; },
    onRadarData: () => { return () => {}; },
    onHeartbeat: () => { return () => {}; },
    startLocalBroker: async (port: number) => toCommandResult(await invoke('mqtt_start_local_broker', { port })),
    stopLocalBroker: async () => await invoke('mqtt_stop_local_broker'),
    getLocalBrokerStatus: async () => normalizeLocalBrokerStatus(await invoke('mqtt_get_local_broker_status')),
    onLocalBrokerStatus: () => { return () => {}; },
    getStats: async () => await invoke('mqtt_get_stats'),
    resetStats: async () => toCommandResult(await invoke('mqtt_reset_stats'))
  }
};

(window as any).api = api;
