<script setup lang="ts">
import { useCanvasStore } from './stores/canvas'
import { useI18n } from './composables/useI18n'

const canvasStore = useCanvasStore()
const { t } = useI18n()

const presetColors = [
  '#000000', '#ffffff', '#6b7280', '#d1d5db',
  '#dc2626', '#ef4444', '#f97316', '#f59e0b',
  '#16a34a', '#22c55e', '#0891b2', '#06b6d4',
  '#2563eb', '#3b82f6', '#7c3aed', '#8b5cf6',
  '#db2777', '#ec4899', '#a16207', '#84cc16',
  '#0d9488', '#6366f1', '#d946ef', '#f43f5e',
]

function onCustomColorChange(event: Event) {
  const input = event.target as HTMLInputElement
  canvasStore.setColor(input.value)
}

function onSelectColor(color: string) {
  canvasStore.setColor(color)
  canvasStore.hideColorPalette()
}

function onTransparentClick() {
  canvasStore.setColor('transparent')
  canvasStore.hideColorPalette()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="canvasStore.showColorPalette" class="overlay" @click="canvasStore.hideColorPalette">
      <div class="color-palette" @click.stop>
        <div class="palette-header">
          <span class="palette-title">
            {{ canvasStore.activeColorSlot === 'foreground' ? t('palette.stroke') : t('palette.fill') }}
          </span>
          <div class="current-color">
            <div
              class="current-swatch"
              :class="{ fill: canvasStore.activeColorSlot === 'background' }"
              :style="{ background: canvasStore.activeColorSlot === 'foreground' ? canvasStore.foregroundColor : canvasStore.backgroundColor }"
            />
          </div>
        </div>

        <div class="preset-grid">
          <button
            v-for="color in presetColors"
            :key="color"
            class="color-swatch"
            :style="{ background: color }"
            :title="color"
            @click="onSelectColor(color)"
          />
        </div>

        <div v-if="canvasStore.activeColorSlot === 'background'" class="transparent-row">
          <button
            class="color-swatch transparent-swatch"
            title="透明（无填充）"
            @click="onTransparentClick"
          >
            <span class="transparent-icon">/</span>
          </button>
        </div>

        <div class="palette-footer">
          <div class="custom-color">
            <input
              type="color"
              :value="canvasStore.activeColorSlot === 'foreground' ? canvasStore.foregroundColor : (canvasStore.backgroundColor === 'transparent' ? '#ffffff' : canvasStore.backgroundColor)"
              class="color-picker"
              @change="onCustomColorChange"
            />
            <span class="custom-label">{{ t('palette.custom') }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
}

.color-palette {
  position: fixed;
  left: 60px;
  bottom: 16px;
  transform: none;
  background: var(--wb-surface);
  border: 1px solid var(--wb-border);
  border-radius: var(--wb-radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 300px;
  box-shadow: var(--wb-shadow-lg);
  z-index: 101;
}

.palette-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--wb-border);
}

.palette-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-text);
}

.current-color {
  display: flex;
  align-items: center;
}

.current-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--wb-border);
}

.current-swatch.fill {
  border-radius: 6px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.color-swatch {
  width: 30px;
  height: 30px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: all var(--wb-transition);
  outline: none;
}

.color-swatch:hover {
  transform: scale(1.15);
  border-color: var(--wb-text);
  box-shadow: var(--wb-shadow-md);
  z-index: 1;
}

.color-swatch:active {
  transform: scale(0.95);
}

.transparent-row {
  display: flex;
  justify-content: center;
}

.transparent-swatch {
  background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transparent-icon {
  font-size: 20px;
  font-weight: 700;
  color: #d00;
  line-height: 1;
  pointer-events: none;
}

.palette-footer {
  padding-top: 10px;
  border-top: 1px solid var(--wb-border);
}

.custom-color {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 36px;
  height: 36px;
  border: 2px solid var(--wb-border);
  border-radius: var(--wb-radius-sm);
  padding: 2px;
  cursor: pointer;
  background: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.custom-label {
  font-size: 13px;
  color: var(--wb-text-secondary);
  font-weight: 500;
}
</style>