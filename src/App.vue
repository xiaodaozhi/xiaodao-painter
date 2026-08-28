<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import PainterApp from './components/painter/Painter.vue';
import type { PainterData } from './components/painter/types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './components/painter/types';

const data = ref<PainterData>({
  strokes: [],
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
});

watch(data, (newVal) => {
  console.log(newVal);
});

onMounted(() => {
  document.title = '小刀画板工具 | Xiaodao Painter';
});
</script>

<template>
  <PainterApp v-model="data" theme="light" locale="zh-CN" />
</template>
