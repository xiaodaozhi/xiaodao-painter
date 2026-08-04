<script setup lang="ts">
import { computed } from 'vue'
import type { Stroke } from './types'
import { useCanvasStore } from './stores/canvas'

const props = defineProps<{
  stroke: Stroke
  startResize: (strokeId: string, handle: string, cursor: string, event: MouseEvent) => void
}>()

const canvasStore = useCanvasStore()

const pad = 6
const handleSize = 8

const box = computed(() => {
  const b = canvasStore.getStrokeDisplayBounds(props.stroke)
  return {
    x: b.x - pad,
    y: b.y - pad,
    w: b.width + pad * 2,
    h: b.height + pad * 2,
  }
})

const isLine = computed(() => props.stroke.type === 'line')

const lineHandlePositions = computed(() => {
  const s = props.stroke
  return [
    { name: 'line-start', cx: s.x, cy: s.y, cursor: 'move' },
    { name: 'line-end', cx: s.x + s.width, cy: s.y + s.height, cursor: 'move' },
  ]
})

const nonLineHandlePositions = computed(() => {
  const b = box.value
  return [
    { name: 'nw', cx: b.x, cy: b.y, cursor: 'nwse-resize' },
    { name: 'n',  cx: b.x + b.w / 2, cy: b.y, cursor: 'ns-resize' },
    { name: 'ne', cx: b.x + b.w, cy: b.y, cursor: 'nesw-resize' },
    { name: 'e',  cx: b.x + b.w, cy: b.y + b.h / 2, cursor: 'ew-resize' },
    { name: 'se', cx: b.x + b.w, cy: b.y + b.h, cursor: 'nwse-resize' },
    { name: 's',  cx: b.x + b.w / 2, cy: b.y + b.h, cursor: 'ns-resize' },
    { name: 'sw', cx: b.x, cy: b.y + b.h, cursor: 'nesw-resize' },
    { name: 'w',  cx: b.x, cy: b.y + b.h / 2, cursor: 'ew-resize' },
  ]
})

function onHandleMousedown(handle: string, cursor: string, e: MouseEvent) {
  props.startResize(props.stroke.id, handle, cursor, e)
}
</script>

<template>
  <g v-if="stroke">
    <!-- 选择框（虚线） -->
    <rect
      :x="box.x"
      :y="box.y"
      :width="box.w"
      :height="box.h"
      fill="none"
      stroke="#6366f1"
      stroke-width="2"
      stroke-dasharray="6 4"
      rx="4"
    />

    <!-- 直线：首尾两个手柄 -->
    <rect
      v-for="h in lineHandlePositions"
      v-show="isLine"
      :key="h.name"
      :x="h.cx - handleSize / 2"
      :y="h.cy - handleSize / 2"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#6366f1"
      stroke-width="1.5"
      rx="1"
      :style="{ cursor: h.cursor }"
      @mousedown.stop.prevent="onHandleMousedown(h.name, h.cursor, $event)"
    />

    <!-- 其余图形：八个手柄 -->
    <rect
      v-for="h in nonLineHandlePositions"
      v-show="!isLine"
      :key="h.name"
      :x="h.cx - handleSize / 2"
      :y="h.cy - handleSize / 2"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#6366f1"
      stroke-width="1.5"
      rx="1"
      :style="{ cursor: h.cursor }"
      @mousedown.stop.prevent="onHandleMousedown(h.name, h.cursor, $event)"
    />
  </g>
</template>
