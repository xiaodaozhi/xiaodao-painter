<script setup lang="ts">
import { ref } from 'vue'
import WhiteboardApp from './components/whiteboard/index.vue'
import type { Stroke } from './components/whiteboard/types'

const strokes = ref<Stroke[]>([])
</script>

<template>
  <WhiteboardApp v-model="strokes" theme="light" locale="zh-CN" />
</template>