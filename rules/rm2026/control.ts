import type { MqttControlRule } from '@core/rules/types'
import { encodeRm2026Command } from '@rules/rm2026/commands'

const KEYBOARD_BITS_BY_CODE = new Map<string, number>([
  ['KeyW', 1 << 0], ['KeyS', 1 << 1], ['KeyA', 1 << 2], ['KeyD', 1 << 3],
  ['ShiftLeft', 1 << 4], ['ShiftRight', 1 << 4],
  ['ControlLeft', 1 << 5], ['ControlRight', 1 << 5],
  ['KeyQ', 1 << 6], ['KeyE', 1 << 7], ['KeyR', 1 << 8], ['KeyF', 1 << 9],
  ['KeyG', 1 << 10], ['KeyZ', 1 << 11], ['KeyX', 1 << 12], ['KeyC', 1 << 13],
  ['KeyV', 1 << 14], ['KeyB', 1 << 15]
])

function int32(value: number): number {
  return Math.max(-2147483648, Math.min(2147483647, Math.round(value)))
}

export function createRm2026ControlRule(): MqttControlRule {
  return {
    inputPolicy: { keys: [...KEYBOARD_BITS_BY_CODE.keys()], frameRateHz: 75, idleHeartbeatMs: 250 },
    async encode(input) {
      let keyboardValue = 0
      for (const code of input.pressedKeys) keyboardValue |= KEYBOARD_BITS_BY_CODE.get(code) ?? 0
      return [{
        topic: 'KeyboardMouseControl', qos: 0, retain: false,
        payload: await encodeRm2026Command('KeyboardMouseControl', {
          mouseX: int32(input.mouse.deltaX),
          mouseY: int32(-input.mouse.deltaY),
          mouseZ: int32(-input.mouse.wheelSteps),
          leftButtonDown: input.buttons.left,
          rightButtonDown: input.buttons.right,
          midButtonDown: input.buttons.middle,
          keyboardValue
        })
      }]
    }
  }
}
