import { getProtoRoot } from './decoder'

function readRecordNumber(record: Record<string, unknown>, camelKey: string, snakeKey: string): number {
  const value = record[camelKey] ?? record[snakeKey] ?? 0;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid KeyboardMouseControl payload: ${camelKey} must be a finite number`);
  }

  return Math.trunc(value);
}

function readRecordBool(record: Record<string, unknown>, camelKey: string, snakeKey: string): boolean {
  const value = record[camelKey] ?? record[snakeKey] ?? false;

  if (typeof value !== 'boolean') {
    throw new Error(`Invalid KeyboardMouseControl payload: ${camelKey} must be a boolean`);
  }

  return value;
}

function writeVarint32(bytes: number[], value: number): void {
  let unsignedValue = value >>> 0;

  while (unsignedValue > 0x7f) {
    bytes.push((unsignedValue & 0x7f) | 0x80);
    unsignedValue >>>= 7;
  }

  bytes.push(unsignedValue);
}

function writeInt32Varint(bytes: number[], value: number): void {
  if (value >= 0) {
    writeVarint32(bytes, value);
    return;
  }

  let unsignedValue = BigInt.asUintN(64, BigInt(value));

  while (unsignedValue > 0x7fn) {
    bytes.push(Number((unsignedValue & 0x7fn) | 0x80n));
    unsignedValue >>= 7n;
  }

  bytes.push(Number(unsignedValue));
}

function writeBoolVarint(bytes: number[], value: boolean): void {
  bytes.push(value ? 1 : 0);
}

function encodeKeyboardMouseControlPayload(payload: unknown): Uint8Array {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid KeyboardMouseControl payload: payload must be an object');
  }

  const record = payload as Record<string, unknown>;
  const mouseX = readRecordNumber(record, 'mouseX', 'mouse_x');
  const mouseY = readRecordNumber(record, 'mouseY', 'mouse_y');
  const mouseZ = readRecordNumber(record, 'mouseZ', 'mouse_z');
  const keyboardValue = readRecordNumber(record, 'keyboardValue', 'keyboard_value');
  const leftButtonDown = readRecordBool(record, 'leftButtonDown', 'left_button_down');
  const rightButtonDown = readRecordBool(record, 'rightButtonDown', 'right_button_down');
  const midButtonDown = readRecordBool(record, 'midButtonDown', 'mid_button_down');

  if (
    mouseX < -0x80000000 ||
    mouseX > 0x7fffffff ||
    mouseY < -0x80000000 ||
    mouseY > 0x7fffffff ||
    mouseZ < -0x80000000 ||
    mouseZ > 0x7fffffff
  ) {
    throw new Error('Invalid KeyboardMouseControl payload: mouse fields must fit int32');
  }

  if (keyboardValue < 0 || keyboardValue > 0xffffffff) {
    throw new Error('Invalid KeyboardMouseControl payload: keyboardValue must fit uint32');
  }

  const bytes: number[] = [];

  bytes.push(0x08);
  writeInt32Varint(bytes, mouseX);
  bytes.push(0x10);
  writeInt32Varint(bytes, mouseY);
  bytes.push(0x18);
  writeInt32Varint(bytes, mouseZ);
  bytes.push(0x20);
  writeBoolVarint(bytes, leftButtonDown);
  bytes.push(0x28);
  writeBoolVarint(bytes, rightButtonDown);
  bytes.push(0x30);
  writeVarint32(bytes, keyboardValue);
  bytes.push(0x38);
  writeBoolVarint(bytes, midButtonDown);

  return new Uint8Array(bytes);
}

export async function encodeRm2026Command(messageType: string, payload: unknown): Promise<Uint8Array> {
  if (messageType === 'KeyboardMouseControl') {
    return encodeKeyboardMouseControlPayload(payload);
  }

  const root = getProtoRoot();
  const MessageType = root.lookupType(messageType);
  const errMsg = MessageType.verify(payload as Record<string, unknown>);

  if (errMsg) {
    throw new Error(`Invalid ${messageType} payload: ${errMsg}`);
  }

  const message = MessageType.fromObject(payload as Record<string, unknown>);
  return MessageType.encode(message).finish();
}
