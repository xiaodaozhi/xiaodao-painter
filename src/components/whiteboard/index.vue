<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Locale } from './utils/i18n'
import { provideLocale } from './composables/useI18n'
import { useCanvasStore } from './stores/canvas'
import type { WhiteboardData } from './types'
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './types'
import Toolbar from './Toolbar.vue'
import Whiteboard from './Whiteboard.vue'
import ColorPalette from './ColorPalette.vue'
import './style.css'

const props = withDefaults(defineProps<{
  theme?: 'light' | 'dark'
  locale?: string
  modelValue?: WhiteboardData
}>(), {
  theme: 'light',
  locale: 'zh-CN',
  modelValue: () => ({
    strokes: [],
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
  }),
})

const emit = defineEmits<{
  'update:modelValue': [data: WhiteboardData]
}>()

const resolvedLocale = computed<Locale>(() =>
  props.locale === 'en-US' ? 'en-US' : 'zh-CN'
)

provideLocale(resolvedLocale.value)

const themeClass = computed(() => `wb-theme-${props.theme}`)

const canvasStore = useCanvasStore()
let suppressing = false

// Sync canvas size from props -> store
canvasStore.setCanvasSize(
  props.modelValue.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
  props.modelValue.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
)

watch(
  () => props.modelValue.canvasWidth,
  (w) => { if (w != null) canvasStore.setCanvasSize(w, canvasStore.canvasHeight) },
)

watch(
  () => props.modelValue.canvasHeight,
  (h) => { if (h != null) canvasStore.setCanvasSize(canvasStore.canvasWidth, h) },
)

// parent -> store (strokes)
watch(
  () => props.modelValue.strokes,
  (val) => {
    if (suppressing) return
    canvasStore.syncFromParent(val)
  },
  { immediate: true, deep: true }
)

// store -> parent (emit merged data)
function emitUpdate() {
  if (suppressing) return
  emit('update:modelValue', {
    strokes: canvasStore.strokes,
    canvasWidth: canvasStore.canvasWidth,
    canvasHeight: canvasStore.canvasHeight,
  })
}

watch(
  () => canvasStore.strokes,
  () => {
    suppressing = true
    emitUpdate()
    setTimeout(() => { suppressing = false }, 0)
  },
  { deep: true }
)

watch(
  () => canvasStore.canvasWidth,
  () => { emitUpdate() },
)

watch(
  () => canvasStore.canvasHeight,
  () => { emitUpdate() },
)
</script>

<template>
  <div :class="['wb-root', themeClass]">
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