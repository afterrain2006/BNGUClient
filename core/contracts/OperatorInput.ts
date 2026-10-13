// Browser-coordinate input, not robot actions or a competition wire format.
export interface OperatorInput {
  mouse: { deltaX: number; deltaY: number; wheelSteps: number }
  buttons: { left: boolean; right: boolean; middle: boolean }
  pressedKeys: readonly string[]
}

export interface OperatorInputPolicy {
  keys: readonly string[]
  frameRateHz: number
  idleHeartbeatMs: number
}

export function neutralOperatorInput(): OperatorInput {
  return {
    mouse: { deltaX: 0, deltaY: 0, wheelSteps: 0 },
    buttons: { left: false, right: false, middle: false },
    pressedKeys: []
  }
}

export function mergeOperatorInputs(previous: OperatorInput, next: OperatorInput): OperatorInput {
  return {
    mouse: {
      deltaX: previous.mouse.deltaX + next.mouse.deltaX,
      deltaY: previous.mouse.deltaY + next.mouse.deltaY,
      wheelSteps: previous.mouse.wheelSteps + next.mouse.wheelSteps
    },
    buttons: { ...next.buttons },
    pressedKeys: [...next.pressedKeys]
  }
}
