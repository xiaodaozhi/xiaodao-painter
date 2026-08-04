<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Locale } from './utils/i18n'
import { provideLocale } from './composables/useI18n'
import { useCanvasStore } from './stores/canvas'
import type { Stroke } from './types'
import Toolbar from './Toolbar.vue'
import Whiteboard from './Whiteboard.vue'
import ColorPalette from './ColorPalette.vue'
import './style.css'

const props = withDefaults(defineProps<{
  theme?: 'light' | 'dark'
  locale?: string
  modelValue?: Stroke[]
}>(), {
  theme: 'light',
  locale: 'zh-CN',
  modelValue: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [strokes: Stroke[]]
}>()

const resolvedLocale = computed<Locale>(() =>
  props.locale === 'en-US' ? 'en-US' : 'zh-CN'
)

provideLocale(resolvedLocale.value)

const themeClass = computed(() => `wb-theme-${props.theme}`)

const canvasStore = useCanvasStore()
let suppressing = false

// parent -> store
watch(
  () => props.modelValue,
  (val) => {
    if (suppressing) return
    canvasStore.syncFromParent(val)
  },
  { immediate: true, deep: true }
)

// store -> parent
watch(
  () => canvasStore.strokes,
  (val) => {
    suppressing = true
    emit('update:modelValue', val)
    setTimeout(() => { suppressing = false }, 0)
  },
  { deep: true }
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