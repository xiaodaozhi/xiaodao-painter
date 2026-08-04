import type { Point, Stroke } from '../types';
import { HIT_THRESHOLD } from '../types';

export function starVertices(cx: number, cy: number, rx: number, ry: number, flipY = false, innerRatio = 0.382): Point[] {
  const signY = flipY ? -1 : 1;
  const result: Point[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (Math.PI / 2) * -1 + (Math.PI * 2 * i) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    result.push({ x: cx + rx * Math.cos(outerAngle), y: cy - signY * ry * Math.sin(outerAngle) });
    result.push({ x: cx + rx * innerRatio * Math.cos(innerAngle), y: cy - signY * ry * innerRatio * Math.sin(innerAngle) });
  }
  return result;
}

export function triangleVertices(x: number, y: number, w: number, h: number): Point[] {
  const absX = w >= 0 ? x : x + w;
  const absY = h >= 0 ? y : y + h;
  const absW = Math.abs(w);
  const absH = Math.abs(h);

  if (h >= 0) {
    return [
      { x: absX + absW / 2, y: absY },
      { x: absX + absW, y: absY + absH },
      { x: absX, y: absY + absH },
    ];
  } else {
    return [
      { x: absX + absW / 2, y: absY + absH },
      { x: absX, y: absY },
      { x: absX + absW, y: absY },
    ];
  }
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInEllipse(p: Point, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const dx = (p.x - cx) / rx;
  const dy = (p.y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

export function computeBoundingBox(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function hitTestStroke(p: Point, stroke: Stroke): boolean {
  const { x, y, width, height, type, points, fillColor } = stroke;
  const hasFill = fillColor !== 'none' && fillColor !== 'transparent';

  switch (type) {
    case 'pencil': {
      if (points.length < 2) return false;
      for (let i = 0; i < points.length - 1; i++) {
        if (pointToSegmentDistance(p, points[i], points[i + 1]) < HIT_THRESHOLD) return true;
      }
      return false;
    }
    case 'line': {
      return pointToSegmentDistance(p, { x, y }, { x: x + width, y: y + height }) < HIT_THRESHOLD;
    }
    case 'circle': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      if (hasFill && pointInEllipse(p, cx, cy, rx, ry)) return true;
      return pointInEllipse(p, cx, cy, rx + HIT_THRESHOLD, ry + HIT_THRESHOLD)
        && !pointInEllipse(p, cx, cy, rx - HIT_THRESHOLD, ry - HIT_THRESHOLD);
    }
    case 'rect': {
      if (hasFill) {
        const inside = p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height;
        if (inside) return true;
      }
      const expanded = p.x >= x - HIT_THRESHOLD && p.x <= x + width + HIT_THRESHOLD
        && p.y >= y - HIT_THRESHOLD && p.y <= y + height + HIT_THRESHOLD;
      const insideEdge = p.x >= x + HIT_THRESHOLD && p.x <= x + width - HIT_THRESHOLD
        && p.y >= y + HIT_THRESHOLD && p.y <= y + height - HIT_THRESHOLD;
      return expanded && !insideEdge;
    }
    case 'triangle': {
      const verts = triangleVertices(x, y, width, height);
      if (hasFill && pointInPolygon(p, verts)) return true;
      return pointInPolygon(p, verts);
    }
    case 'star': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      const flipY = height >= 0;
      const verts = starVertices(cx, cy, rx, ry, flipY);
      if (hasFill && pointInPolygon(p, verts)) return true;
      return pointInPolygon(p, verts);
    }
    default:
      return false;
  }
}
