<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import type { Ref } from 'vue';
import { useCanvasStore } from './stores/canvas';
import { useToolsStore } from './stores/tools';
import { useDrawing } from './composables/useDrawing';
import { useI18n } from './composables/useI18n';
import StrokeRenderer from './StrokeRenderer.vue';
import SelectionOverlay from './SelectionOverlay.vue';
import { DEFAULT_FONT_SIZE } from './types';

const canvasStore = useCanvasStore();
const toolsStore = useToolsStore();
const { t } = useI18n();
const wrapperRef = ref<HTMLElement | null>(null);

const { isDrawing, previewStroke, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd, updateModifiers, clearModifiers, isResizing, resizeCursor, startResize, commitTextEdit, cancelTextEdit, startEditText, saveCurrentTextEdit, setTextContentGetter } = useDrawing(
  wrapperRef as Ref<HTMLElement | null>,
);

// Provide a getter so the composable can read text content from the DOM
setTextContentGetter(() => {
  const id = canvasStore.editingTextId;
  if (!id) return null;
  const el = textEditRefs.value.get(id);
  return el ? el.innerText : null;
});

// When switching away from text tool, auto-save the current text edit
watch(() => toolsStore.activeTool, (newTool) => {
  if (newTool !== 'text') {
    saveCurrentTextEdit();
  }
});

const cursorStyle = computed(() => {
  if (isResizing.value) return resizeCursor.value;
  if (toolsStore.activeTool === 'pan') return 'grab';
  if (toolsStore.activeTool === 'zoom') return 'zoom-in';
  if (toolsStore.activeTool === 'text') {
    if (canvasStore.hoveredTextId) return 'pointer';
    return 'text';
  }
  return toolsStore.activeTool === 'select' ? 'default' : 'crosshair';
});

const isZoomActive = computed(() => toolsStore.activeTool === 'zoom');

// Text editing refs
const textEditRefs = ref<Map<string, HTMLDivElement | null>>(new Map());

// Computed bounds for hovered text stroke
const hoveredTextBounds = computed(() => {
  const id = canvasStore.hoveredTextId;
  if (!id) return null;
  const s = canvasStore.strokes.find((st) => st.id === id);
  if (!s) return null;
  return canvasStore.getStrokeDisplayBounds(s);
});

// Check if single text stroke is selected
const singleSelectedText = computed(() => {
  const sel = canvasStore.selectedStrokes;
  return sel.length === 1 && sel[0]!.type === 'text' ? sel[0]! : null;
});

// Text editing keyboard handling
function handleTextKeydown(e: KeyboardEvent) {
  if (!canvasStore.editingTextId) return;

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    const el = textEditRefs.value.get(canvasStore.editingTextId);
    const text = el ? el.innerText : '';
    commitTextEdit(canvasStore.editingTextId, text);
    // Give time for the DOM to update before trying to focus
    nextTick(() => {
      // Auto-select to select tool is handled in commitTextEdit
    });
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    cancelTextEdit(canvasStore.editingTextId);
  }
}

// Watch for editing state changes to focus the editor
watch(() => canvasStore.editingTextId, (newId) => {
  if (newId) {
    nextTick(() => {
      const el = textEditRefs.value.get(newId);
      if (el) {
        el.focus();
        // Place cursor at end
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }
});

function handleTextDblClick(strokeId: string) {
  // Only respond to double-click when text tool is NOT active
  // (when text tool IS active, single click creates new text)
  if (toolsStore.activeTool === 'text' || toolsStore.activeTool === 'select') {
    startEditText(strokeId);
  }
}

function handleMouseLeave() {
  canvasStore.hoveredTextId = null;
}

function zoomIn() {
  const el = wrapperRef.value?.parentElement;
  if (!el) return;
  canvasStore.zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.1);
}

function zoomOut() {
  const el = wrapperRef.value?.parentElement;
  if (!el) return;
  canvasStore.zoomAt(el.clientWidth / 2, el.clientHeight / 2, 0.9);
}

function handleKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;

  // Don't handle global shortcuts while editing text
  if (canvasStore.editingTextId) return;

  if (isDrawing.value || isResizing.value) {
    updateModifiers(e);
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    canvasStore.deleteSelectedStrokes();
  } else if (e.key === 'Escape') {
    canvasStore.clearSelection();
  } else if (ctrl && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    canvasStore.undo();
  } else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault();
    canvasStore.redo();
  } else if (ctrl && e.key === 'x') {
    e.preventDefault();
    canvasStore.cutSelectedStrokes();
  } else if (ctrl && e.key === 'c') {
    e.preventDefault();
    canvasStore.copySelectedStrokes();
  } else if (ctrl && e.key === 'v') {
    e.preventDefault();
    canvasStore.pasteStrokes();
  }
}

function handleKeyup(e: KeyboardEvent) {
  if (isDrawing.value || isResizing.value) {
    updateModifiers(e);
  }
}

function handleBlur() {
  clearModifiers();
}

// 双指缩放状态
const pinchStartDist = ref(0);
const pinchStartZoom = ref(1);
const pinchCenterX = ref(0);
const pinchCenterY = ref(0);

function getPinchDist(touches: TouchList): number {
  const dx = touches[0]!.clientX - touches[1]!.clientX;
  const dy = touches[0]!.clientY - touches[1]!.clientY;
  return Math.hypot(dx, dy);
}

function handleTouchStartForPinch(event: TouchEvent) {
  if (toolsStore.activeTool !== 'zoom') return;
  if (event.touches.length === 2) {
    pinchStartDist.value = getPinchDist(event.touches);
    pinchStartZoom.value = canvasStore.zoomLevel;
    pinchCenterX.value = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2;
    pinchCenterY.value = (event.touches[0]!.clientY + event.touches[1]!.clientY) / 2;
  }
}

function handleTouchMoveForPinch(event: TouchEvent) {
  if (toolsStore.activeTool !== 'zoom') return;
  if (event.touches.length === 2 && pinchStartDist.value > 0) {
    const dist = getPinchDist(event.touches);
    const scale = dist / pinchStartDist.value;
    const newZoom = pinchStartZoom.value * scale;
    const wrapper = wrapperRef.value;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      canvasStore.continuousZoomAt(
        pinchCenterX.value - rect.left,
        pinchCenterY.value - rect.top,
        newZoom,
      );
    }
  }
}

function handleTouchEndForPinch(event: TouchEvent) {
  if (toolsStore.activeTool !== 'zoom') return;
  if (event.touches.length < 2) {
    pinchStartDist.value = 0;
  }
}

let centerObserver: ResizeObserver | null = null;

function centerCanvas() {
  const el = wrapperRef.value?.parentElement;
  if (!el) return;
  const cw = canvasStore.canvasWidth * canvasStore.zoomLevel;
  const ch = canvasStore.canvasHeight * canvasStore.zoomLevel;
  const cw2 = el.clientWidth;
  const ch2 = el.clientHeight;
  if (cw2 > 0 && ch2 > 0) {
    canvasStore.setPan((cw2 - cw) / 2, (ch2 - ch) / 2);
  }
}

// Text formatting functions
function changeFontSize(delta: number) {
  const st = singleSelectedText.value;
  if (!st) return;
  const currentSize = st.fontSize ?? DEFAULT_FONT_SIZE;
  const newSize = Math.max(8, Math.min(200, currentSize + delta));
  canvasStore.pushUndo();
  canvasStore.updateStroke(st.id, { fontSize: newSize });
  canvasStore.dataVersion++;
}

function setTextAlign(align: 'left' | 'center' | 'right') {
  const st = singleSelectedText.value;
  if (!st) return;
  canvasStore.pushUndo();
  canvasStore.updateStroke(st.id, { textAlign: align });
  canvasStore.dataVersion++;
}

function setTextEditRef(strokeId: string) {
  return (el: any) => {
    if (el) {
      textEditRefs.value.set(strokeId, el as HTMLDivElement);
      nextTick(() => syncTextSizeFromDOM(strokeId, el as HTMLDivElement));
    } else {
      textEditRefs.value.delete(strokeId);
    }
  };
}

function syncTextSizeFromDOM(strokeId: string, el: HTMLDivElement) {
  const stroke = canvasStore.strokes.find((s) => s.id === strokeId);
  if (!stroke) return;
  const w = Math.max(el.scrollWidth / canvasStore.zoomLevel, stroke.fontSize ?? DEFAULT_FONT_SIZE);
  const h = Math.max(el.scrollHeight / canvasStore.zoomLevel, stroke.fontSize ?? DEFAULT_FONT_SIZE);
  if (stroke.textAutoWidth) {
    if (Math.abs(stroke.width - w) < 0.5 && Math.abs(stroke.height - h) < 0.5) return;
    canvasStore.updateStroke(strokeId, { width: w, height: h });
  } else {
    const clampedW = Math.max(stroke.width, w);
    if (Math.abs(stroke.width - clampedW) < 0.5 && Math.abs(stroke.height - h) < 0.5) return;
    canvasStore.updateStroke(strokeId, { width: clampedW, height: h });
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keydown', handleTextKeydown);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('blur', handleBlur);

  centerCanvas();
  centerObserver = new ResizeObserver(() => centerCanvas());
  const el = wrapperRef.value?.parentElement;
  if (el) centerObserver.observe(el);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keydown', handleTextKeydown);
  window.removeEventListener('keyup', handleKeyup);
  window.removeEventListener('blur', handleBlur);
  centerObserver?.disconnect();
});
</script>

<template>
  <div
    class="whiteboard"
    @contextmenu.prevent
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @touchstart.prevent="(e: TouchEvent) => { onTouchStart(e); handleTouchStartForPinch(e); }"
    @touchmove.prevent="(e: TouchEvent) => { onTouchMove(e); handleTouchMoveForPinch(e); }"
    @touchend="(e: TouchEvent) => { onTouchEnd(e); handleTouchEndForPinch(e); }"
  >
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
        class="canvas"
        :viewBox="canvasStore.viewBox"
        width="100%"
        height="100%"
        :style="{ cursor: cursorStyle }"
        @mouseleave="handleMouseLeave"
      >
        <!-- 画布背景区域 -->
        <defs>
          <pattern
            id="grid-light"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="16"
              height="16"
              fill="#ffffff"
            />
            <rect
              width="8"
              height="8"
              fill="#f0f0f0"
            />
            <rect
              x="8"
              y="8"
              width="8"
              height="8"
              fill="#f0f0f0"
            />
          </pattern>
          <pattern
            id="grid-dark"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="16"
              height="16"
              fill="#1e1e30"
            />
            <rect
              width="8"
              height="8"
              fill="#2a2a3e"
            />
            <rect
              x="8"
              y="8"
              width="8"
              height="8"
              fill="#2a2a3e"
            />
          </pattern>
        </defs>
        <rect
          v-if="canvasStore.canvasBackgroundColor === 'transparent'"
          x="0"
          y="0"
          :width="canvasStore.canvasWidth"
          :height="canvasStore.canvasHeight"
          :fill="canvasStore.theme === 'dark' ? 'url(#grid-dark)' : 'url(#grid-light)'"
        />
        <rect
          v-else
          x="0"
          y="0"
          :width="canvasStore.canvasWidth"
          :height="canvasStore.canvasHeight"
          :fill="canvasStore.canvasBackgroundColor"
        />

        <!-- 画布边框（浅色实线） -->
        <rect
          x="0"
          y="0"
          :width="canvasStore.canvasWidth"
          :height="canvasStore.canvasHeight"
          fill="none"
          :stroke="canvasStore.theme === 'dark' ? '#4a4a5a' : '#c0c0c0'"
          stroke-width="2"
        />

        <g class="strokes-layer">
          <template
            v-for="stroke in canvasStore.strokes"
            :key="stroke.id"
          >
            <!-- Text strokes rendered as foreignObject -->
            <foreignObject
              v-if="stroke.type === 'text'"
              :x="stroke.x"
              :y="stroke.y"
              :width="stroke.textAutoWidth ? 1 : (stroke.width || 1)"
              :height="1"
              :style="{ overflow: 'visible', pointerEvents: 'none' }"
            >
              <div
                :ref="setTextEditRef(stroke.id)"
                xmlns="http://www.w3.org/1999/xhtml"
                :contenteditable="canvasStore.editingTextId === stroke.id"
                :style="{
                  fontSize: (stroke.fontSize ?? 16) + 'px',
                  color: stroke.textColor ?? stroke.strokeColor,
                  textAlign: stroke.textAlign ?? 'left',
                  whiteSpace: stroke.textAutoWidth ? 'nowrap' : 'pre-wrap',
                  wordBreak: stroke.textAutoWidth ? 'normal' : 'break-word',
                  padding: '2px 4px',
                  minHeight: (stroke.fontSize ?? 16) + 'px',
                  outline: canvasStore.editingTextId === stroke.id ? '2px solid #6366f1' : 'none',
                  cursor: canvasStore.editingTextId === stroke.id ? 'text' : 'default',
                  userSelect: canvasStore.editingTextId === stroke.id ? 'text' : 'none',
                  pointerEvents: canvasStore.editingTextId === stroke.id ? 'auto' : 'none',
                  background: canvasStore.editingTextId === stroke.id ? 'rgba(255,255,255,0.9)' : 'transparent',
                  borderRadius: '2px',
                  display: 'inline-block',
                  maxWidth: stroke.textAutoWidth ? 'none' : '100%',
                }"
                @dblclick.stop="handleTextDblClick(stroke.id)"
              >{{ stroke.text || '' }}</div>
            </foreignObject>
            <StrokeRenderer
              v-else
              :stroke="stroke"
              :is-selected="canvasStore.isSelected(stroke.id)"
            />
          </template>
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

        <!-- Text tool hover outline -->
        <rect
          v-if="hoveredTextBounds"
          :x="hoveredTextBounds.x - 4"
          :y="hoveredTextBounds.y - 4"
          :width="hoveredTextBounds.width + 8"
          :height="hoveredTextBounds.height + 8"
          fill="none"
          stroke="#6366f1"
          stroke-width="1"
          stroke-dasharray="4 3"
          pointer-events="none"
        />
      </svg>
    </div>

    <!-- 画布右上角工具栏 -->
    <div
      class="canvas-toolbar"
      @mousedown.stop
      @mouseup.stop
      @click.stop
      @touchstart.stop
      @touchmove.stop
      @touchend.stop
    >
      <button
        class="canvas-tb-btn"
        :disabled="!canvasStore.canUndo"
        :title="t('toolbar.undo')"
        @click="canvasStore.undo()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 10H11a5 5 0 0 0 0 10h4" />
          <polyline points="17 6 21 10 17 14" />
        </svg>
      </button>
      <button
        v-if="canvasStore.selectedStrokeIds.size > 0"
        class="canvas-tb-btn"
        :title="t('toolbar.bringToFront')"
        @click="canvasStore.moveSelectedUp()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        v-if="canvasStore.selectedStrokeIds.size > 0"
        class="canvas-tb-btn"
        :title="t('toolbar.sendToBack')"
        @click="canvasStore.moveSelectedDown()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
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

    <!-- 缩放控制器：选择放大镜工具时常驻显示，否则临时显示 -->
    <div
      v-if="isZoomActive || canvasStore.showZoomIndicator"
      class="zoom-control"
      @touchstart.stop.prevent
    >
      <button
        v-if="isZoomActive"
        class="zoom-btn"
        :title="t('zoom.zoomOut')"
        @mousedown.stop.prevent="zoomOut"
        @touchstart.stop.prevent="zoomOut"
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
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
      <span class="zoom-percent">{{ canvasStore.getZoomPercent() }}%</span>
      <button
        v-if="isZoomActive"
        class="zoom-btn"
        :title="t('zoom.zoomIn')"
        @mousedown.stop.prevent="zoomIn"
        @touchstart.stop.prevent="zoomIn"
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
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          />
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
    </div>

    <!-- 文本格式化控制器：单选文本框时显示 -->
    <div
      v-if="singleSelectedText"
      class="text-format-control"
      @touchstart.stop.prevent
    >
      <button
        class="font-size-btn"
        @mousedown.stop.prevent="changeFontSize(-1)"
        @touchstart.stop.prevent="changeFontSize(-1)"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
      <span class="font-size-value">{{ singleSelectedText.fontSize ?? DEFAULT_FONT_SIZE }}</span>
      <button
        class="font-size-btn"
        @mousedown.stop.prevent="changeFontSize(1)"
        @touchstart.stop.prevent="changeFontSize(1)"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          />
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
      <div class="text-align-separator" />
      <button
        :class="['text-align-btn', { active: singleSelectedText.textAlign === 'left' || !singleSelectedText.textAlign }]"
        :title="t('textAlign.left')"
        @mousedown.stop.prevent="setTextAlign('left')"
        @touchstart.stop.prevent="setTextAlign('left')"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line
            x1="3"
            y1="6"
            x2="21"
            y2="6"
          />
          <line
            x1="3"
            y1="10"
            x2="17"
            y2="10"
          />
          <line
            x1="3"
            y1="14"
            x2="21"
            y2="14"
          />
          <line
            x1="3"
            y1="18"
            x2="15"
            y2="18"
          />
        </svg>
      </button>
      <button
        :class="['text-align-btn', { active: singleSelectedText.textAlign === 'center' }]"
        :title="t('textAlign.center')"
        @mousedown.stop.prevent="setTextAlign('center')"
        @touchstart.stop.prevent="setTextAlign('center')"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line
            x1="3"
            y1="6"
            x2="21"
            y2="6"
          />
          <line
            x1="5"
            y1="10"
            x2="19"
            y2="10"
          />
          <line
            x1="3"
            y1="14"
            x2="21"
            y2="14"
          />
          <line
            x1="7"
            y1="18"
            x2="17"
            y2="18"
          />
        </svg>
      </button>
      <button
        :class="['text-align-btn', { active: singleSelectedText.textAlign === 'right' }]"
        :title="t('textAlign.right')"
        @mousedown.stop.prevent="setTextAlign('right')"
        @touchstart.stop.prevent="setTextAlign('right')"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line
            x1="3"
            y1="6"
            x2="21"
            y2="6"
          />
          <line
            x1="7"
            y1="10"
            x2="21"
            y2="10"
          />
          <line
            x1="3"
            y1="14"
            x2="21"
            y2="14"
          />
          <line
            x1="9"
            y1="18"
            x2="21"
            y2="18"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.whiteboard {
  flex: 1;
  overflow: hidden;
  background: var(--wb-canvas-surround);
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

.zoom-control {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  z-index: 100;
}

.zoom-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.zoom-percent {
  min-width: 40px;
  text-align: center;
  user-select: none;
}

/* Text formatting controls */
.text-format-control {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  z-index: 100;
}

.font-size-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.font-size-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.font-size-value {
  min-width: 28px;
  text-align: center;
  user-select: none;
  font-size: 12px;
}

.text-align-separator {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.3);
  margin: 0 4px;
}

.text-align-btn {
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.text-align-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.text-align-btn.active {
  background: rgba(99, 102, 241, 0.6);
}
</style>
