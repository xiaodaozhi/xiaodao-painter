import { ref, computed, reactive } from 'vue';
import type { Stroke } from '../types';
import { STROKE_WIDTH, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_FONT_SIZE } from '../types';

const strokes = ref<Stroke[]>([]);
const selectedStrokeIds = ref<Set<string>>(new Set());
const foregroundColor = ref('#000000');
const backgroundColor = ref('transparent');
const activeColorSlot = ref<'foreground' | 'background' | 'textColor'>('foreground');
const showColorPalette = ref(false);
const strokeWidth = ref(STROKE_WIDTH);
const canvasBackgroundColor = ref('transparent');
const theme = ref<'light' | 'dark'>('light');
const dataVersion = ref(0);

// Text tool state
const textColor = ref('#000000');
const editingTextId = ref<string | null>(null);
const hoveredTextId = ref<string | null>(null);

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

  const canvasX = (screenX - panX.value) / cur;
  const canvasY = (screenY - panY.value) / cur;

  panX.value = screenX - canvasX * nextZoom;
  panY.value = screenY - canvasY * nextZoom;
  zoomLevel.value = nextZoom;

  showZoomIndicator.value = true;
  if (zoomIndicatorTimer) clearTimeout(zoomIndicatorTimer);
  zoomIndicatorTimer = setTimeout(() => {
    showZoomIndicator.value = false;
  }, 1500);
}

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

const selectedStrokeColor = computed<string | null>(() => {
  const sel = selectedStrokes.value.filter((s) => s.type !== 'text');
  if (sel.length === 0) return null;
  const first = sel[0]!.strokeColor;
  return sel.every((s) => s.strokeColor === first) ? first : null;
});

const selectedFillColor = computed<string | null>(() => {
  const fills = selectedStrokes.value
    .filter((s) => s.type !== 'line' && s.type !== 'pencil' && s.type !== 'text');
  if (fills.length === 0) return null;
  const first = fills[0]!.fillColor;
  return fills.every((s) => s.fillColor === first) ? first : null;
});

const selectedTextColor = computed<string | null>(() => {
  const texts = selectedStrokes.value
    .filter((s) => s.type === 'text');
  if (texts.length === 0) return null;
  const first = texts[0]!.textColor ?? foregroundColor.value;
  return texts.every((s) => (s.textColor ?? foregroundColor.value) === first) ? first : null;
});

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
  if (idx === -1) return;
  const rounded = { ...changes };
  if (rounded.x !== undefined) rounded.x = Math.round(rounded.x);
  if (rounded.y !== undefined) rounded.y = Math.round(rounded.y);
  if (rounded.width !== undefined) rounded.width = Math.round(rounded.width);
  if (rounded.height !== undefined) rounded.height = Math.round(rounded.height);
  if (rounded.points) rounded.points = rounded.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  strokes.value[idx]! = { ...strokes.value[idx]!, ...rounded };
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

function setColorSlot(slot: 'foreground' | 'background' | 'textColor') {
  activeColorSlot.value = slot;
}

function setColor(color: string) {
  if (selectedStrokeIds.value.size > 0) {
    pushUndo();
    for (const id of selectedStrokeIds.value) {
      const stroke = strokes.value.find((s) => s.id === id);
      if (activeColorSlot.value === 'foreground') {
        if (color === 'transparent' || stroke?.type === 'text') continue;
        updateStroke(id, { strokeColor: color });
      } else if (activeColorSlot.value === 'textColor') {
        if (color === 'transparent') return;
        updateStroke(id, { textColor: color });
      } else {
        if (stroke?.type === 'text') continue;
        updateStroke(id, { fillColor: color });
      }
    }
    dataVersion.value++;
  } else {
    if (activeColorSlot.value === 'foreground') {
      if (color === 'transparent') return;
      foregroundColor.value = color;
    } else if (activeColorSlot.value === 'textColor') {
      if (color === 'transparent') return;
      textColor.value = color;
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
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    points: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    strokeColor: foregroundColor.value,
    fillColor: type === 'pencil' || type === 'line' ? 'none' : backgroundColor.value,
    strokeWidth: strokeWidth.value,
    ...(type === 'text'
      ? {
          text: '',
          fontSize: DEFAULT_FONT_SIZE,
          textAlign: 'left' as const,
          textColor: foregroundColor.value,
          textAutoWidth: true,
          fillColor: 'transparent',
          strokeColor: 'transparent',
          width: 0,
          height: 0,
        }
      : {}),
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
  textColor.value = '#000000';
  editingTextId.value = null;
  hoveredTextId.value = null;
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

const state = reactive({
  strokes,
  selectedStrokeIds,
  selectedStrokeId,
  selectedStroke,
  selectedStrokes,
  selectedStrokeColor,
  selectedFillColor,
  selectedTextColor,
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
  undoStack,
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
  textColor,
  editingTextId,
  hoveredTextId,
  reset,
});

export type CanvasStore = typeof state;

export function useCanvasStore(): CanvasStore {
  return state;
}
