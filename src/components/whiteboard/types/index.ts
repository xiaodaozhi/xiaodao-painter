export type ToolType = 'select' | 'pencil' | 'line' | 'circle' | 'rect' | 'triangle' | 'star'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  type: ToolType
  x: number
  y: number
  width: number
  height: number
  points: Point[]
  strokeColor: string
  fillColor: string
  strokeWidth: number
}

export const STROKE_WIDTH = 3
export const HIT_THRESHOLD = 8
