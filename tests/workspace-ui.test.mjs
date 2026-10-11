import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('workspace keeps the Dashboard mounted outside tool-page navigation', () => {
  const app = read('src/App.vue')
  assert.match(app, /<Dashboard ref="dashboard"/)
  assert.doesNotMatch(app, /<Dashboard[^>]*v-if/)
  assert.match(app, /<KeepAlive><component :is="components\[page\]"/)
  assert.match(app, /:key="page" ref="activeTool"/)
  assert.match(app, /<dialog[^>]*ref="menu"/)
  assert.match(app, /:inert="menuOpen"/)
  assert.match(app, /dashboard\.value\?\.releaseControl\(\)/)
  assert.doesNotMatch(app, /dock-wrapper/)
  assert.match(app, /setCustomHudMode\(true\)/)
  assert.match(app, /bnguclient\.hudPresentation/)
  assert.match(read('src/views/Dashboard.vue'), /props\.workbenchMode \|\| isHudInteractive \|\| props\.customHudMode/)
  assert.match(read('src/views/Settings.vue'), /const isF11Enabled = ref\(localStorage.getItem\(F11_STORAGE_KEY\) !== '0'\)/)
})

test('control is explicitly armed and released on menus, identity changes and window blur', () => {
  const dashboard = read('src/views/Dashboard.vue')
  assert.match(dashboard, /const controlArmed = ref\(false\)/)
  assert.match(dashboard, /:enabled="controlArmed && !isAnyMenuOpen && connectionStore.connected && !isDrawingMode"/)
  assert.match(dashboard, /watch\(isAnyMenuOpen, open => \{ if \(open\) releaseControl\(\)/)
  assert.match(dashboard, /roboControlRef\.value\?\.exitCapture\(\)/)
  assert.match(dashboard, /window\.addEventListener\('blur', releaseControl\)/)
  assert.match(dashboard, /window\.removeEventListener\('blur', releaseControl\)/)
  assert.match(read('src/components/RobotActionHint.vue'), /if \(!props.enabled \|\| event.repeat\) return/)
})

test('telemetry page uses real state and bounded samples rather than random robots', () => {
  const telemetry = read('src/views/Telemetry.vue')
  assert.match(telemetry, /useRobotStore/)
  assert.match(telemetry, /useConnectionStore/)
  assert.match(telemetry, /current\.healthUpdatedAt === sampledHealthAt/)
  assert.match(telemetry, /\.slice\(-120\)/)
  assert.doesNotMatch(telemetry, /Math\.random|initSampleRobots|simRunning|simInterval/)
  assert.match(telemetry, /healthFreshness.value !== 'fresh'/)
})

test('new workspace views do not decode MQTT or import RM2026 implementations', () => {
  for (const path of ['src/App.vue', 'src/components/CockpitOverlay.vue', 'src/views/Telemetry.vue']) {
    assert.doesNotMatch(read(path), /from ['"][^'"]*(?:rules\/rm2026|mqttPayloadDecoder|mqtt_data|protobuf|adaptor\/tauri)/, path)
  }
})
