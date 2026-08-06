<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useToolsStore } from './stores/tools';
import { useCanvasStore } from './stores/canvas';
import type { ToolType } from './types';
import { useI18n, useRootEl } from './composables/useI18n';

const toolsStore = useToolsStore();
const canvasStore = useCanvasStore();
const { t } = useI18n();
const rootEl = useRootEl();

// Adaptive scrolling for tool buttons
const toolsScrollRef = ref<HTMLElement | null>(null);
const canScrollUp = ref(false);
const canScrollDown = ref(false);
const SCROLL_STEP = 42; // tool-btn height (40px) + gap (2px)

function checkScroll() {
  const el = toolsScrollRef.value;
  if (!el) return;
  canScrollUp.value = el.scrollTop > 0;
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

function scrollUp() {
  const el = toolsScrollRef.value;
  if (!el) return;
  el.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' });
}

function scrollDown() {
  const el = toolsScrollRef.value;
  if (!el) return;
  el.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeObserver = new ResizeObserver(() => checkScroll());
  if (toolsScrollRef.value) {
    resizeObserver.observe(toolsScrollRef.value);
  }
  checkScroll();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

const toolTypes: ToolType[] = ['select', 'pan', 'pencil', 'line', 'circle', 'rect', 'triangle', 'star', 'text'];

const hasSelection = computed(() => canvasStore.selectedStrokeIds.size > 0);

// Canvas size popover
const showCanvasSizePopover = ref(false);
const canvasSizeInput = ref({ width: canvasStore.canvasWidth, height: canvasStore.canvasHeight });

const canvasBgInput = ref(canvasStore.canvasBackgroundColor);

function openCanvasSizePopover() {
  canvasSizeInput.value = { width: canvasStore.canvasWidth, height: canvasStore.canvasHeight };
  canvasBgInput.value = canvasStore.canvasBackgroundColor;
  showCanvasSizePopover.value = true;
}

const hiddenColorInput = ref<HTMLInputElement | null>(null);

function selectSolidColor() {
  hiddenColorInput.value?.click();
}

function onColorInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  canvasBgInput.value = target.value;
}

function selectTransparent() {
  canvasBgInput.value = 'transparent';
}

function confirmCanvasSize() {
  const w = Math.max(1, Math.round(canvasSizeInput.value.width));
  const h = Math.max(1, Math.round(canvasSizeInput.value.height));
  canvasStore.setCanvasSize(w, h);
  canvasStore.setCanvasBackgroundColor(canvasBgInput.value);
  showCanvasSizePopover.value = false;
}

function cancelCanvasSize() {
  showCanvasSizePopover.value = false;
}

// Compute popover position relative to the root component's left/bottom edges
const popoverStyle = computed(() => {
  if (!rootEl?.value) return {};
  const rect = rootEl.value.getBoundingClientRect();
  // Popover: right of toolbar (52px + 12px) from rootEl left, 80px from rootEl bottom
  return {
    left: rect.left + 52 + 12 + 'px',
    bottom: window.innerHeight - rect.bottom + 80 + 'px',
    position: 'fixed' as const,
  };
});

// Close popover on outside click
function onPopoverBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('canvas-size-backdrop')) {
    showCanvasSizePopover.value = false;
  }
}

// Close popover on Escape
function onPopoverKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showCanvasSizePopover.value = false;
  }
}

// 前景色（边框色）：优先显示选中统一色，否则显示默认前景色
const displayFg = computed(() => {
  if (hasSelection.value && canvasStore.selectedStrokeColor !== null) {
    return canvasStore.selectedStrokeColor;
  }
  return canvasStore.foregroundColor;
});

// 多选且边框颜色不一致（纯文本框时不显示混合态）
const fgMixed = computed(() =>
  !allSelectedAreText.value && hasSelection.value && canvasStore.selectedStrokeColor === null,
);

// 背景色（填充色）：优先显示选中统一色，否则显示默认背景色
const displayBg = computed(() => {
  if (hasSelection.value && canvasStore.selectedFillColor !== null) {
    return canvasStore.selectedFillColor;
  }
  return canvasStore.backgroundColor;
});

// 多选且填充颜色不一致（纯文本框时不显示混合态）
const bgMixed = computed(() =>
  !allSelectedAreText.value && hasSelection.value && canvasStore.selectedFillColor === null,
);

// 文本框颜色
const hasTextInSelection = computed(() =>
  canvasStore.selectedStrokes.some((s) => s.type === 'text'),
);

// 所有选中项都是文本框
const allSelectedAreText = computed(() =>
  hasSelection.value && canvasStore.selectedStrokes.every((s) => s.type === 'text'),
);

// 前景色/背景色按钮是否禁用（纯文本框时不参与）
const fgDisabled = computed(() => allSelectedAreText.value);
const bgDisabled = computed(() => allSelectedAreText.value);

const displayTextColor = computed(() => {
  if (hasSelection.value && canvasStore.selectedTextColor !== null) {
    return canvasStore.selectedTextColor;
  }
  return canvasStore.textColor;
});

const textColorMixed = computed(() =>
  hasTextInSelection.value && canvasStore.selectedTextColor === null,
);

function onTextColorClick() {
  canvasStore.setColorSlot('textColor');
  canvasStore.toggleColorPalette();
}

function onFgClick() {
  if (fgDisabled.value) return;
  canvasStore.setColorSlot('foreground');
  canvasStore.toggleColorPalette();
}

function onBgClick() {
  if (bgDisabled.value) return;
  canvasStore.setColorSlot('background');
  canvasStore.toggleColorPalette();
}
</script>

<template>
  <div class="toolbar">
    <!-- Scroll up button -->
    <button
      v-if="canScrollUp"
      class="scroll-btn scroll-up"
      @click="scrollUp"
    >
      <svg
        class="scroll-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>

    <!-- Scrollable tools container -->
    <div
      ref="toolsScrollRef"
      class="tools-scroll"
      @scroll="checkScroll"
    >
      <div class="tool-group">
        <button
          v-for="type in toolTypes"
          :key="type"
          :class="['tool-btn', { active: toolsStore.activeTool === type }]"
          :title="t(`tool.${type}`)"
          @click="toolsStore.setTool(type)"
        >
          <!-- Select: 镂空鼠标指针 -->
          <svg
            v-if="type === 'select'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4.5 3.5l5.5 15 2.5-6 6-2.5z" />
          </svg>
          <!-- Pan: 十字四方向箭头 -->
          <svg
            v-else-if="type === 'pan'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <line
              x1="12"
              y1="4"
              x2="12"
              y2="20"
            />
            <line
              x1="4"
              y1="12"
              x2="20"
              y2="12"
            />
            <polygon
              points="12,4 9,8 15,8"
              fill="currentColor"
              stroke="none"
            />
            <polygon
              points="12,20 9,16 15,16"
              fill="currentColor"
              stroke="none"
            />
            <polygon
              points="4,12 8,9 8,15"
              fill="currentColor"
              stroke="none"
            />
            <polygon
              points="20,12 16,9 16,15"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <!-- Pencil -->
          <svg
            v-else-if="type === 'pencil'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          <!-- Line -->
          <svg
            v-else-if="type === 'line'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <line
              x1="5"
              y1="19"
              x2="19"
              y2="5"
            />
          </svg>
          <!-- Circle -->
          <svg
            v-else-if="type === 'circle'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
            />
          </svg>
          <!-- Rect -->
          <svg
            v-else-if="type === 'rect'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
            />
          </svg>
          <!-- Triangle -->
          <svg
            v-else-if="type === 'triangle'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          >
            <polygon points="12,3 22,21 2,21" />
          </svg>
          <!-- Star -->
          <svg
            v-else-if="type === 'star'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          >
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
          <!-- Text -->
          <svg
            v-else-if="type === 'text'"
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 7 4 4 20 4 20 7" />
            <line
              x1="9"
              y1="20"
              x2="15"
              y2="20"
            />
            <line
              x1="12"
              y1="4"
              x2="12"
              y2="20"
            />
          </svg>
        </button>
      </div>

      <div class="tool-group nav-group">
        <button
          :class="['tool-btn', { active: toolsStore.activeTool === 'zoom' }]"
          :title="t('tool.zoom')"
          @click="toolsStore.setTool('zoom')"
        >
          <svg
            class="tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />
            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            />
            <line
              x1="11"
              y1="8"
              x2="11"
              y2="14"
            />
            <line
              x1="8"
              y1="11"
              x2="14"
              y2="11"
            />
          </svg>
        </button>
      </div>
    </div>
    <!-- end tools-scroll -->

    <!-- Scroll down button -->
    <button
      v-if="canScrollDown"
      class="scroll-btn scroll-down"
      @click="scrollDown"
    >
      <svg
        class="scroll-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div class="spacer" />

    <!-- Canvas size button -->
    <div class="canvas-size-wrapper">
      <button
        class="tool-btn"
        :title="t('canvasSize.title')"
        @click="openCanvasSizePopover"
      >
        <svg
          class="tool-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect
            x="2"
            y="2"
            width="20"
            height="14"
            rx="1.5"
          />
          <line
            x1="7"
            y1="16"
            x2="5"
            y2="22"
          />
          <line
            x1="17"
            y1="16"
            x2="19"
            y2="22"
          />
        </svg>
      </button>

      <!-- Popover -->
      <Teleport to="body">
        <div
          v-if="showCanvasSizePopover"
          class="canvas-size-backdrop"
          @mousedown="onPopoverBackdrop"
        >
          <div
            class="canvas-size-popover"
            :style="popoverStyle"
            @keydown="onPopoverKeydown"
          >
            <div class="popover-title">
              {{ t('canvasSize.title') }}
            </div>
            <div class="popover-field">
              <label class="popover-label">{{ t('canvasSize.width') }}</label>
              <input
                ref="widthInput"
                v-model.number="canvasSizeInput.width"
                type="number"
                min="1"
                class="popover-input"
                @keydown.enter="confirmCanvasSize"
              >
              <span class="popover-unit">px</span>
            </div>
            <div class="popover-field">
              <label class="popover-label">{{ t('canvasSize.height') }}</label>
              <input
                v-model.number="canvasSizeInput.height"
                type="number"
                min="1"
                class="popover-input"
                @keydown.enter="confirmCanvasSize"
              >
              <span class="popover-unit">px</span>
            </div>
            <div class="popover-field">
              <label class="popover-label">{{ t('canvasSize.background') }}</label>
              <div class="bg-color-row">
                <button
                  :class="['bg-radio-btn', { active: canvasBgInput !== 'transparent' }]"
                  :title="t('canvasSize.solidColor')"
                  @click="selectSolidColor"
                >
                  <span
                    class="bg-color-fill"
                    :style="{ background: canvasBgInput === 'transparent' ? '#ffffff' : canvasBgInput }"
                  />
                  <input
                    ref="hiddenColorInput"
                    type="color"
                    class="hidden-color-input"
                    :value="canvasBgInput === 'transparent' ? '#ffffff' : canvasBgInput"
                    @change="onColorInputChange"
                  >
                </button>
                <button
                  :class="['bg-radio-btn', 'bg-radio-btn--transparent', { active: canvasBgInput === 'transparent' }]"
                  :title="t('canvasSize.transparent')"
                  @click="selectTransparent"
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
                      x1="5"
                      y1="5"
                      x2="19"
                      y2="19"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div class="popover-actions">
              <button
                class="popover-btn cancel"
                @click="cancelCanvasSize"
              >
                {{ t('canvasSize.cancel') }}
              </button>
              <button
                class="popover-btn confirm"
                @click="confirmCanvasSize"
              >
                {{ t('canvasSize.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <div class="color-section">
      <div
        v-if="hasTextInSelection"
        class="color-indicator"
        :class="{ active: canvasStore.showColorPalette && canvasStore.activeColorSlot === 'textColor' }"
        :title="t('color.textColor')"
        @click="onTextColorClick"
      >
        <div class="color-swatch text-color-swatch">
          <svg
            class="text-color-icon"
            :style="{ color: textColorMixed ? 'var(--wb-text-secondary)' : displayTextColor }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 7 4 4 20 4 20 7" />
            <line
              x1="9"
              y1="20"
              x2="15"
              y2="20"
            />
            <line
              x1="12"
              y1="4"
              x2="12"
              y2="20"
            />
          </svg>
          <svg
            v-if="textColorMixed"
            class="mixed-icon"
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
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
          </svg>
        </div>
      </div>
      <div
        class="color-indicator"
        :class="{
          active: canvasStore.showColorPalette && canvasStore.activeColorSlot === 'foreground',
          disabled: fgDisabled,
        }"
        :title="t('color.foreground')"
        @click="onFgClick"
      >
        <div
          class="color-swatch fg"
          :class="{ mixed: fgMixed }"
          :style="{ background: fgMixed ? 'none' : displayFg }"
        >
          <svg
            v-if="fgMixed"
            class="mixed-icon"
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
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
          </svg>
        </div>
      </div>
      <div
        class="color-indicator"
        :class="{
          active: canvasStore.showColorPalette && canvasStore.activeColorSlot === 'background',
          disabled: bgDisabled,
        }"
        :title="t('color.background')"
        @click="onBgClick"
      >
        <div
          class="color-swatch bg"
          :class="{ mixed: bgMixed, transparent: !bgMixed && displayBg === 'transparent' }"
          :style="{ background: bgMixed ? 'none' : (displayBg === 'transparent' ? 'none' : displayBg) }"
        >
          <svg
            v-if="bgMixed"
            class="mixed-icon"
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
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
          </svg>
          <svg
            v-else-if="displayBg === 'transparent'"
            class="mixed-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line
              x1="5"
              y1="5"
              x2="19"
              y2="19"
            />
          </svg>
        </div>
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

/* Adaptive scrollable tools container */
.tools-scroll {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex-shrink: 1;
  min-height: 0;
}

.tools-scroll::-webkit-scrollbar {
  display: none;
}

.scroll-btn {
  width: 40px;
  height: 22px;
  border: none;
  border-radius: var(--wb-radius-sm);
  background: transparent;
  color: var(--wb-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all var(--wb-transition);
  flex-shrink: 0;
}

.scroll-btn:hover {
  background: var(--wb-surface-hover);
  color: var(--wb-text);
}

.scroll-icon {
  width: 14px;
  height: 14px;
  pointer-events: none;
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

/* Canvas size wrapper */
.canvas-size-wrapper {
  position: relative;
  margin-bottom: 6px;
}

/* Backdrop */
.canvas-size-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* Popover */
.canvas-size-popover {
  background: var(--wb-surface-toolbar);
  border: 1px solid var(--wb-border);
  border-radius: 8px;
  padding: 12px 14px;
  min-width: 180px;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.popover-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-text);
  margin-bottom: 10px;
}

.popover-field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.popover-label {
  font-size: 12px;
  color: var(--wb-text-secondary);
  width: 32px;
  flex-shrink: 0;
}

.popover-input {
  flex: 1;
  width: 70px;
  height: 28px;
  padding: 0 6px;
  font-size: 13px;
  border: 1px solid var(--wb-border);
  border-radius: 4px;
  background: var(--wb-surface);
  color: var(--wb-text);
  outline: none;
  text-align: right;
}

.popover-input:focus {
  border-color: var(--wb-accent);
}

.popover-unit {
  font-size: 11px;
  color: var(--wb-text-secondary);
  width: 20px;
  flex-shrink: 0;
}

.bg-color-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bg-radio-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--wb-border);
  border-radius: 4px;
  background: var(--wb-surface);
  color: var(--wb-text-secondary);
  cursor: pointer;
  padding: 0;
  transition: all var(--wb-transition);
  position: relative;
}

.bg-radio-btn:hover {
  border-color: var(--wb-text-secondary);
}

.bg-radio-btn.active {
  border-color: var(--wb-accent);
  box-shadow: 0 0 0 1px var(--wb-accent);
}

.bg-radio-btn--transparent {
  background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px;
}

.bg-color-fill {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid var(--wb-border);
}

.hidden-color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
}

.popover-btn {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--wb-border);
  background: var(--wb-surface);
  color: var(--wb-text);
  cursor: pointer;
  transition: all var(--wb-transition);
}

.popover-btn:hover {
  background: var(--wb-surface-hover);
}

.popover-btn.confirm {
  background: var(--wb-accent);
  color: #fff;
  border-color: var(--wb-accent);
}

.popover-btn.confirm:hover {
  opacity: 0.9;
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
  border-radius: 8px;
  cursor: pointer;
  padding: 2px;
  border: 2px solid transparent;
  transition: all var(--wb-transition);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.color-indicator:hover {
  background: var(--wb-surface-hover);
  border-color: var(--wb-border);
}

.color-indicator.active {
  border-color: var(--wb-accent);
  background: var(--wb-accent-light);
}

.color-indicator.disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

.color-swatch {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  border: 1px solid var(--wb-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.bg {
  border-radius: 6px;
  border-style: dashed;
}

.mixed {
  background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px !important;
}

.transparent {
  background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px !important;
}

.mixed-icon {
  width: 16px;
  height: 16px;
  color: var(--wb-text-secondary);
  pointer-events: none;
}

.text-color-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.text-color-icon {
  width: 18px;
  height: 18px;
  pointer-events: none;
  transition: color 0.15s ease;
}
</style>
