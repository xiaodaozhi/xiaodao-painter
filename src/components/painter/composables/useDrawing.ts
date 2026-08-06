import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { Point, Stroke } from '../types';
import { useCanvasStore } from '../stores/canvas';
import { useToolsStore } from '../stores/tools';
import { hitTestStroke, computeBoundingBox } from '../utils/geometry';

export function useDrawing(whiteboardRef: Ref<HTMLElement | null>) {
  const canvasStore = useCanvasStore();
  const toolsStore = useToolsStore();

  const isDrawing = ref(false);
  const startPoint = ref<Point>({ x: 0, y: 0 });
  const currentPoint = ref<Point>({ x: 0, y: 0 });
  const pencilPoints = ref<Point[]>([]);
  const constrainRatio = ref(false);
  const centerOut = ref(false);
  const snapAngle = ref(false);

  // 移动笔画相关
  const isMoving = ref(false);
  const moveStartPositions = ref<Map<string, { x: number; y: number; width: number; height: number; points: Point[] }>>(new Map());

  // 缩放笔画相关
  const isResizing = ref(false);
  const resizeTargetId = ref<string | null>(null);
  const resizeHandle = ref('');
  const resizeCursor = ref('');
  const resizeOriginal = ref<{ x: number; y: number; width: number; height: number; type: string } | null>(null);

  // 平移画布
  const isPanning = ref(false);
  const panStartScreenX = ref(0);
  const panStartScreenY = ref(0);
  const panStartPanX = ref(0);
  const panStartPanY = ref(0);

  // Text tool pending click state
  const textClickPending = ref(false);

  // Callback to read text content from DOM (set by Whiteboard.vue)
  let textContentGetter: (() => string | null) | null = null;

  function setTextContentGetter(getter: () => string | null) {
    textContentGetter = getter;
  }

  /** Save the current editing text to the stroke without switching tools */
  function saveCurrentTextEdit() {
    const id = canvasStore.editingTextId;
    if (!id) return;
    const stroke = canvasStore.strokes.find((s) => s.id === id);
    if (!stroke) return;

    const text = textContentGetter?.() ?? null;
    if (text === null) return; // Can't read from DOM, skip

    if (!text.trim()) {
      // Empty text: remove stroke and pop its creation undo entry
      canvasStore.strokes = canvasStore.strokes.filter((s) => s.id !== id);
      if (canvasStore.undoStack.length > 0) {
        canvasStore.undoStack.pop();
      }
    } else {
      // Non-empty text: save to stroke (no undo push — creation is already recorded)
      canvasStore.updateStroke(id, { text });
    }
    canvasStore.editingTextId = null;
  }

  function handlePanMove(event: MouseEvent) {
    if (!isPanning.value) return;
    const dx = event.clientX - panStartScreenX.value;
    const dy = event.clientY - panStartScreenY.value;
    canvasStore.setPan(
      panStartPanX.value + dx,
      panStartPanY.value + dy,
    );
  }

  function handlePanEnd() {
    if (!isPanning.value) return;
    isPanning.value = false;
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
    window.removeEventListener('touchmove', handlePanTouchMove);
    window.removeEventListener('touchend', handlePanTouchEnd);
  }

  function applyModifiers(type: string, sx: number, sy: number, cx: number, cy: number) {
    let dx = cx - sx;
    let dy = cy - sy;

    // 闭合图形：圆形/矩形/三角形/五角星
    const isClosed = type === 'circle' || type === 'rect' || type === 'triangle' || type === 'star';

    if (type === 'line' && snapAngle.value) {
      // 直线角度锁定（45° 倍数）
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      dx = Math.cos(snapped) * len;
      dy = Math.sin(snapped) * len;
    }

    if (isClosed) {
      if (constrainRatio.value) {
        // 1:1 纵横比
        const maxDim = Math.max(Math.abs(dx), Math.abs(dy));
        dx = dx >= 0 ? maxDim : -maxDim;
        dy = dy >= 0 ? maxDim : -maxDim;
      }
      if (centerOut.value) {
        // 以起始点为中心扩展
        const bbox = computeClosedBbox(sx, sy, sx + dx, sy + dy);
        const cdx = bbox.width;
        const cdy = bbox.height;
        return {
          x: sx - cdx,
          y: sy - cdy,
          width: cdx * 2,
          height: cdy * 2,
        };
      }
    }

    const isDirectional = type === 'line' || type === 'triangle' || type === 'star';
    if (isDirectional) {
      return { x: sx, y: sy, width: dx, height: dy };
    }
    return computeClosedBbox(sx, sy, sx + dx, sy + dy);
  }

  function computeClosedBbox(x1: number, y1: number, x2: number, y2: number) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  const previewStroke = computed<Stroke | null>(() => {
    if (!isDrawing.value) return null;
    const type = toolsStore.activeTool;
    if (type === 'select' || type === 'pan' || type === 'zoom' || type === 'text') return null;

    const { x, y } = startPoint.value;
    const { x: cx, y: cy } = currentPoint.value;

    if (type === 'pencil') {
      const bbox = computeBoundingBox(pencilPoints.value);
      return {
        id: '__preview__',
        type: 'pencil',
        ...bbox,
        points: [...pencilPoints.value],
        strokeColor: canvasStore.foregroundColor,
        fillColor: 'none',
        strokeWidth: canvasStore.strokeWidth,
      };
    }

    const bbox = applyModifiers(type, x, y, cx, cy);

    return {
      id: '__preview__',
      type,
      ...bbox,
      points: [],
      strokeColor: canvasStore.foregroundColor,
      fillColor: type === 'line' ? 'none' : canvasStore.backgroundColor,
      strokeWidth: canvasStore.strokeWidth,
    };
  });

  /**
   * Convert mouse event coordinates to SVG canvas coordinates.
   * Uses the same manual calculation as pointerDown for cross-browser consistency.
   */
  function getSVGPoint(event: MouseEvent): Point {
    return pointerDown(event.clientX, event.clientY);
  }

  // --- Shared pointer coordinate helpers ---

  /**
   * Convert client (screen) coordinates to SVG canvas coordinates.
   * Uses manual calculation from the wrapper's bounding rect + zoom level
   * instead of getScreenCTM(), which is unreliable on iOS Safari when
   * ancestor elements use CSS transforms with will-change.
   */
  function pointerDown(clientX: number, clientY: number) {
    const container = whiteboardRef.value;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / canvasStore.zoomLevel,
      y: (clientY - rect.top) / canvasStore.zoomLevel,
    };
  }

  function onMouseDown(event: MouseEvent) {
    handlePointerDown(event.clientX, event.clientY, event.type === 'mousedown' ? event : undefined);
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0]!;
    handlePointerDown(touch.clientX, touch.clientY);
  }

  function handlePointerDown(clientX: number, clientY: number, mouseEvent?: MouseEvent) {
    const pt = pointerDown(clientX, clientY);

    // If a text edit is active and user clicks the canvas with a non-text tool,
    // auto-save the current text edit first
    if (canvasStore.editingTextId && toolsStore.activeTool !== 'text') {
      saveCurrentTextEdit();
    }

    // Pan tool
    if (toolsStore.activeTool === 'pan') {
      isPanning.value = true;
      panStartScreenX.value = clientX;
      panStartScreenY.value = clientY;
      panStartPanX.value = canvasStore.panX;
      panStartPanY.value = canvasStore.panY;
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      window.addEventListener('touchmove', handlePanTouchMove, { passive: false });
      window.addEventListener('touchend', handlePanTouchEnd);
      return;
    }

    // Zoom tool (mouse only — right-click to zoom out; touch uses pinch gesture handled separately)
    if (toolsStore.activeTool === 'zoom' && mouseEvent) {
      const factor = mouseEvent.button === 2 ? 0.8 : 1.25;
      const wrapper = whiteboardRef.value;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        canvasStore.zoomAt(clientX - rect.left, clientY - rect.top, factor);
      }
      return;
    }

    // Text tool: defer creation until pointer up
    if (toolsStore.activeTool === 'text') {
      // Skip click-on-existing-text when another text is being edited
      if (!canvasStore.editingTextId) {
        const hit = [...canvasStore.strokes].reverse().find((s) => hitTestStroke(pt, s));
        if (hit && hit.type === 'text') {
          // Click on existing text → enter edit mode
          canvasStore.hoveredTextId = null;
          saveCurrentTextEdit();
          canvasStore.pushUndo();
          canvasStore.editingTextId = hit.id;
          return;
        }
      }
      textClickPending.value = true;
      startPoint.value = pt;
      // Don't start drawing — text is created on pointer up
      return;
    }

    startPoint.value = pt;
    currentPoint.value = pt;
    isDrawing.value = true;

    if (toolsStore.activeTool === 'pencil') {
      pencilPoints.value = [pt];
    }

    if (toolsStore.activeTool === 'select') {
      const hit = [...canvasStore.strokes].reverse().find((s) => hitTestStroke(pt, s));
      if (hit && canvasStore.isSelected(hit.id)) {
        canvasStore.pushUndo();
        isMoving.value = true;
        moveStartPositions.value.clear();
        for (const s of canvasStore.selectedStrokes) {
          moveStartPositions.value.set(s.id, {
            x: s.x, y: s.y, width: s.width, height: s.height,
            points: s.points.map((p) => ({ ...p })),
          });
        }
        canvasStore.isSelecting = false;
        canvasStore.selectionBox = null;
      } else {
        isMoving.value = false;
        canvasStore.isSelecting = true;
        canvasStore.selectionBox = { x: pt.x, y: pt.y, width: 0, height: 0 };
      }
    }
  }

  function onMouseMove(event: MouseEvent) {
    handlePointerMove(event.clientX, event.clientY);
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0]!;
    handlePointerMove(touch.clientX, touch.clientY);
  }

  function handlePointerMove(clientX: number, clientY: number) {
    const pt = pointerDown(clientX, clientY);

    // Text tool: hover detection for existing text strokes (skip when editing)
    if (toolsStore.activeTool === 'text' && !isDrawing.value && !canvasStore.editingTextId) {
      const hit = [...canvasStore.strokes].reverse().find((s) => hitTestStroke(pt, s));
      canvasStore.hoveredTextId = (hit && hit.type === 'text') ? hit.id : null;
    } else if (!isDrawing.value) {
      canvasStore.hoveredTextId = null;
    }

    if (!isDrawing.value) return;
    currentPoint.value = pt;

    if (toolsStore.activeTool === 'pencil') {
      pencilPoints.value.push(pt);
    }

    if (toolsStore.activeTool === 'select') {
      if (isMoving.value) {
        const dx = pt.x - startPoint.value.x;
        const dy = pt.y - startPoint.value.y;
        for (const s of canvasStore.selectedStrokes) {
          const orig = moveStartPositions.value.get(s.id);
          if (!orig) continue;
          canvasStore.updateStroke(s.id, {
            x: orig.x + dx,
            y: orig.y + dy,
            points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          });
        }
      } else {
        canvasStore.selectionBox = {
          x: Math.min(startPoint.value.x, pt.x),
          y: Math.min(startPoint.value.y, pt.y),
          width: Math.abs(pt.x - startPoint.value.x),
          height: Math.abs(pt.y - startPoint.value.y),
        };
      }
    }
  }

  // --- Pan touch handlers ---

  function handlePanTouchMove(event: TouchEvent) {
    if (!isPanning.value || event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0]!;
    const dx = touch.clientX - panStartScreenX.value;
    const dy = touch.clientY - panStartScreenY.value;
    canvasStore.setPan(panStartPanX.value + dx, panStartPanY.value + dy);
  }

  function handlePanTouchEnd() {
    if (!isPanning.value) return;
    isPanning.value = false;
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
    window.removeEventListener('touchmove', handlePanTouchMove);
    window.removeEventListener('touchend', handlePanTouchEnd);
  }

  function onMouseUp(event: MouseEvent) {
    handlePointerUp(event.clientX, event.clientY);
  }

  function onTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    handlePointerUp(touch.clientX, touch.clientY);
  }

  function handlePointerUp(clientX: number, clientY: number) {
    // Zoom tool — no action on mouseup
    if (toolsStore.activeTool === 'zoom') return;

    // Text tool — create on pointer up
    if (toolsStore.activeTool === 'text') {
      if (textClickPending.value) {
        textClickPending.value = false;
        // Auto-save any previous text edit before creating a new one
        saveCurrentTextEdit();
        const stroke = canvasStore.buildStroke('text', startPoint.value.x, startPoint.value.y, 0, 0, []);
        canvasStore.addStroke(stroke);
        canvasStore.editingTextId = stroke.id;
      }
      return;
    }

    if (!isDrawing.value) return;
    isDrawing.value = false;

    const pt = pointerDown(clientX, clientY);
    const dx = pt.x - startPoint.value.x;
    const dy = pt.y - startPoint.value.y;
    const dist = Math.hypot(dx, dy);

    // 选择工具
    if (toolsStore.activeTool === 'select') {
      if (isMoving.value) {
        isMoving.value = false;
        moveStartPositions.value.clear();
        canvasStore.dataVersion++;
      } else {
        canvasStore.isSelecting = false;

        if (dist < 3) {
          const hit = [...canvasStore.strokes].reverse().find((s) => hitTestStroke(pt, s));
          canvasStore.selectStroke(hit?.id ?? null);
        } else {
          const box = canvasStore.selectionBox!;
          const ids: string[] = [];
          for (const s of [...canvasStore.strokes].reverse()) {
            const b = canvasStore.getStrokeDisplayBounds(s);
            if (
              b.x >= box.x && b.x + b.width <= box.x + box.width
              && b.y >= box.y && b.y + b.height <= box.y + box.height
            ) {
              ids.push(s.id);
            }
          }
          canvasStore.selectStrokes(ids);
        }
        canvasStore.selectionBox = null;
      }
      return;
    }

    // 非选择模式：短拖不做选中
    if (dist < 3) {
      canvasStore.clearSelection();
      return;
    }

    // Drag: create stroke
    const type = toolsStore.activeTool;
    const { x, y } = startPoint.value;

    if (type === 'pencil') {
      if (pencilPoints.value.length < 2) {
        canvasStore.clearSelection();
        return;
      }
      // 存储时四舍五入为整数，降低存储空间；渲染时通过Q曲线实现平滑
      const roundedPoints = pencilPoints.value.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y),
      }));
      const bbox = computeBoundingBox(roundedPoints);
      if (bbox.width < 3 && bbox.height < 3) {
        canvasStore.clearSelection();
        return;
      }
      const stroke = canvasStore.buildStroke('pencil', bbox.x, bbox.y, bbox.width, bbox.height, roundedPoints);
      canvasStore.addStroke(stroke);
      toolsStore.setTool('select');
      return;
    }

    const w = pt.x - x;
    const h = pt.y - y;
    if (Math.abs(w) < 3 && Math.abs(h) < 3) {
      canvasStore.clearSelection();
      return;
    }

    const bbox = applyModifiers(type, x, y, pt.x, pt.y);

    const stroke = canvasStore.buildStroke(type, bbox.x, bbox.y, bbox.width, bbox.height, []);
    canvasStore.addStroke(stroke);
    toolsStore.setTool('select');
  }

  // Text editing functions
  function commitTextEdit(strokeId: string, text: string) {
    const stroke = canvasStore.strokes.find((s) => s.id === strokeId);
    if (!stroke) return;
    if (!text.trim()) {
      // Empty text: remove the stroke (also from undo stack to avoid empty history)
      canvasStore.strokes = canvasStore.strokes.filter((s) => s.id !== strokeId);
      // Remove the entry from undo stack that contains this stroke
      if (canvasStore.undoStack.length > 0) {
        canvasStore.undoStack.pop();
      }
    } else {
      canvasStore.updateStroke(strokeId, { text });
    }
    canvasStore.editingTextId = null;
    // If the text tool is active, switch to select tool
    if (toolsStore.activeTool === 'text') {
      toolsStore.setTool('select');
    }
  }

  function cancelTextEdit(strokeId: string) {
    const stroke = canvasStore.strokes.find((s) => s.id === strokeId);
    if (!stroke) return;
    if (!stroke.text || !stroke.text.trim()) {
      // Empty text: remove the stroke from both strokes and undo stack
      canvasStore.strokes = canvasStore.strokes.filter((s) => s.id !== strokeId);
      if (canvasStore.undoStack.length > 0) {
        canvasStore.undoStack.pop();
      }
    }
    canvasStore.editingTextId = null;
    if (toolsStore.activeTool === 'text') {
      toolsStore.setTool('select');
    }
  }

  // Double-click to edit existing text when text tool is active
  function startEditText(strokeId: string) {
    // Push undo before editing so undo restores previous text state
    canvasStore.pushUndo();
    canvasStore.editingTextId = strokeId;
  }

  function updateModifiers(e: KeyboardEvent) {
    const ctrlKey = e.ctrlKey || e.metaKey;
    constrainRatio.value = ctrlKey;
    centerOut.value = e.shiftKey;
    snapAngle.value = e.shiftKey;
  }

  function clearModifiers() {
    constrainRatio.value = false;
    centerOut.value = false;
    snapAngle.value = false;
  }

  // --- 缩放逻辑 ---

  function computeResizeAnchor(normBounds: { x: number; y: number; w: number; h: number }, handle: string) {
    const { x, y, w, h } = normBounds;
    switch (handle) {
      case 'nw': return { x: x + w, y: y + h };
      case 'n':  return { x: x + w / 2, y: y + h };
      case 'ne': return { x: x, y: y + h };
      case 'e':  return { x: x, y: y + h / 2 };
      case 'se': return { x: x, y: y };
      case 's':  return { x: x + w / 2, y: y };
      case 'sw': return { x: x + w, y: y };
      case 'w':  return { x: x + w, y: y + h / 2 };
      case 'line-start': return { x: x + w, y: y + h };
      case 'line-end':   return { x: x, y: y };
      default:    return { x: x + w, y: y + h };
    }
  }

  function isEdgeHandle(handle: string): boolean {
    return handle === 'n' || handle === 's' || handle === 'e' || handle === 'w';
  }

  function startResize(strokeId: string, handle: string, cursor: string, event: MouseEvent | TouchEvent) {
    const stroke = canvasStore.strokes.find((s) => s.id === strokeId);
    if (!stroke) return;

    canvasStore.pushUndo();
    const norm = getNormalizedStrokeBounds(stroke);
    resizeOriginal.value = { x: norm.x, y: norm.y, width: norm.width, height: norm.height, type: stroke.type };
    resizeTargetId.value = strokeId;
    resizeHandle.value = handle;
    resizeCursor.value = cursor;
    isResizing.value = true;

    let clientX: number;
    let clientY: number;
    if ('touches' in event) {
      const touch = (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0];
      clientX = touch!.clientX;
      clientY = touch!.clientY;
      event.preventDefault();
    } else {
      clientX = (event as MouseEvent).clientX;
      clientY = (event as MouseEvent).clientY;
    }

    const pt = pointerDown(clientX, clientY);
    startPoint.value = pt;
    currentPoint.value = pt;

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
    window.addEventListener('touchend', handleResizeTouchEnd);
  }

  function handleResizeMove(event: MouseEvent) {
    handleResizePointerMove(event.clientX, event.clientY);
  }

  function handleResizeTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0]!;
    handleResizePointerMove(touch.clientX, touch.clientY);
  }

  function handleResizePointerMove(clientX: number, clientY: number) {
    if (!isResizing.value || !resizeOriginal.value || !resizeTargetId.value) return;

    const pt = pointerDown(clientX, clientY);
    currentPoint.value = pt;

    const orig = resizeOriginal.value;
    const origCenterX = orig.x + orig.width / 2;
    const origCenterY = orig.y + orig.height / 2;

    let newBounds: { x: number; y: number; width: number; height: number };

    if (centerOut.value && isEdgeHandle(resizeHandle.value)) {
      const { x, y, width: w, height: h } = orig;
      switch (resizeHandle.value) {
        case 'n': {
          const halfH = Math.abs(pt.y - origCenterY);
          newBounds = { x, y: origCenterY - halfH, width: w, height: halfH * 2 };
          break;
        }
        case 's': {
          const halfH = Math.abs(pt.y - origCenterY);
          newBounds = { x, y: origCenterY - halfH, width: w, height: halfH * 2 };
          break;
        }
        case 'e': {
          const halfW = Math.abs(pt.x - origCenterX);
          newBounds = { x: origCenterX - halfW, y, width: halfW * 2, height: h };
          break;
        }
        case 'w': {
          const halfW = Math.abs(pt.x - origCenterX);
          newBounds = { x: origCenterX - halfW, y, width: halfW * 2, height: h };
          break;
        }
        default:
          newBounds = { x, y, width: w, height: h };
      }
      canvasStore.updateStroke(resizeTargetId.value, newBounds);
      return;
    }

    if (centerOut.value) {
      newBounds = applyModifiers(orig.type, origCenterX, origCenterY, pt.x, pt.y);
      canvasStore.updateStroke(resizeTargetId.value, newBounds);
      return;
    }

    if (isEdgeHandle(resizeHandle.value)) {
      const { x, y, width: w, height: h } = orig;
      switch (resizeHandle.value) {
        case 'n': {
          const bottom = y + h;
          newBounds = { x, y: Math.min(pt.y, bottom), width: w, height: Math.abs(pt.y - bottom) };
          break;
        }
        case 's': {
          newBounds = { x, y, width: w, height: Math.abs(pt.y - y) };
          break;
        }
        case 'e': {
          newBounds = { x, y, width: Math.abs(pt.x - x), height: h };
          break;
        }
        case 'w': {
          const right = x + w;
          newBounds = { x: Math.min(pt.x, right), y, width: Math.abs(pt.x - right), height: h };
          break;
        }
        default:
          newBounds = { x, y, width: w, height: h };
      }
    } else {
      const anchor = computeResizeAnchor({ x: orig.x, y: orig.y, w: orig.width, h: orig.height }, resizeHandle.value);
      newBounds = applyModifiers(orig.type, anchor.x, anchor.y, pt.x, pt.y);
    }

    // For text strokes, ensure minimum height and mark as fixed width
    if (resizeOriginal.value?.type === 'text') {
      if (newBounds.width < 1) newBounds.width = 1;
      if (newBounds.height < 1) newBounds.height = 1;
      canvasStore.updateStroke(resizeTargetId.value, {
        ...newBounds,
        textAutoWidth: false,
      });
      return;
    }

    canvasStore.updateStroke(resizeTargetId.value, newBounds);
  }

  function handleResizeEnd() {
    finishResize();
  }

  function handleResizeTouchEnd(event: TouchEvent) {
    // Only finish when all touches are released
    if (event.touches.length === 0) {
      finishResize();
    }
  }

  function finishResize() {
    isResizing.value = false;
    resizeTargetId.value = null;
    resizeHandle.value = '';
    resizeCursor.value = '';
    resizeOriginal.value = null;
    canvasStore.dataVersion++;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    window.removeEventListener('touchmove', handleResizeTouchMove);
    window.removeEventListener('touchend', handleResizeTouchEnd);
  }

  function getNormalizedStrokeBounds(stroke: { x: number; y: number; width: number; height: number; type: string }) {
    const { type } = stroke;
    if (type === 'line' || type === 'triangle' || type === 'star') {
      const { x, y, width, height } = stroke;
      return {
        x: width >= 0 ? x : x + width,
        y: height >= 0 ? y : y + height,
        width: Math.abs(width),
        height: Math.abs(height),
      };
    }
    return { x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height };
  }

  // ---

  return {
    isDrawing,
    previewStroke,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getSVGPoint,
    updateModifiers,
    clearModifiers,
    isResizing,
    resizeCursor,
    startResize,
    commitTextEdit,
    cancelTextEdit,
    startEditText,
    saveCurrentTextEdit,
    setTextContentGetter,
  };
}
