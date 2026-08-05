export type ToolType = 'select' | 'pencil' | 'line' | 'circle' | 'rect' | 'triangle' | 'star' | 'pan' | 'zoom';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width: number;
  height: number;
  points: Point[];
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export interface CanvasConfig {
  width: number;
  height: number;
}

export interface WhiteboardData {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBackgroundColor?: string;
}

export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const STROKE_WIDTH = 3;
export const HIT_THRESHOLD = 8;
