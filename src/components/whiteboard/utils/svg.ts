import type { Stroke, Point } from '../types';
import { starVertices, triangleVertices } from './geometry';

export function pencilToPathD(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i]!.x + points[i + 1]!.x) / 2;
    const yc = (points[i]!.y + points[i + 1]!.y) / 2;
    d += ` Q ${points[i]!.x} ${points[i]!.y} ${xc} ${yc}`;
  }
  d += ` L ${points[points.length - 1]!.x} ${points[points.length - 1]!.y}`;
  return d;
}

export interface SvgAttrs {
  tag: string;
  attrs: Record<string, string | number>;
}

export function strokeToSvg(stroke: Stroke): SvgAttrs {
  const { type, x, y, width, height, points, strokeColor, fillColor, strokeWidth } = stroke;
  const common = {
    stroke: strokeColor,
    fill: fillColor,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
  };

  switch (type) {
    case 'pencil':
      return {
        tag: 'path',
        attrs: { ...common, fill: 'none', d: pencilToPathD(points) },
      };
    case 'line':
      return {
        tag: 'line',
        attrs: { ...common, fill: 'none', x1: x, y1: y, x2: x + width, y2: y + height },
      };
    case 'circle': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      return { tag: 'ellipse', attrs: { ...common, cx, cy, rx, ry } };
    }
    case 'rect':
      return {
        tag: 'rect',
        attrs: {
          ...common,
          x: width >= 0 ? x : x + width,
          y: height >= 0 ? y : y + height,
          width: Math.abs(width),
          height: Math.abs(height),
        },
      };
    case 'triangle': {
      const verts = triangleVertices(x, y, width, height);
      const pts = verts.map((v) => `${v.x},${v.y}`).join(' ');
      return { tag: 'polygon', attrs: { ...common, points: pts } };
    }
    case 'star': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width) / 2;
      const ry = Math.abs(height) / 2;
      const flipY = height >= 0;
      const verts = starVertices(cx, cy, rx, ry, flipY);
      const pts = verts.map((v) => `${v.x},${v.y}`).join(' ');
      return { tag: 'polygon', attrs: { ...common, points: pts } };
    }
    default:
      return { tag: 'g', attrs: {} };
  }
}
