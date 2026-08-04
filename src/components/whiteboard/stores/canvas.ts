import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Stroke } from '../types'
import { STROKE_WIDTH } from '../types'

export const useCanvasStore = defineStore('canvas', () => {
  const strokes = ref<Stroke[]>([])
  const selectedStrokeIds = ref<Set<string>>(new Set())
  const foregroundColor = ref('#000000')
  const backgroundColor = ref('transparent')
  const activeColorSlot = ref<'foreground' | 'background'>('foreground')
  const showColorPalette = ref(false)
  const strokeWidth = ref(STROKE_WIDTH)

  // undo/redo
  const undoStack = ref<Stroke[][]>([])
  const redoStack = ref<Stroke[][]>([])

  // 框选拖拽状态
  const isSelecting = ref(false)
  const selectionBox = ref<{ x: number; y: number; width: number; height: number } | null>(null)

  function setStrokeWidth(w: number) {
    strokeWidth.value = w
  }

  function toggleColorPalette() {
    showColorPalette.value = !showColorPalette.value
  }

  function hideColorPalette() {
    showColorPalette.value = false
  }

  const selectedStrokes = computed(() => {
    return strokes.value.filter(s => selectedStrokeIds.value.has(s.id))
  })

  // keep compatibility：单笔选中时返回该笔画
  const selectedStroke = computed(() => {
    const arr = selectedStrokes.value
    return arr.length === 1 ? arr[0] : null
  })

  const selectedStrokeId = computed(() => {
    return selectedStroke.value?.id ?? null
  })

  function isSelected(id: string): boolean {
    return selectedStrokeIds.value.has(id)
  }

  function selectStroke(id: string | null) {
    selectedStrokeIds.value = id ? new Set([id]) : new Set()
  }

  function selectStrokes(ids: string[]) {
    selectedStrokeIds.value = new Set(ids)
  }

  function clearSelection() {
    selectedStrokeIds.value = new Set()
  }

  function addStroke(stroke: Stroke) {
    pushUndo()
    strokes.value.push(stroke)
  }

  function updateStroke(id: string, changes: Partial<Stroke>) {
    const idx = strokes.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      strokes.value[idx] = { ...strokes.value[idx], ...changes }
    }
  }

  function deleteSelectedStrokes() {
    const idSet = selectedStrokeIds.value
    if (idSet.size === 0) return
    pushUndo()
    strokes.value = strokes.value.filter(s => !idSet.has(s.id))
    selectedStrokeIds.value = new Set()
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  // 剪贴板（画布内部复制粘贴）
  const clipboard = ref<Stroke[]>([])

  function cutSelectedStrokes() {
    if (selectedStrokeIds.value.size === 0) return
    clipboard.value = selectedStrokes.value.map(s => deepCloneStroke(s))
    deleteSelectedStrokes()
  }

  function copySelectedStrokes() {
    if (selectedStrokeIds.value.size === 0) return
    clipboard.value = selectedStrokes.value.map(s => deepCloneStroke(s))
  }

  function pasteStrokes() {
    if (clipboard.value.length === 0) return
    pushUndo()
    clearSelection()
    const newIds: string[] = []
    for (const s of clipboard.value) {
      const newStroke: Stroke = {
        ...deepCloneStroke(s),
        id: createStrokeId(),
        x: s.x + 20,
        y: s.y + 20,
        points: s.points.map(p => ({ x: p.x + 20, y: p.y + 20 })),
      }
      strokes.value.push(newStroke)
      newIds.push(newStroke.id)
    }
    selectStrokes(newIds)
  }

  function deepCloneStroke(s: Stroke): Stroke {
    return { ...s, points: s.points.map(p => ({ ...p })) }
  }

  function pushUndo() {
    undoStack.value.push(strokes.value.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })))
    redoStack.value = []
  }

  function undo() {
    if (undoStack.value.length === 0) return
    redoStack.value.push(strokes.value.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })))
    strokes.value = undoStack.value.pop()!
    selectedStrokeIds.value = new Set()
  }

  function redo() {
    if (redoStack.value.length === 0) return
    undoStack.value.push(strokes.value.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })))
    strokes.value = redoStack.value.pop()!
    selectedStrokeIds.value = new Set()
  }

  function moveSelectedUp() {
    const idSet = selectedStrokeIds.value
    if (idSet.size === 0) return
    pushUndo()
    const indices = strokes.value
      .map((s, i) => idSet.has(s.id) ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => b - a)
    for (const idx of indices) {
      if (idx < strokes.value.length - 1) {
        ;[strokes.value[idx], strokes.value[idx + 1]] = [strokes.value[idx + 1], strokes.value[idx]]
      }
    }
  }

  function moveSelectedDown() {
    const idSet = selectedStrokeIds.value
    if (idSet.size === 0) return
    pushUndo()
    const indices = strokes.value
      .map((s, i) => idSet.has(s.id) ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => a - b)
    for (const idx of indices) {
      if (idx > 0) {
        ;[strokes.value[idx], strokes.value[idx - 1]] = [strokes.value[idx - 1], strokes.value[idx]]
      }
    }
  }

  let syncing = false

  function syncFromParent(data: Stroke[]) {
    if (syncing) return
    if (!data || data.length === 0) return
    syncing = true
    strokes.value = [...data]
    setTimeout(() => { syncing = false }, 0)
  }

  function getStrokeDisplayBounds(stroke: Stroke) {
    const { x, y, width, height, type } = stroke
    if (type === 'line' || type === 'triangle' || type === 'star') {
      const absX = width >= 0 ? x : x + width
      const absY = height >= 0 ? y : y + height
      const absW = Math.abs(width)
      const absH = Math.abs(height)
      return { x: absX, y: absY, width: absW, height: absH }
    }
    return { x, y, width, height }
  }

  function setColorSlot(slot: 'foreground' | 'background') {
    activeColorSlot.value = slot
  }

  function setColor(color: string) {
    // 应用于所有选中的笔画
    if (selectedStrokeIds.value.size > 0) {
      pushUndo()
      for (const id of selectedStrokeIds.value) {
        if (activeColorSlot.value === 'foreground') {
          if (color === 'transparent') return
          updateStroke(id, { strokeColor: color })
        } else {
          updateStroke(id, { fillColor: color })
        }
      }
    } else {
      if (activeColorSlot.value === 'foreground') {
        if (color === 'transparent') return
        foregroundColor.value = color
      } else {
        backgroundColor.value = color
      }
    }
  }

  function createStrokeId(): string {
    return crypto.randomUUID()
  }

  function buildStroke(
    type: Stroke['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    points: Stroke['points']
  ): Stroke {
    return {
      id: createStrokeId(),
      type,
      x,
      y,
      width,
      height,
      points,
      strokeColor: foregroundColor.value,
      fillColor: type === 'pencil' || type === 'line' ? 'none' : backgroundColor.value,
      strokeWidth: strokeWidth.value,
    }
  }

  return {
    strokes,
    selectedStrokeIds,
    selectedStrokeId,
    selectedStroke,
    selectedStrokes,
    foregroundColor,
    backgroundColor,
    activeColorSlot,
    showColorPalette,
    isSelecting,
    selectionBox,
    toggleColorPalette,
    hideColorPalette,
    addStroke,
    updateStroke,
    selectStroke,
    selectStrokes,
    clearSelection,
    isSelected,
    deleteSelectedStrokes,
    setColorSlot,
    setColor,
    buildStroke,
    strokeWidth,
    setStrokeWidth,
    canUndo,
    canRedo,
    pushUndo,
    undo,
    redo,
    moveSelectedUp,
    moveSelectedDown,
    syncFromParent,
    getStrokeDisplayBounds,
    clipboard,
    cutSelectedStrokes,
    copySelectedStrokes,
    pasteStrokes,
  }
})
