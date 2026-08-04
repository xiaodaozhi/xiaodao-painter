<script setup lang="ts">
import { useToolsStore } from './stores/tools'
import { useCanvasStore } from './stores/canvas'
import type { ToolType } from './types'
import { useI18n } from './composables/useI18n'

const toolsStore = useToolsStore()
const canvasStore = useCanvasStore()
const { t } = useI18n()

const toolTypes: ToolType[] = ['select', 'pencil', 'line', 'circle', 'rect', 'triangle', 'star']

function onFgClick() {
  canvasStore.setColorSlot('foreground')
  canvasStore.toggleColorPalette()
}

function onBgClick() {
  canvasStore.setColorSlot('background')
  canvasStore.toggleColorPalette()
}
</script>

<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        v-for="type in toolTypes"
        :key="type"
        :class="['tool-btn', { active: toolsStore.activeTool === type }]"
        :title="t(`tool.${type}`)"
        @click="toolsStore.setTool(type)"
      >
        <!-- Select -->
        <svg v-if="type === 'select'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3l14 9-7 2.5L9.5 21 5 3z"/>
          <line x1="12" y1="14.5" x2="15" y2="17" stroke-width="1.2"/>
        </svg>
        <!-- Pencil -->
        <svg v-else-if="type === 'pencil'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
        <!-- Line -->
        <svg v-else-if="type === 'line'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <line x1="5" y1="19" x2="19" y2="5"/>
        </svg>
        <!-- Circle -->
        <svg v-else-if="type === 'circle'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="9"/>
        </svg>
        <!-- Rect -->
        <svg v-else-if="type === 'rect'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
        <!-- Triangle -->
        <svg v-else-if="type === 'triangle'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <polygon points="12,3 22,21 2,21"/>
        </svg>
        <!-- Star -->
        <svg v-else-if="type === 'star'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      </button>
    </div>

    <div class="spacer" />

    <div class="color-section">
      <div
        class="color-indicator"
        :class="{ active: canvasStore.showColorPalette && canvasStore.activeColorSlot === 'foreground' }"
        :title="t('color.foreground')"
        @click="onFgClick"
      >
        <div class="color-swatch fg" :style="{ background: canvasStore.foregroundColor }" />
      </div>
      <div
        class="color-indicator"
        :class="{ active: canvasStore.showColorPalette && canvasStore.activeColorSlot === 'background' }"
        :title="t('color.background')"
        @click="onBgClick"
      >
        <div class="color-swatch bg" :style="{ background: canvasStore.backgroundColor }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  width: 52px;
  background: var(--wb-surface-toolbar);
  border-right: 1px solid var(--wb-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  gap: 2px;
  flex-shrink: 0;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--wb-radius-sm);
  background: transparent;
  color: var(--wb-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--wb-transition);
  padding: 0;
}

.tool-btn:hover {
  background: var(--wb-surface-hover);
  color: var(--wb-text);
}

.tool-btn.active {
  background: var(--wb-accent);
  color: #ffffff;
}

.tool-icon {
  width: 22px;
  height: 22px;
  pointer-events: none;
}

.spacer {
  flex: 1;
}

.color-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
}

.color-indicator {
  width: 32px;
  height: 32px;
  border-radius: var(--wb-radius-sm);
  cursor: pointer;
  padding: 2px;
  border: 2px solid transparent;
  transition: all var(--wb-transition);
}

.color-indicator:hover {
  background: var(--wb-surface-hover);
  border-color: var(--wb-border);
}

.color-indicator.active {
  border-color: var(--wb-accent);
  background: var(--wb-accent-light);
}

.color-swatch {
  width: 100%;
  height: 100%;
  border-radius: 5px;
  border: 1px solid var(--wb-border);
}

.bg {
  border-radius: 5px;
  border-style: dashed;
}
</style>