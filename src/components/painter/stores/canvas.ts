import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Stroke } from '../types';
import { STROKE_WIDTH, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../types';

export const useCanvasStore = defineStore('canvas', () => {
  const strokes = ref<Stroke[]>([]);
  const selectedStrokeIds = ref<Set<string>>(new Set());
  const foregroundColor = ref('#000000');
  const backgroundColor = ref('transparent');
  const activeColorSlot = ref<'foreground' | 'background'>('foreground');
  const showColorPalette = ref(false);
  const strokeWidth = ref(STROKE_WIDTH);
  const canvasBackgroundColor = ref('transparent');
  const theme = ref<'light' | 'dark'>('light');
  const dataVersion = ref(0);

  // Canvas size and pan/zoom
  const canvasWidth = ref(DEFAULT_CANVAS_WIDTH);
  const canvasHeight = ref(DEFAULT_CANVAS_HEIGHT);
  const panX = ref(0);
  const panY = ref(0);
  const zoomLevel = ref(1);
  const showZoomIndicator = ref(false);
  let zoomIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  // viewBox is always fixed to the canvas dimensions
  const viewBox = computed(() => `0 0 ${canvasWidth.value} ${canvasHeight.value}`);

  const canvasTransform = computed(() => {
    return `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`;
  });

  function setPan(x: number, y: number) {
    panX.value = x;
    panY.value = y;
  }

  function setCanvasSize(w: number, h: number) {
    canvasWidth.value = w;
    canvasHeight.value = h;
    dataVersion.value++;
  }

  const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10];

  /**
   * Zoom at a canvas-coordinate point (in screen space before zoom),
   * keeping that point stationary by adjusting pan.
   */
  function zoomAt(screenX: number, screenY: number, factor: number) {
    const cur = zoomLevel.value;
    const zoomingIn = factor > 1;

    let nextZoom: number | null = null;
    for (const step of ZOOM_STEPS) {
      if (zoomingIn) {
        if (step > cur + 0.001) {
          nextZoom = step;
          break;
        }
      } else {
        if (step < cur - 0.001) nextZoom = step;
      }
    }
    if (nextZoom === null) return;

    // The screen point (screenX, screenY) corresponds to:
    // canvasX = (screenX - panX) / cur
    // canvasY = (screenY - panY) / cur
    const canvasX = (screenX - panX.value) / cur;
    const canvasY = (screenY - panY.value) / cur;

    // After zoom, keep same canvas point at same screen position:
    // newScreenX = canvasX * nextZoom + newPanX
    // newScreenX should = screenX
    // => newPanX = screenX - canvasX * nextZoom
    panX.value = screenX - canvasX * nextZoom;
    panY.value = screenY - canvasY * nextZoom;
    zoomLevel.value = nextZoom;

    // Show zoom indicator
    showZoomIndicator.value = true;
    if (zoomIndicatorTimer) clearTimeout(zoomIndicatorTimer);
    zoomIndicatorTimer = setTimeout(() => {
      showZoomIndicator.value = false;
    }, 1500);
  }

  /**
   * Continuously set zoom level (for pinch gestures), clamping to the
   * ZOOM_STEPS range and keeping the given screen point stationary.
   */
  function continuousZoomAt(screenX: number, screenY: number, newZoom: number) {
    const minZoom = ZOOM_STEPS[0]!;
    const maxZoom = ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

    const cur = zoomLevel.value;
    const canvasX = (screenX - panX.value) / cur;
    const canvasY = (screenY - panY.value) / cur;

    panX.value = screenX - canvasX * newZoom;
    panY.value = screenY - canvasY * newZoom;
    zoomLevel.value = newZoom;

    showZoomIndicator.value = true;
    if (zoomIndicatorTimer) clearTimeout(zoomIndicatorTimer);
    zoomIndicatorTimer = setTimeout(() => {
      showZoomIndicator.value = false;
    }, 1500);
  }

  function getZoomPercent(): number {
    return Math.round(zoomLevel.value * 100);
  }

  // undo/redo
  const undoStack = ref<Stroke[][]>([]);
  const redoStack = ref<Stroke[][]>([]);

  // 框选拖拽状态
  const isSelecting = ref(false);
  const selectionBox = ref<{ x: number; y: number; width: number; height: number } | null>(null);

  function setStrokeWidth(w: number) {
    strokeWidth.value = w;
  }

  function setCanvasBackgroundColor(color: string) {
    canvasBackgroundColor.value = color;
    dataVersion.value++;
  }

  function toggleColorPalette() {
    showColorPalette.value = !showColorPalette.value;
  }

  function hideColorPalette() {
    showColorPalette.value = false;
  }

  const selectedStrokes = computed(() => {
    return strokes.value.filter((s) => selectedStrokeIds.value.has(s.id));
  });

  // 选中图形的统一边框颜色：全部一致时返回颜色，不一致返回 null
  const selectedStrokeColor = computed<string | null>(() => {
    const sel = selectedStrokes.value;
    if (sel.length === 0) return null;
    const first = sel[0]!.strokeColor;
    return sel.every((s) => s.strokeColor === first) ? first : null;
  });

  // 选中图形的统一填充颜色：排除直线/铅笔，全部一致返回颜色，不一致返回 null
  const selectedFillColor = computed<string | null>(() => {
    const fills = selectedStrokes.value
      .filter((s) => s.type !== 'line' && s.type !== 'pencil');
    if (fills.length === 0) return null;
    const first = fills[0]!.fillColor;
    return fills.every((s) => s.fillColor === first) ? first : null;
  });

  // keep compatibility：单笔选中时返回该笔画
  const selectedStroke = computed(() => {
    const arr = selectedStrokes.value;
    return arr.length === 1 ? arr[0] : null;
  });

  const selectedStrokeId = computed(() => {
    return selectedStroke.value?.id ?? null;
  });

  function isSelected(id: string): boolean {
    return selectedStrokeIds.value.has(id);
  }

  function selectStroke(id: string | null) {
    selectedStrokeIds.value = id ? new Set([id]) : new Set();
  }

  function selectStrokes(ids: string[]) {
    selectedStrokeIds.value = new Set(ids);
  }

  function clearSelection() {
    selectedStrokeIds.value = new Set();
  }

  function addStroke(stroke: Stroke) {
    pushUndo();
    strokes.value.push(stroke);
  }

  function updateStroke(id: string, changes: Partial<Stroke>) {
    const idx = strokes.value.findIndex((s) => s.id === id);
    if (idx !== -1) {
      strokes.value[idx]! = { ...strokes.value[idx]!, ...changes };
    }
  }

  function deleteSelectedStrokes() {
    const idSet = selectedStrokeIds.value;
    if (idSet.size === 0) return;
    pushUndo();
    strokes.value = strokes.value.filter((s) => !idSet.has(s.id));
    selectedStrokeIds.value = new Set();
  }

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  // 剪贴板（画布内部复制粘贴）
  const clipboard = ref<Stroke[]>([]);

  function cutSelectedStrokes() {
    if (selectedStrokeIds.value.size === 0) return;
    clipboard.value = selectedStrokes.value.map((s) => deepCloneStroke(s));
    deleteSelectedStrokes();
  }

  function copySelectedStrokes() {
    if (selectedStrokeIds.value.size === 0) return;
    clipboard.value = selectedStrokes.value.map((s) => deepCloneStroke(s));
  }

  function pasteStrokes() {
    if (clipboard.value.length === 0) return;
    pushUndo();
    clearSelection();
    const newIds: string[] = [];
    for (const s of clipboard.value) {
      const newStroke: Stroke = {
        ...deepCloneStroke(s),
        id: createStrokeId(),
        x: s.x + 20,
        y: s.y + 20,
        points: s.points.map((p) => ({ x: p.x + 20, y: p.y + 20 })),
      };
      strokes.value.push(newStroke);
      newIds.push(newStroke.id);
    }
    selectStrokes(newIds);
  }

  function deepCloneStroke(s: Stroke): Stroke {
    return { ...s, points: s.points.map((p) => ({ ...p })) };
  }

  function pushUndo() {
    undoStack.value.push(strokes.value.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })));
    redoStack.value = [];
  }

  function undo() {
    if (undoStack.value.length === 0) return;
    redoStack.value.push(strokes.value.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })));
    strokes.value = undoStack.value.pop()!;
    selectedStrokeIds.value = new Set();
  }

  function redo() {
    if (redoStack.value.length === 0) return;
    undoStack.value.push(strokes.value.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })));
    strokes.value = redoStack.value.pop()!;
    selectedStrokeIds.value = new Set();
  }

  function moveSelectedUp() {
    const idSet = selectedStrokeIds.value;
    if (idSet.size === 0) return;
    pushUndo();
    const indices = strokes.value
      .map((s, i) => idSet.has(s.id) ? i : -1)
      .filter((i) => i >= 0)
      .sort((a, b) => b - a);
    for (const idx of indices) {
      if (idx < strokes.value.length - 1) {
        ;[strokes.value[idx]!, strokes.value[idx + 1]!] = [strokes.value[idx + 1]!, strokes.value[idx]!];
      }
    }
  }

  function moveSelectedDown() {
    const idSet = selectedStrokeIds.value;
    if (idSet.size === 0) return;
    pushUndo();
    const indices = strokes.value
      .map((s, i) => idSet.has(s.id) ? i : -1)
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    for (const idx of indices) {
      if (idx > 0) {
        ;[strokes.value[idx]!, strokes.value[idx - 1]!] = [strokes.value[idx - 1]!, strokes.value[idx]!];
      }
    }
  }

  let syncing = false;

  function syncFromParent(data: Stroke[]) {
    if (syncing) return;
    syncing = true;
    strokes.value = Array.isArray(data)
      ? data.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }))
      : [];
    const availableIds = new Set(strokes.value.map((s) => s.id));
    selectedStrokeIds.value = new Set([...selectedStrokeIds.value].filter((id) => availableIds.has(id)));
    setTimeout(() => {
      syncing = false;
    }, 0);
  }

  function getStrokeDisplayBounds(stroke: Stroke) {
    const { x, y, width, height, type } = stroke;
    if (type === 'line' || type === 'triangle' || type === 'star') {
      const absX = width >= 0 ? x : x + width;
      const absY = height >= 0 ? y : y + height;
      const absW = Math.abs(width);
      const absH = Math.abs(height);
      return { x: absX, y: absY, width: absW, height: absH };
    }
    return { x, y, width, height };
  }

  function setColorSlot(slot: 'foreground' | 'background') {
    activeColorSlot.value = slot;
  }

  function setColor(color: string) {
    // 应用于所有选中的笔画
    if (selectedStrokeIds.value.size > 0) {
      pushUndo();
      for (const id of selectedStrokeIds.value) {
        if (activeColorSlot.value === 'foreground') {
          if (color === 'transparent') return;
          updateStroke(id, { strokeColor: color });
        } else {
          updateStroke(id, { fillColor: color });
        }
      }
      dataVersion.value++;
    } else {
      if (activeColorSlot.value === 'foreground') {
        if (color === 'transparent') return;
        foregroundColor.value = color;
      } else {
        backgroundColor.value = color;
      }
    }
  }

  function createStrokeId(): string {
    return crypto.randomUUID();
  }

  function buildStroke(
    type: Stroke['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    points: Stroke['points'],
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
    };
  }

  function reset() {
    strokes.value = [];
    selectedStrokeIds.value = new Set();
    foregroundColor.value = '#000000';
    backgroundColor.value = 'transparent';
    activeColorSlot.value = 'foreground';
    showColorPalette.value = false;
    strokeWidth.value = STROKE_WIDTH;
    canvasBackgroundColor.value = 'transparent';
    theme.value = 'light';
    dataVersion.value = 0;
    canvasWidth.value = DEFAULT_CANVAS_WIDTH;
    canvasHeight.value = DEFAULT_CANVAS_HEIGHT;
    panX.value = 0;
    panY.value = 0;
    zoomLevel.value = 1;
    showZoomIndicator.value = false;
    if (zoomIndicatorTimer) {
      clearTimeout(zoomIndicatorTimer);
      zoomIndicatorTimer = null;
    }
    undoStack.value = [];
    redoStack.value = [];
    isSelecting.value = false;
    selectionBox.value = null;
    clipboard.value = [];
  }

  return {
    strokes,
    selectedStrokeIds,
    selectedStrokeId,
    selectedStroke,
    selectedStrokes,
    selectedStrokeColor,
    selectedFillColor,
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
    canvasBackgroundColor,
    setCanvasBackgroundColor,
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
    canvasWidth,
    canvasHeight,
    panX,
    panY,
    zoomLevel,
    showZoomIndicator,
    viewBox,
    canvasTransform,
    setPan,
    setCanvasSize,
    zoomAt,
    continuousZoomAt,
    getZoomPercent,
    dataVersion,
    theme,
    reset,
  };
});
