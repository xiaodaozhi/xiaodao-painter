<script setup lang="ts">
import type { Stroke } from './types'
import { strokeToSvg } from './utils/svg'

const props = defineProps<{
  stroke: Stroke
  isSelected: boolean
}>()
</script>

<template>
  <component
    :is="strokeToSvg(stroke).tag"
    v-bind="strokeToSvg(stroke).attrs"
    :class="{ selected: isSelected }"
    :data-stroke-id="stroke.id"
  />
</template>

<style scoped>
.selected {
  filter: drop-shadow(0 0 3px rgba(0, 120, 215, 0.6));
}
</style>
