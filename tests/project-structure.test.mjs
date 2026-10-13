import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'
import protobuf from 'protobufjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => readFileSync(path.join(root, file), 'utf8')
function files(folder) {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(entry => {
    const file = `${folder}/${entry.name}`
    return entry.isDirectory() ? files(file) : /\.(ts|vue|cjs)$/.test(file) ? [file] : []
  })
}
function resolve(from, specifier) {
  const aliases = { '@/': 'src/', '@core/': 'core/', '@rules/': 'rules/' }
  const alias = Object.keys(aliases).find(prefix => specifier.startsWith(prefix))
  if (alias) return aliases[alias] + specifier.slice(alias.length)
  if (specifier.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  return null
}
function imports(file) {
  return [...read(file).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"\n]+)['"]/g)].map(match => match[1])
}

test('core and protocol rules cannot depend back on the client or runtime', () => {
  for (const file of [...files('core'), ...files('rules')]) for (const specifier of imports(file)) {
    const resolved = resolve(file, specifier)
    if (file.startsWith('core/')) assert.ok(resolved?.startsWith('core/'), `${file}: ${specifier}`)
    else if (resolved) assert.ok(/^(?:core|rules)\//.test(resolved), `${file}: ${specifier}`)
    else assert.ok(['protobufjs/light', 'long'].includes(specifier), `${file}: ${specifier}`)
  }
})

test('client uses only the RM2026 public entry point and all local imports resolve', () => {
  for (const folder of ['src/rules', 'src/domain', 'src/contracts', 'src/store', 'src/stores', 'src/components', 'src/views', 'UDP-MQTT Server']) assert.equal(existsSync(path.join(root, folder)), false, `Obsolete duplicate directory: ${folder}`)
  for (const file of [...files('src'), ...files('core'), ...files('rules'), ...files('tools/robot-state-preview')]) {
    for (const specifier of imports(file)) {
      const resolved = resolve(file, specifier)
      if (!resolved) continue
      if (file.startsWith('src/') && resolved.startsWith('rules/')) assert.ok(['rules/rm2026', 'rules/rm2026/index.ts'].includes(resolved), `${file}: private rule import ${specifier}`)
      assert.ok([resolved, `${resolved}.ts`, `${resolved}.vue`, `${resolved}.json`, `${resolved}/index.ts`].some(candidate => existsSync(path.join(root, candidate))), `${file}: missing ${specifier}`)
    }
  }
})

test('RM2026 schema has one source shared by generation and Mock', () => {
  const source = protobuf.parse(read('rules/rm2026/proto/messages.proto')).root.toJSON()
  let nested = source.nested ?? {}
  const packages = Object.keys(nested)
  if (packages.length === 1 && nested[packages[0]].nested) nested = nested[packages[0]].nested
  assert.deepEqual(JSON.parse(read('rules/rm2026/generated/mqtt-proto.json')), { nested })
  assert.match(read('tools/rm2026-mock-server/src/protocol.ts'), /'rules', 'rm2026', 'proto', 'messages.proto'/)
  assert.match(read('scripts/generate-mqtt-proto-json.mjs'), /'rules', 'rm2026', 'proto', 'messages.proto'/)
  assert.match(read('scripts/verify-mqtt-proto.mjs'), /\['src', 'core', 'rules'\]/)
  assert.match(read('scripts/verify-mqtt-proto.mjs'), /'rules', 'rm2026', 'defaults.ts'/)
  for (const file of ['UDP-MQTT Server/proto/messages.proto', 'src/generated/mqtt-proto.json']) assert.equal(existsSync(path.join(root, file)), false, file)
  assert.doesNotMatch(read('src-tauri/src/video_decoder/gpu.rs'), /UDP-MQTT Server/)
})

const bundle = await build({
  entryPoints: [path.join(root, 'rules/rm2026/index.ts')], bundle: true,
  platform: 'node', format: 'esm', write: false, metafile: true,
  tsconfig: path.join(root, 'tsconfig.json')
})
const { parseRm2026Identity, DEFAULT_MQTT_CONFIG } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`)

test('standalone rule bundle needs no client and owns identity interpretation', () => {
  for (const file of Object.keys(bundle.metafile.inputs)) assert.equal(path.resolve(root, file).startsWith(path.join(root, 'src') + path.sep), false, file)
  assert.deepEqual(parseRm2026Identity('3'), { robotId: 3, team: 'red' })
  assert.deepEqual(parseRm2026Identity('103'), { robotId: 103, team: 'blue' })
  assert.equal(parseRm2026Identity('0'), null)
  assert.equal(parseRm2026Identity('003'), null)
  assert.equal(DEFAULT_MQTT_CONFIG.topics.length, 26)
  assert.doesNotMatch(read('src/app/rm2026RuleLifecycle.ts'), /selfRobotId\s*<\s*100|robotId\s*<\s*100/)
})
