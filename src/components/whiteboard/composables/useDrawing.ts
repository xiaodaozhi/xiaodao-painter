import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { Point, Stroke } from '../types';
import { useCanvasStore } from '../stores/canvas';
import { useToolsStore } from '../stores/tools';
import { hitTestStroke, computeBoundingBox } from '../utils/geometry';

export function useDrawing(svgRef: Ref<SVGSVGElement | null>, whiteboardRef: Ref<HTMLElement | null>) {
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
    if (type === 'select' || type === 'pan' || type === 'zoom') return null;

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
   * Since the SVG CSS size may differ from its viewBox (due to zoom),
   * we use the inverse of getScreenCTM() to get the correct canvas coordinate.
   * This automatically accounts for scroll, transform, and viewBox.
   */
  function getSVGPoint(event: MouseEvent): Point {
    const svg = svgRef.value;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    // Fallback: manual calculation with container offset
    const container = whiteboardRef.value;
    const rect = container?.getBoundingClientRect() ?? svg.getBoundingClientRect();
    const scaleX = canvasStore.canvasWidth * canvasStore.zoomLevel / (rect.width || 1);
    const scaleY = canvasStore.canvasHeight * canvasStore.zoomLevel / (rect.height || 1);
    return {
      x: (event.clientX - rect.left + (container?.scrollLeft ?? 0)) / scaleX,
      y: (event.clientY - rect.top + (container?.scrollTop ?? 0)) / scaleY,
    };
  }

  function onMouseDown(event: MouseEvent) {
    const pt = getSVGPoint(event);

    // Pan tool
    if (toolsStore.activeTool === 'pan') {
      isPanning.value = true;
      panStartScreenX.value = event.clientX;
      panStartScreenY.value = event.clientY;
      panStartPanX.value = canvasStore.panX;
      panStartPanY.value = canvasStore.panY;
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      return;
    }

    // Zoom tool
    if (toolsStore.activeTool === 'zoom') {
      const factor = event.button === 2 ? 0.8 : 1.25;
      // Get the screen position of the click via the wrapper element
      const wrapper = whiteboardRef.value;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        canvasStore.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
      }
      return;
    }

    startPoint.value = pt;
    currentPoint.value = pt;
    isDrawing.value = true;

    if (toolsStore.activeTool === 'pencil') {
      pencilPoints.value = [pt];
    }

    if (toolsStore.activeTool === 'select') {
      // 检查是否点中了已选中的笔画（移动操作）
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
    if (!isDrawing.value) return;
    const pt = getSVGPoint(event);
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

  function onMouseUp(event: MouseEvent) {
    // Zoom tool — no action on mouseup
    if (toolsStore.activeTool === 'zoom') return;

    if (!isDrawing.value) return;
    isDrawing.value = false;

    const pt = getSVGPoint(event);
    const dx = pt.x - startPoint.value.x;
    const dy = pt.y - startPoint.value.y;
    const dist = Math.hypot(dx, dy);

    // 选择工具
    if (toolsStore.activeTool === 'select') {
      if (isMoving.value) {
        isMoving.value = false;
        moveStartPositions.value.clear();
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
            // 完全框选：笔画必须完全在框内
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
      const bbox = computeBoundingBox(pencilPoints.value);
      if (bbox.width < 3 && bbox.height < 3) {
        canvasStore.clearSelection();
        return;
      }
      const stroke = canvasStore.buildStroke('pencil', bbox.x, bbox.y, bbox.width, bbox.height, pencilPoints.value);
      canvasStore.addStroke(stroke);
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

  function startResize(strokeId: string, handle: string, cursor: string, event: MouseEvent) {
    const stroke = canvasStore.strokes.find((s) => s.id === strokeId);
    if (!stroke) return;

    canvasStore.pushUndo();
    const norm = getNormalizedStrokeBounds(stroke);
    resizeOriginal.value = { x: norm.x, y: norm.y, width: norm.width, height: norm.height, type: stroke.type };
    resizeTargetId.value = strokeId;
    resizeHandle.value = handle;
    resizeCursor.value = cursor;
    isResizing.value = true;

    const pt = getSVGPoint(event);
    startPoint.value = pt;
    currentPoint.value = pt;

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(event: MouseEvent) {
    if (!isResizing.value || !resizeOriginal.value || !resizeTargetId.value) return;

    const pt = getSVGPoint(event);
    currentPoint.value = pt;

    const orig = resizeOriginal.value;
    const origCenterX = orig.x + orig.width / 2;
    const origCenterY = orig.y + orig.height / 2;

    let newBounds: { x: number; y: number; width: number; height: number };

    // Shift 按下 + 边缘手柄：以原始中心点为中心，只改变单维度
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

    // Shift 按下 + 角手柄：以原始中心点为基点对称缩放
    if (centerOut.value) {
      newBounds = applyModifiers(orig.type, origCenterX, origCenterY, pt.x, pt.y);
      canvasStore.updateStroke(resizeTargetId.value, newBounds);
      return;
    }

    if (isEdgeHandle(resizeHandle.value)) {
      // 边缘手柄：只改变单维度，直接计算矩形bounds，不受 constrainRatio 影响
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

    canvasStore.updateStroke(resizeTargetId.value, newBounds);
  }

  function handleResizeEnd() {
    isResizing.value = false;
    resizeTargetId.value = null;
    resizeHandle.value = '';
    resizeCursor.value = '';
    resizeOriginal.value = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
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
    getSVGPoint,
    updateModifiers,
    clearModifiers,
    isResizing,
    resizeCursor,
    startResize,
  };
}
