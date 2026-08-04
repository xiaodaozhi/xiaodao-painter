<script setup lang="ts">
import { ref } from 'vue'
import WhiteboardApp from './components/whiteboard/index.vue'
import type { WhiteboardData } from './components/whiteboard/types'
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './components/whiteboard/types'

const data = ref<WhiteboardData>({
  strokes: [],
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
})
</script>

<template>
  <WhiteboardApp v-model="data" theme="light" locale="zh-CN" />
</template>