<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { Ref } from 'vue'
import { useCanvasStore } from './stores/canvas'
import { useToolsStore } from './stores/tools'
import { useDrawing } from './composables/useDrawing'
import { useI18n } from './composables/useI18n'
import StrokeRenderer from './StrokeRenderer.vue'
import SelectionOverlay from './SelectionOverlay.vue'

const canvasStore = useCanvasStore()
const toolsStore = useToolsStore()
const { t } = useI18n()
const svgRef = ref<SVGSVGElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)

const { isDrawing, previewStroke, onMouseDown, onMouseMove, onMouseUp, updateModifiers, clearModifiers, isResizing, resizeCursor, startResize } = useDrawing(
  svgRef as Ref<SVGSVGElement | null>,
  wrapperRef as Ref<HTMLElement | null>,
)

const cursorStyle = computed(() => {
  if (isResizing.value) return resizeCursor.value
  if (toolsStore.activeTool === 'pan') return 'grab'
  if (toolsStore.activeTool === 'zoom') return 'zoom-in'
  return toolsStore.activeTool === 'select' ? 'default' : 'crosshair'
})

function handleKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey

  if (isDrawing.value || isResizing.value) {
    updateModifiers(e)
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    canvasStore.deleteSelectedStrokes()
  } else if (e.key === 'Escape') {
    canvasStore.clearSelection()
  } else if (ctrl && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    canvasStore.undo()
  } else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault()
    canvasStore.redo()
  } else if (ctrl && e.key === 'x') {
    e.preventDefault()
    canvasStore.cutSelectedStrokes()
  } else if (ctrl && e.key === 'c') {
    e.preventDefault()
    canvasStore.copySelectedStrokes()
  } else if (ctrl && e.key === 'v') {
    e.preventDefault()
    canvasStore.pasteStrokes()
  }
}

function handleKeyup(e: KeyboardEvent) {
  if (isDrawing.value || isResizing.value) {
    updateModifiers(e)
  }
}

function handleBlur() {
  clearModifiers()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  window.addEventListener('blur', handleBlur)

  // 初始居中
  const el = wrapperRef.value?.parentElement
  if (el) {
    const cw = canvasStore.canvasWidth * canvasStore.zoomLevel
    const ch = canvasStore.canvasHeight * canvasStore.zoomLevel
    canvasStore.setPan((el.clientWidth - cw) / 2, (el.clientHeight - ch) / 2)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  window.removeEventListener('blur', handleBlur)
})
</script>

<template>
  <div class="whiteboard" @contextmenu.prevent>
    <div
      ref="wrapperRef"
      class="canvas-wrapper"
      :style="{
        width: canvasStore.canvasWidth + 'px',
        height: canvasStore.canvasHeight + 'px',
        transform: canvasStore.canvasTransform,
        transformOrigin: '0 0',
      }"
    >
      <svg
        ref="svgRef"
        class="canvas"
        :viewBox="canvasStore.viewBox"
        width="100%"
        height="100%"
        :style="{ cursor: cursorStyle }"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      >
        <!-- 画布背景区域 -->
        <defs>
          <pattern
            id="transparent-grid"
            width="16" height="16"
            patternUnits="userSpaceOnUse"
          >
            <rect width="16" height="16" fill="#ffffff" />
            <rect width="8" height="8" fill="#f0f0f0" />
            <rect x="8" y="8" width="8" height="8" fill="#f0f0f0" />
          </pattern>
        </defs>
        <rect
          x="0" y="0"
          :width="canvasStore.canvasWidth"
          :height="canvasStore.canvasHeight"
          :fill="canvasStore.canvasBackgroundColor === 'transparent' ? 'url(#transparent-grid)' : canvasStore.canvasBackgroundColor"
        />

        <!-- 画布边框（浅色实线） -->
        <rect
          x="0" y="0"
          :width="canvasStore.canvasWidth"
          :height="canvasStore.canvasHeight"
          fill="none"
          stroke="#c0c0c0"
          stroke-width="2"
        />

        <g class="strokes-layer">
          <StrokeRenderer
            v-for="stroke in canvasStore.strokes"
            :key="stroke.id"
            :stroke="stroke"
            :is-selected="canvasStore.isSelected(stroke.id)"
          />
        </g>

        <StrokeRenderer
          v-if="previewStroke"
          :stroke="previewStroke"
          :is-selected="false"
        />

        <SelectionOverlay
          v-for="s in canvasStore.selectedStrokes"
          :key="'sel-' + s.id"
          :stroke="s"
          :start-resize="startResize"
        />

        <rect
          v-if="canvasStore.isSelecting && canvasStore.selectionBox"
          :x="canvasStore.selectionBox.x"
          :y="canvasStore.selectionBox.y"
          :width="canvasStore.selectionBox.width"
          :height="canvasStore.selectionBox.height"
          fill="rgba(99, 102, 241, 0.08)"
          stroke="#6366f1"
          stroke-width="1"
          stroke-dasharray="6 4"
        />
      </svg>
    </div>

    <!-- 画布右上角工具栏 -->
    <div class="canvas-toolbar">
      <button
        class="canvas-tb-btn"
        :disabled="!canvasStore.canUndo"
        :title="t('toolbar.undo')"
        @click="canvasStore.undo()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10h10a5 5 0 0 1 0 10H9" />
          <polyline points="7 6 3 10 7 14" />
        </svg>
      </button>
      <button
        class="canvas-tb-btn"
        :disabled="!canvasStore.canRedo"
        :title="t('toolbar.redo')"
        @click="canvasStore.redo()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10H11a5 5 0 0 0 0 10h4" />
          <polyline points="17 6 21 10 17 14" />
        </svg>
      </button>
      <div class="tb-separator" />
      <button
        class="canvas-tb-btn"
        :disabled="canvasStore.selectedStrokeIds.size === 0"
        :title="t('toolbar.bringToFront')"
        @click="canvasStore.moveSelectedUp()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        class="canvas-tb-btn"
        :disabled="canvasStore.selectedStrokeIds.size === 0"
        :title="t('toolbar.sendToBack')"
        @click="canvasStore.moveSelectedDown()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div class="tb-separator" v-if="canvasStore.selectedStrokeIds.size > 0" />
      <button
        v-if="canvasStore.selectedStrokeIds.size > 0"
        class="canvas-tb-btn canvas-tb-btn--danger"
        :title="t('toolbar.delete')"
        @click="canvasStore.deleteSelectedStrokes()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>

    <!-- 缩放指示器 -->
    <Transition name="zoom-fade">
      <div v-if="canvasStore.showZoomIndicator" class="zoom-indicator">
        {{ t('zoom.label').replace('{percent}', String(canvasStore.getZoomPercent())) }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.whiteboard {
  flex: 1;
  overflow: hidden;
  background: #e0e0e0;
  position: relative;
}

.canvas-wrapper {
  position: absolute;
  /* pan 后默认居中 */
  margin: auto;
  will-change: transform;
}

.canvas {
  display: block;
}

.canvas-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
}

.canvas-tb-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--wb-border);
  border-radius: 4px;
  background: var(--wb-surface);
  color: var(--wb-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all var(--wb-transition);
  opacity: 0.85;
}

.canvas-tb-btn:hover:not(:disabled) {
  background: var(--wb-surface-hover);
  opacity: 1;
}

.canvas-tb-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.canvas-tb-btn--danger:hover:not(:disabled) {
  color: #ef4444;
  border-color: #ef4444;
}

.tb-separator {
  height: 1px;
  background: var(--wb-border);
  margin: 2px 4px;
}

.zoom-indicator {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  pointer-events: none;
  z-index: 100;
}

.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: opacity 0.25s ease;
}

.zoom-fade-enter-from,
.zoom-fade-leave-to {
  opacity: 0;
}
</style>