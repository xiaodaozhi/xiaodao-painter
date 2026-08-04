<script setup lang="ts">
import { ref, watch } from 'vue';
import WhiteboardApp from './components/whiteboard/Home.vue';
import type { WhiteboardData } from './components/whiteboard/types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './components/whiteboard/types';

const data = ref<WhiteboardData>({
  strokes: [],
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
});

watch(data, (newVal) => {
  console.log(newVal);
});
</script>

<template>
  <WhiteboardApp v-model="data" theme="light" locale="zh-CN" />
</template>
