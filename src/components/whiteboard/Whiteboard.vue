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

const { isDrawing, previewStroke, onMouseDown, onMouseMove, onMouseUp, updateModifiers, clearModifiers, isResizing, startResize } = useDrawing(
  svgRef as Ref<SVGSVGElement | null>
)

const cursorStyle = computed(() => {
  return toolsStore.activeTool === 'select' ? 'default' : 'crosshair'
})

function handleKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey

  // 如果是绘制或缩放中，先更新修饰键状态
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
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  window.removeEventListener('blur', handleBlur)
})
</script>

<template>
  <div class="whiteboard" @contextmenu.prevent>
    <svg
      ref="svgRef"
      class="canvas"
      :style="{ cursor: cursorStyle }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    >
      <rect class="canvas-bg" x="0" y="0" width="100%" height="100%" />

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
  </div>
</template>

<style scoped>
.whiteboard {
  flex: 1;
  overflow: hidden;
  background: var(--wb-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: relative;
}

.canvas {
  width: 100%;
  height: 100%;
  background: var(--wb-canvas-bg);
}

.canvas-bg {
  fill: var(--wb-canvas-bg);
  pointer-events: none;
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
</style>