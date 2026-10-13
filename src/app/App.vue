<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue'
import Dashboard from '@/pages/Cockpit.vue'
import Telemetry from '@/pages/Telemetry.vue'
import Settings from '@/pages/Settings.vue'
import CustomDataConfig from '@/pages/CustomData.vue'
import TitleBar from '@/ui/shell/TitleBar.vue'
import WorkspaceIcon from '@/ui/shell/WorkspaceIcon.vue'
import { useDashboardStore } from '@/state'
import { useConnectionStore } from '@/state/telemetry/connectionStore'

type Page = 'home' | 'telemetry' | 'data' | 'settings'
const pages = [
  { id: 'home', label: '操作中心', icon: 'home' },
  { id: 'telemetry', label: '遥测', icon: 'telemetry' },
  { id: 'data', label: '自定义数据', icon: 'data' },
  { id: 'settings', label: '系统设置', icon: 'settings' }
] as const
const components = { telemetry: Telemetry, data: CustomDataConfig, settings: Settings }
const store = useDashboardStore()
const connection = useConnectionStore()
const dashboard = ref<InstanceType<typeof Dashboard> | null>(null)
const menu = ref<HTMLDialogElement | null>(null)
const menuTrigger = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const page = ref<Page>('home')
const activeTool = ref<{ dismissOverlay?: () => boolean } | null>(null)
const focusMode = ref(false)
const workbenchMode = ref(false)
const customHudMode = ref(localStorage.getItem('bnguclient.hudPresentation') === 'custom')
const fullscreen = ref(true)
const currentPage = computed(() => pages.find(item => item.id === page.value)!)
let stopWindowState: (() => void) | undefined

provide('statusBarMethods', { updateScore: store.updateScore, resetScore: store.resetScore })
provide('robotStatus', computed(() => store.robotStatusFlags))
provide('updateRobotStatus', store.updateRobotStatusFlags)

async function openMenu(target: Page = 'home') {
  page.value = target
  menuOpen.value = true
  // Release before the dialog takes focus or a pending input frame runs.
  dashboard.value?.releaseControl()
  await nextTick()
  if (menuOpen.value && !menu.value?.open) menu.value?.showModal()
}
function closeMenu() {
  menuOpen.value = false
  menu.value?.close()
  // Returning to the cockpit never arms control.
  void nextTick(() => { if (!menuOpen.value) menuTrigger.value?.focus({ preventScroll: true }) })
}
function openDashboardSettings(tab: 'video' | 'network' | 'robot' | 'display') {
  closeMenu()
  dashboard.value?.openSettings(tab)
}
function openWorkbench() {
  closeMenu()
  focusMode.value = false
  workbenchMode.value = true
  store.isHudInteractive = true
}
function leaveWorkbench() {
  store.isHudInteractive = false
  store.setDrawingMode(false)
  workbenchMode.value = false
  setCustomHudMode(true)
}
function setCustomHudMode(enabled: boolean) {
  customHudMode.value = enabled
  localStorage.setItem('bnguclient.hudPresentation', enabled ? 'custom' : 'compact')
}
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.repeat) return
    if (menuOpen.value) {
      if (!activeTool.value?.dismissOverlay?.()) closeMenu()
    }
    else if (dashboard.value?.dismissOverlay()) return
    else if (workbenchMode.value) leaveWorkbench()
    else void openMenu()
    return
  }
  const editing = event.target instanceof HTMLElement && Boolean(event.target.closest('input, textarea, select, [contenteditable="true"]'))
  if (editing) return
  if (event.ctrlKey && /^[1-4]$/.test(event.key)) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!event.repeat) void openMenu(pages[Number(event.key) - 1].id)
  } else if (event.key === 'F10' && !event.repeat && !menuOpen.value && !workbenchMode.value) {
    event.preventDefault()
    focusMode.value = !focusMode.value
  } else if (event.key === 'F12' && !event.repeat && store.isDebugMode) {
    event.preventDefault()
    window.api.openDevTools?.()
  }
}
onMounted(() => {
  store.showRemainingTime = true
  window.api.setF11Shortcut(localStorage.getItem('bnguclient.f11Enabled') !== '0')
  stopWindowState = window.api.onMaximizedStateChanged?.(state => { fullscreen.value = state }) ?? undefined
  window.addEventListener('keydown', handleKeyDown, true)
})
onUnmounted(() => {
  stopWindowState?.()
  window.removeEventListener('keydown', handleKeyDown, true)
})
</script>

<template>
  <div id="app-root" class="workspace-root">
    <TitleBar v-if="!fullscreen" />
    <main class="cockpit-host" :inert="menuOpen">
      <!-- Persistent: menu navigation must not deactivate video or MQTT. -->
      <Dashboard ref="dashboard" :interaction-blocked="menuOpen" :focus-mode="focusMode" :workbench-mode="workbenchMode" :custom-hud-mode="customHudMode" />
      <div class="workspace-actions">
        <button v-if="workbenchMode" class="workspace-button" @click="leaveWorkbench">完成编辑</button>
        <button ref="menuTrigger" class="workspace-button menu-trigger" aria-label="打开操作菜单" aria-haspopup="dialog" :aria-expanded="menuOpen" @click="openMenu()">
          <WorkspaceIcon name="menu" :size="16" /><span>菜单</span><kbd>ESC</kbd>
        </button>
      </div>
      <span v-if="focusMode" class="focus-hint">专注模式 · F10 恢复状态面板</span>
    </main>
    <dialog ref="menu" class="workspace-menu" aria-labelledby="workspace-menu-title" @cancel.prevent="closeMenu">
      <header class="workspace-header">
        <div class="workspace-brand"><img src="/bnguclient.svg" alt="" /><strong>BNGUCLIENT</strong><span id="workspace-menu-title">/ {{ currentPage.label }}</span></div>
        <button class="workspace-button return-button" @click="closeMenu"><span>返回操作视野</span><kbd>ESC</kbd><WorkspaceIcon name="close" :size="16" /></button>
      </header>
      <div class="workspace-body">
        <nav class="workspace-nav" aria-label="操作菜单">
          <button v-for="item in pages" :key="item.id" :class="{ active: page === item.id }" :aria-current="page === item.id ? 'page' : undefined" @click="page = item.id">
            <WorkspaceIcon :name="item.icon" /><span>{{ item.label }}</span>
          </button>
          <button class="workbench-link" @click="openWorkbench"><WorkspaceIcon name="workspace" /><span>HUD 工作台</span></button>
        </nav>
        <section class="workspace-page" :aria-label="currentPage.label">
          <div v-if="page === 'home'" class="workspace-home">
            <p class="workspace-eyebrow">OPERATIONS / BNGUCLIENT</p>
            <h1>保持专注，掌握全局。</h1>
            <p class="workspace-description">菜单打开时释放键鼠控制，图传与遥测继续接收。返回视野后，请手动重新启用控制。</p>
            <div class="workspace-summary" :class="{ connected: connection.connected }"><i />{{ connection.connected ? 'MQTT 已连接' : 'MQTT 未连接' }}<span>连接身份 {{ connection.activeClientId ?? '—' }}</span></div>
            <div class="workspace-shortcuts">
              <button @click="openDashboardSettings('network')"><WorkspaceIcon name="link" /><strong>连接配置</strong><span>MQTT、UDP 与图传来源</span><WorkspaceIcon name="arrow" :size="16" /></button>
              <button @click="openDashboardSettings('video')"><WorkspaceIcon name="focus" /><strong>视频与显示</strong><span>视频源、摄像头与画面设置</span><WorkspaceIcon name="arrow" :size="16" /></button>
              <button @click="page = 'telemetry'"><WorkspaceIcon name="telemetry" /><strong>遥测检查</strong><span>真实状态、模块灯与数据新鲜度</span><WorkspaceIcon name="arrow" :size="16" /></button>
              <button @click="page = 'data'"><WorkspaceIcon name="data" /><strong>自定义数据</strong><span>检查接收字节与解析状态</span><WorkspaceIcon name="arrow" :size="16" /></button>
            </div>
            <div class="workspace-tools">
              <section><p class="workspace-eyebrow">DISPLAY / 显示</p><h2>适合操作，也保留自由。</h2><p>当前使用{{ customHudMode ? '自定义 HUD' : '紧凑状态面板' }}；复杂布局、绘图和面板定制放在高级工作台。</p><div class="workspace-tool-actions"><button class="workspace-button" @click="focusMode = !focusMode">{{ focusMode ? '关闭专注模式' : '开启专注模式' }} <kbd>F10</kbd></button><button class="workspace-button" @click="setCustomHudMode(!customHudMode)">{{ customHudMode ? '使用紧凑 HUD' : '使用自定义 HUD' }}</button><button class="workspace-button" @click="openWorkbench">编辑 HUD 布局</button></div></section>
              <section><p class="workspace-eyebrow">QUICK GUIDE / 快捷操作</p><dl><div><dt>Esc</dt><dd>打开 / 关闭菜单；优先退出当前弹窗或编辑</dd></div><div><dt>Ctrl + 1…4</dt><dd>操作中心 / 遥测 / 自定义数据 / 系统设置</dd></div><div><dt>F11</dt><dd>切换全屏（可在系统设置中关闭）</dd></div></dl></section>
            </div>
          </div>
          <KeepAlive><component :is="components[page]" v-if="page !== 'home'" :key="page" ref="activeTool" /></KeepAlive>
        </section>
      </div>
      <footer class="workspace-footer"><span><i :class="{ online: connection.connected }" />{{ connection.connected ? 'LIVE · MQTT' : 'OFFLINE · 未连接' }}</span><span>RX {{ connection.messagesReceived }} · 返回视野不会自动启用控制</span></footer>
    </dialog>
  </div>
</template>

<style scoped>
.workspace-root { --workspace-accent: #b1dfe5; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; color: #e0edf0; background: #081117; }
.cockpit-host { position: relative; flex: 1; min-height: 0; }
.workspace-actions { position: absolute; top: 24px; right: 28px; z-index: 150; display: flex; gap: 10px; }
.workspace-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 38px; padding: 8px 14px; color: #d8e9ed; background: #101d25df; border: 1px solid #6d8e9a66; border-radius: 4px; cursor: pointer; font: inherit; font-size: 12px; }
.workspace-button:hover { background: #253d49; border-color: #b1dfe5; }
kbd { font-family: var(--font-tech-mono); font-size: 11px; color: #acc3cc; }
.focus-hint { position: absolute; bottom: 15px; left: 24px; z-index: 100; color: #91adb9; font-size: 11px; pointer-events: none; }
.workspace-menu { position: fixed; inset: 0; margin: auto; padding: 0; width: min(1480px, calc(100vw - 64px)); height: calc(100dvh - 64px); max-width: none; max-height: none; border: 1px solid #58738088; border-radius: 8px; color: #dce9ed; background: #101b22; box-shadow: 0 30px 100px #0009; overflow: hidden; }
.workspace-menu[open] { display: flex; flex-direction: column; }
.workspace-menu::backdrop { background: #030a10b8; backdrop-filter: blur(8px); }
.workspace-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 76px; padding: 16px 24px; border-bottom: 1px solid #38546066; background: #14232c; }
.workspace-brand { display: flex; gap: 14px; align-items: center; }
.workspace-brand img { width: 32px; height: 32px; }
.workspace-brand strong { font: 700 17px var(--font-tech-display); letter-spacing: .08em; }
.workspace-brand > span { font-size: 12px; color: #8eabb8; }
.workspace-body { flex: 1; display: flex; min-height: 0; }
.workspace-nav { display: flex; flex-direction: column; gap: 8px; padding: 14px 8px; width: 100px; flex-shrink: 0; border-right: 1px solid #38546066; }
.workspace-nav button { display: flex; flex-direction: column; align-items: center; gap: 9px; min-height: 76px; padding: 14px 3px; color: #91a9b4; border: 1px solid transparent; border-radius: 4px; background: none; cursor: pointer; font-size: 11px; }
.workspace-nav button:hover, .workspace-nav button.active { color: #b8e5eb; background: #233740; border-color: #7096a677; }
.workspace-nav .workbench-link { margin-top: auto; }
.workspace-page { position: relative; flex: 1; min-width: 0; overflow: auto; overscroll-behavior: contain; }
.workspace-home { padding: 36px; max-width: 1250px; margin: 0 auto; }
.workspace-eyebrow { color: #829eaa; font: 11px var(--font-tech-mono); letter-spacing: .13em; }
h1 { font-size: clamp(24px, 3vw, 36px); margin: 14px 0 12px; font-weight: 500; letter-spacing: .02em; }
.workspace-description { color: #9eb7c2; font-size: 13px; max-width: 740px; line-height: 1.9; }
.workspace-summary { display: flex; align-items: center; gap: 10px; color: #b4bec2; font-size: 12px; margin: 22px 0 26px; }
.workspace-summary span { border-left: 1px solid #385460; padding-left: 12px; color: #91a9b4; }
i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #7a8d95; }
.connected i, i.online { background: #a8d7aa; }
.workspace-shortcuts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.workspace-shortcuts button { display: flex; align-items: flex-start; flex-direction: column; gap: 13px; padding: 23px; min-height: 180px; text-align: left; color: #b6d8e0; background: #1b2d37; border: 1px solid #46616e66; border-radius: 4px; cursor: pointer; }
.workspace-shortcuts button:hover { background: #253d49; border-color: #b1dfe5; }
.workspace-shortcuts strong { font-size: 17px; font-weight: 500; }
.workspace-shortcuts span { color: #8faab8; font-size: 11px; line-height: 1.6; }
.workspace-shortcuts svg:last-child { align-self: flex-end; margin-top: auto; }
.workspace-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; }
.workspace-tools section { border: 1px solid #46616e66; padding: 24px; border-radius: 4px; }
.workspace-tools h2 { font-size: 18px; margin: 16px 0 10px; font-weight: 500; }
.workspace-tools p:not(.workspace-eyebrow), dd { color: #91a9b4; font-size: 12px; line-height: 1.8; }
.workspace-tool-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
dl { margin-top: 18px; } dl > div { margin-bottom: 16px; } dt { color: #b8d9e3; font: 12px var(--font-tech-mono); } dd { margin: 3px 0 0; }
.workspace-footer { display: flex; justify-content: space-between; gap: 16px; padding: 10px 18px; border-top: 1px solid #38546066; font: 10px var(--font-tech-mono); color: #829eaa; }
.workspace-footer span:first-child { display: flex; align-items: center; gap: 8px; }
.workspace-page :deep(.settings-root) { height: 100%; background: transparent; }
.workspace-page :deep(.custom-data-display) { min-height: 100%; background: transparent; }
button:focus-visible { outline: 2px solid #b1dfe5; outline-offset: 3px; }
@media (max-width: 1100px) { .workspace-shortcuts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .workspace-home { padding: 25px; } }
@media (max-width: 700px) { .workspace-menu { width: 100vw; height: 100dvh; border: 0; border-radius: 0; } .workspace-header { padding: 12px; min-height: 60px; } .workspace-brand > span, .workspace-brand img, .return-button > span { display: none; } .workspace-brand strong { font-size: 14px; } .workspace-nav { width: 70px; padding: 10px 5px; } .workspace-nav button { font-size: 10px; min-height: 68px; } .workspace-home { padding: 20px 16px; } .workspace-shortcuts { gap: 10px; } .workspace-shortcuts button { padding: 16px; min-height: 155px; } .workspace-tools { grid-template-columns: 1fr; } .workspace-footer span:last-child { display: none; } .workspace-actions { right: 16px; top: 16px; } }
</style>
