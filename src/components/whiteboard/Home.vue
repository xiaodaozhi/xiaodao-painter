<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Locale } from './utils/i18n.ts';
import { provideLocale, provideRootEl } from './composables/useI18n';
import { useCanvasStore } from './stores/canvas';
import { useToolsStore } from './stores/tools';
import type { WhiteboardData } from './types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './types';
import Toolbar from './Toolbar.vue';
import Whiteboard from './Whiteboard.vue';
import ColorPalette from './ColorPalette.vue';
import './style.css';

const props = withDefaults(defineProps<{
  theme?: 'light' | 'dark';
  locale?: string;
  modelValue?: WhiteboardData;
  width?: string | number;
  height?: string | number;
}>(), {
  theme: 'light',
  locale: 'zh-CN',
  modelValue: () => ({
    strokes: [],
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
  }),
  width: '100%',
  height: '100%',
});

const emit = defineEmits<{
  'update:modelValue': [data: WhiteboardData];
}>();

const resolvedLocale = computed<Locale>(() =>
  props.locale === 'en-US' ? 'en-US' : 'zh-CN',
);

const rootStyle = computed(() => {
  const toVal = (v: string | number) => typeof v === 'number' ? `${v}px` : v;
  return {
    width: toVal(props.width!),
    height: toVal(props.height!),
  };
});

provideLocale(resolvedLocale.value);

const rootEl = ref<HTMLElement | null>(null);
provideRootEl(rootEl);

const canvasStore = useCanvasStore();
const toolsStore = useToolsStore();

// Reset all state on component initialization to ensure a clean slate
canvasStore.reset();
toolsStore.reset();

let suppressing = false;

watch(
  () => props.theme,
  (newTheme, oldTheme) => {
    canvasStore.theme = newTheme || 'light';

    if (newTheme === 'dark' && canvasStore.foregroundColor === '#000000') {
      canvasStore.foregroundColor = '#ffffff';
    } else if (newTheme === 'light' && oldTheme === 'dark' && canvasStore.foregroundColor === '#ffffff') {
      canvasStore.foregroundColor = '#000000';
    }
  },
  { immediate: true },
);

const themeClass = computed(() => {
  return `wb-theme-${props.theme}`;
});

// Sync canvas size from props -> store
canvasStore.setCanvasSize(
  props.modelValue.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
  props.modelValue.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
);
if (props.modelValue.canvasBackgroundColor != null) {
  canvasStore.setCanvasBackgroundColor(props.modelValue.canvasBackgroundColor);
}

watch(
  () => props.modelValue.canvasWidth,
  (w) => { if (w != null) canvasStore.setCanvasSize(w, canvasStore.canvasHeight); },
);

watch(
  () => props.modelValue.canvasHeight,
  (h) => { if (h != null) canvasStore.setCanvasSize(canvasStore.canvasWidth, h); },
);

// parent -> store (strokes)
watch(
  () => props.modelValue.strokes,
  (val) => {
    if (suppressing) return;
    canvasStore.syncFromParent(val);
  },
  { immediate: true, deep: true },
);

// store -> parent (emit merged data)
function emitUpdate() {
  suppressing = true;
  emit('update:modelValue', {
    strokes: canvasStore.strokes,
    canvasWidth: canvasStore.canvasWidth,
    canvasHeight: canvasStore.canvasHeight,
    canvasBackgroundColor: canvasStore.canvasBackgroundColor,
  });
  setTimeout(() => {
    suppressing = false;
  }, 0);
}

// emit on structural changes (strokes count, canvas size) or explicit dataVersion bump
watch(
  () => `${canvasStore.strokes.length}|${canvasStore.canvasWidth}|${canvasStore.canvasHeight}|${canvasStore.canvasBackgroundColor}|${canvasStore.dataVersion}`,
  () => { emitUpdate(); },
);
</script>

<template>
  <div
    ref="rootEl"
    :class="['wb-root', themeClass]"
    :style="rootStyle"
  >
    <Toolbar />
    <Whiteboard />
    <ColorPalette />
  </div>
</template>

<style scoped>
.wb-root {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
}
</style>
