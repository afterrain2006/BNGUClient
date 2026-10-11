<template>
  <div class="settings-root">
    <!-- 固定标题区域 -->
    <div class="settings-header">
      <h1 class="settings-title">系统设置</h1>
      <p class="settings-subtitle">客户端配置与系统选项</p>
    </div>

    <!-- 可滚动内容区域 -->
    <div class="settings-container">
      <!-- 窗口设置 -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-icon window">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
            </svg>
          </div>
          <div>
            <h3 class="section-title">窗口设置</h3>
            <p class="section-desc">显示与快捷键</p>
          </div>
        </div>
        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-label">F11 全屏切换</span>
            <span class="toggle-desc">按 F11 键快速切换全屏模式</span>
          </div>
          <label class="toggle-switch">
            <input v-model="isF11Enabled" type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- 调试选项 -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-icon window">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 8v4l3 3"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </div>
          <div>
            <h3 class="section-title">调试选项</h3>
            <p class="section-desc">开发/测试场景使用，普通用户请保持关闭</p>
          </div>
        </div>
        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-label">调试模式</span>
            <span class="toggle-desc">显示 MQTT 指令发送等内部调试工具</span>
          </div>
          <label class="toggle-switch">
            <input v-model="isDebugMode" type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- 版本信息 -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-icon info">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <div>
            <h3 class="section-title">版本信息</h3>
            <p class="section-desc">客户端运行环境</p>
          </div>
        </div>
        <Versions />
      </div>

      <!-- 危险操作区 -->
      <div class="settings-section danger-zone">
        <div class="section-header">
          <div class="section-icon danger">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              ></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3 class="section-title danger">危险操作</h3>
            <p class="section-desc">请谨慎操作</p>
          </div>
        </div>
        <button class="exit-btn" @click="showExitConfirmation">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          退出客户端
        </button>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmationDialog
      v-if="isExitDialogVisible"
      title="退出确认"
      message="确定退出自定义客户端吗？"
      @confirm="handleExitConfirm"
      @cancel="handleExitCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Versions from '@/components/Versions.vue'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { useDashboardStore } from '@/store'

const dashboardStore = useDashboardStore()
const { isDebugMode } = storeToRefs(dashboardStore)

const isExitDialogVisible = ref(false)
const F11_STORAGE_KEY = 'bnguclient.f11Enabled'
const isF11Enabled = ref(localStorage.getItem(F11_STORAGE_KEY) !== '0')

defineExpose({ dismissOverlay() {
  if (!isExitDialogVisible.value) return false
  isExitDialogVisible.value = false
  return true
} })

// 监听 F11 状态变化，持久化 + 同步到主进程
watch(
  isF11Enabled,
  (val) => {
    console.log('[Settings] F11 快捷键状态变更:', val)
    try {
      localStorage.setItem(F11_STORAGE_KEY, val ? '1' : '0')
    } catch {
      /* ignore quota errors */
    }
    if (window.api?.setF11Shortcut) {
      window.api.setF11Shortcut(val)
    }
  },
  { immediate: true }
)

const showExitConfirmation = (): void => {
  isExitDialogVisible.value = true
}

const handleExitConfirm = (): void => {
  window.api.close()
  isExitDialogVisible.value = false
}

const handleExitCancel = (): void => {
  isExitDialogVisible.value = false
}
</script>

<style scoped>
.settings-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
  color: #fff;
}

.settings-header {
  flex-shrink: 0;
  padding: 40px 60px 24px 60px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.settings-container {
  flex: 1;
  overflow-y: auto;
  padding: 32px 60px 48px 60px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-container::-webkit-scrollbar {
  display: none;
}

.settings-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #fff;
  letter-spacing: -0.5px;
}

.settings-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

/* Section 通用样式 */
.settings-section {
  padding: 24px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.section-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-icon.window {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2));
  color: #fbbf24;
}

.section-icon.info {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
  color: #818cf8;
}

.section-icon.danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2));
  color: #f87171;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
}

.section-title.danger {
  color: #f87171;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin: 2px 0 0 0;
}

/* Toggle 开关 */
.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: all 0.2s;
}

.toggle-item:hover {
  background: rgba(0, 0, 0, 0.3);
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.toggle-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 13px;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(22px);
}

/* 危险区域 */
.danger-zone {
  border-color: rgba(239, 68, 68, 0.15);
  background: rgba(239, 68, 68, 0.03);
}

.exit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.exit-btn:hover {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
}

.exit-btn:active {
  transform: translateY(0);
}

/* 响应式 */
@media (max-width: 900px) {
  .settings-header,
  .settings-container {
    padding-left: 32px;
    padding-right: 32px;
  }

}
@media (max-width: 500px) {
  .settings-header, .settings-container { padding: 20px 16px; }
  .settings-section { padding: 16px; border-radius: 6px; }
  .section-header { gap: 10px; }
}
</style>
