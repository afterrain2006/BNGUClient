import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('desktop identity and build entry points consistently use BNGUClient', () => {
  const pkg = JSON.parse(read('package.json'))
  const config = JSON.parse(read('src-tauri/tauri.conf.json'))
  assert.equal(pkg.name, 'bnguclient')
  assert.equal(config.productName, 'BNGUClient')
  assert.equal(config.app.windows[0].title, 'BNGUClient')
  assert.equal(config.identifier, 'io.github.afterrain2006.bnguclient')
  assert.equal(config.version, pkg.version)
  assert.match(read('src-tauri/Cargo.toml'), /\[\[bin\]\]\s+name = "BNGUClient"/)
  assert.match(read('src-tauri/Cargo.toml'), /name = "bnguclient_lib"/)
  assert.match(read('src-tauri/src/main.rs'), /bnguclient_lib::run\(\)/)
  assert.match(read('index.html'), /<title>BNGUClient<\/title>/)
  assert.match(pkg.scripts['build:desktop'], /tauri build --no-bundle/)
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /onnx|tensorrt|package-(lite|mini|single)/i)
})

test('AI and placeholder distribution are removed without removing client capabilities', () => {
  for (const file of [
    'scripts/detection_pipe_server.py', 'src-tauri/src/shm_bridge.rs',
    'src/components/Dashboard/DetectionService.vue', 'src/components/DetectionOverlay.vue',
    'src/components/Dashboard/PerformanceOptimizer.vue', 'src/domain/vision/Detection.ts',
    'SharkVisionLiteServer-open-source-v1.0.0-20260519.zip'
  ]) assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), false, file)
  for (const file of ['src/views/Dashboard.vue', 'src/views/Settings.vue', 'src/api-shim.ts', 'src/store/modules/dashboard.ts', 'src-tauri/src/lib.rs']) {
    assert.doesNotMatch(read(file), /DetectionService|DetectionOverlay|pipeServer|pipe_server|shm_bridge|toggleDetection|webrtcDistribute|enableSimulation|startHeatSimulation/, file)
  }
  for (const file of ['src/input/mqttRuleRunner.ts', 'src/rules/rm2026/control.ts', 'src/stores/robotStore.ts', 'src/input/customDataInput.ts', 'src-tauri/src/udp_bridge.rs', 'src-tauri/src/video_decoder.rs']) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file)
  }
  const pkg = JSON.parse(read('package.json'))
  for (const name of ['mqtt', 'simple-peer', 'ws', 'lz4js', 'zstd-codec', '@oneidentity/zstd-js']) assert.equal(pkg.dependencies[name], undefined)
})

test('crosshair heat is projected from telemetry rather than a simulation timer', () => {
  const dashboard = read('src/views/Dashboard.vue')
  assert.match(dashboard, /telemetry\.getRobot\(telemetry\.currentRobotId\)/)
  assert.match(dashboard, /robot\.currentHeat \/ robot\.maxHeat/)
  assert.doesNotMatch(dashboard, /heatTimer|muzzleHeat|HEAT_SIMULATION_INTERVAL/)
})

test('runtime source has no old product prefixes; C and Rust video shim symbols agree', () => {
  function walk(url) {
    return readdirSync(url, { withFileTypes: true }).flatMap(entry => {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url)
      return entry.isDirectory() ? walk(path) : /\.(vue|ts|rs|c)$/.test(entry.name) ? [path] : []
    })
  }
  for (const base of ['src/', 'src-tauri/src/']) for (const file of walk(new URL(`../${base}`, import.meta.url))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /SharkClient|SHARK_|shark_|shark\./, file.pathname)
  }
  const rust = read('src-tauri/src/ffmpeg_ffi.rs')
  const c = read('src-tauri/src/ffmpeg_shim.c')
  for (const [, symbol] of rust.matchAll(/pub fn (bnguclient_\w+)\(/g)) assert.match(c, new RegExp(`\\b${symbol}\\s*\\(`), symbol)
  assert.match(read('src-tauri/build.rs'), /build\.compile\("bnguclient_ffmpeg_shim"\)/)
})
