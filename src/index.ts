import Painter from './components/painter/Painter.vue'
import type {
  PainterData,
  Stroke,
  Point,
  ToolType,
  CanvasConfig,
} from './components/painter/types'
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  HIT_THRESHOLD,
} from './components/painter/types'
import './components/painter/style.css'

export {
  Painter,
  Painter as default,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  HIT_THRESHOLD,
}

export type {
  PainterData,
  Stroke,
  Point,
  ToolType,
  CanvasConfig,
}
