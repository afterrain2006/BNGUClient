import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import protobuf from 'protobufjs/light.js'

const bundle = await build({
  stdin: {
    contents: `
      export { createControlSender } from '../src/output/controlSender'
      export { createRm2026ControlRule } from '../src/rules/rm2026'
      export { neutralOperatorInput } from '../src/contracts/OperatorInput'
    `,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url))
})
const { createControlSender, createRm2026ControlRule, neutralOperatorInput } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)
const schema = protobuf.Root.fromJSON(JSON.parse(readFileSync(new URL('../src/generated/mqtt-proto.json', import.meta.url), 'utf8'))).lookupType('KeyboardMouseControl')
const tick = () => new Promise(resolve => setImmediate(resolve))
const input = (x, keys = ['KeyW']) => ({ ...neutralOperatorInput(), mouse: { deltaX: x, deltaY: 0, wheelSteps: 0 }, pressedKeys: keys })
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('RM2026 rule preserves keyboard bits, browser-axis conversion and neutral release', async () => {
  const rule = createRm2026ControlRule()
  assert.equal(rule.inputPolicy.frameRateHz, 75)
  const [message] = await rule.encode({
    mouse: { deltaX: 12, deltaY: 7, wheelSteps: -2 },
    buttons: { left: true, right: false, middle: true },
    pressedKeys: ['KeyW', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ControlRight', 'KeyB', 'Unknown']
  })
  assert.equal(message.topic, 'KeyboardMouseControl')
  assert.equal(message.qos, 0)
  assert.equal(message.retain, false)
  const value = schema.decode(message.payload)
  assert.equal(value.keyboardValue, 1 | 8 | 16 | 32 | 32768)
  assert.equal(value.mouseX, 12)
  assert.equal(value.mouseY, -7)
  assert.equal(value.mouseZ, 2)
  assert.equal(value.leftButtonDown, true)
  assert.equal(value.midButtonDown, true)
  const [neutral] = await rule.encode(neutralOperatorInput())
  assert.equal(schema.decode(neutral.payload).keyboardValue, 0)
  assert.equal(schema.decode(neutral.payload).leftButtonDown, false)
  const [clipped] = await rule.encode({ ...input(1e12), mouse: { deltaX: 1e12, deltaY: 1e12, wheelSteps: 0 } })
  assert.equal(schema.decode(clipped.payload).mouseX, 2147483647)
  assert.equal(schema.decode(clipped.payload).mouseY, -2147483648)
})

test('sender coalesces relative motion with latest key/button state', async () => {
  const gate = deferred(), encoded = [], published = []
  const sender = createControlSender({
    rule: { async encode(value) { encoded.push(value); return [{ topic: 'team/control', payload: Uint8Array.of(value.mouse.deltaX), qos: 0, retain: false }] } },
    publish: message => { published.push(message); return published.length === 1 ? gate.promise : Promise.resolve(true) },
    onError: error => assert.fail(String(error))
  })
  sender.setConnection('3')
  sender.send(input(1))
  await tick()
  sender.send(input(2))
  sender.send({ ...input(4, []), buttons: { left: false, right: true, middle: false } })
  assert.equal(published.length, 1)
  gate.resolve(true)
  await tick()
  assert.equal(published.length, 2)
  assert.equal(encoded[1].mouse.deltaX, 6)
  assert.deepEqual([...encoded[1].pressedKeys], [])
  assert.equal(encoded[1].buttons.right, true)
  assert.equal(published[1].topic, 'team/control')
  sender.dispose()
})

test('forced neutral discards pending motion and held keys', async () => {
  const gate = deferred(), encoded = []
  const sender = createControlSender({
    rule: { async encode(value) { encoded.push(value); return [{ topic: 'control', payload: new Uint8Array(), qos: 0, retain: false }] } },
    publish: () => encoded.length === 1 ? gate.promise : Promise.resolve(true),
    onError: error => assert.fail(String(error))
  })
  sender.setConnection('3')
  sender.send(input(1))
  await tick()
  sender.send(input(99))
  sender.send(neutralOperatorInput(), { force: true })
  gate.resolve(true)
  await tick()
  assert.deepEqual(encoded[1], neutralOperatorInput())
  sender.dispose()
})

test('disconnect and disposal cancel async encoding before transport publish', async () => {
  for (const stop of ['disconnect', 'dispose']) {
    const gate = deferred(), published = []
    const sender = createControlSender({
      rule: { encode: () => gate.promise },
      publish: async message => { published.push(message); return true },
      onError: error => assert.fail(String(error))
    })
    sender.send(input(1)) // Not connected: no encoding or publish.
    sender.setConnection('3')
    sender.send(input(2))
    if (stop === 'disconnect') sender.setConnection(null)
    else sender.dispose()
    gate.resolve([{ topic: 'control', payload: new Uint8Array(), qos: 0, retain: false }])
    await tick()
    assert.equal(published.length, 0)
  }
})

test('old send completion cannot drain or replace the new connection queue', async () => {
  const gates = [deferred(), deferred()], values = []
  const sender = createControlSender({
    rule: { async encode(value) { return [{ topic: 'control', payload: Uint8Array.of(value.mouse.deltaX), qos: 0, retain: false }] } },
    publish: message => { values.push(message.payload[0]); return gates[values.length - 1]?.promise ?? Promise.resolve(true) },
    onError: error => assert.fail(String(error))
  })
  sender.setConnection('3')
  sender.send(input(1))
  await tick()
  sender.send(input(2))
  sender.setConnection(null)
  sender.setConnection('103')
  sender.send(input(3))
  await tick()
  sender.send(input(4))
  gates[0].resolve(true)
  await tick()
  assert.deepEqual(values, [1, 3])
  gates[1].resolve(true)
  await tick()
  assert.deepEqual(values, [1, 3, 4])
  sender.dispose()
})

test('failed publish is reported, then latest pending input can proceed', async () => {
  const errors = [], values = []
  const sender = createControlSender({
    rule: createRm2026ControlRule(),
    publish: async message => { values.push(schema.decode(message.payload).mouseX); return values.length > 1 },
    onError: error => errors.push(error)
  })
  sender.setConnection('3')
  sender.send(input(1))
  sender.send(input(2))
  await tick()
  assert.deepEqual(values, [1, 2])
  assert.equal(errors.length, 1)
  sender.dispose()
})

test('capture UI and generic contracts do not encode RM2026 wire fields', () => {
  const ui = readFileSync(new URL('../src/components/RoboControl.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(ui, /keyboardValue|KEYBOARD_BITS|MOUSE_Y_PROTOCOL_DIRECTION|rm2026|protobuf/)
  const contract = readFileSync(new URL('../src/rules/types.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(contract, /adaptor|tauri|rm2026|protobuf/)
  const dashboard = readFileSync(new URL('../src/views/Dashboard.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(dashboard, /KeyboardMouseControl|keyboardValue|ROBO_CONTROL_QOS/)
})
