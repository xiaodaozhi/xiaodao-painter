# Xiaodao Painter

A self-contained, embeddable SVG whiteboard / drawing component for Vue 3: zero runtime dependencies beyond Vue 3 itself. It drops a full-featured drawing surface into any app. It supports freehand pencil, shape primitives (line / rectangle / circle / triangle / star), text, selection & transform, pan & zoom, undo/redo, an internal clipboard, layer ordering, a color system, light/dark themes, and built-in i18n (Chinese / English): all driven by a single `v-model`.

![Preview](./img/preview.png)

## Features

- **9 tools**: Select, Pan, Pencil, Line, Rectangle, Circle, Triangle, Star, Text (plus a dedicated Zoom tool).
- **Selection & manipulation**: click-to-select, box-select, drag-move, 8-handle resize (Shift = symmetric / center-out), layer reorder (bring to front / send to back).
- **Pan & zoom**: grab-drag panning, discrete zoom steps (10%–1000%) anchored at the cursor; pinch zoom on touch devices.
- **Undo / redo**: full stroke-level undo/redo stacks.
- **Internal clipboard**: cut, copy, paste within the whiteboard (paste offset +20 px).
- **Color system**: stroke (foreground), fill (background), and text-color slots; per-selection color application and canvas background (solid or transparent with grid).
- **Themes**: light and dark, with automatic foreground-color adjustment on theme switch.
- **Internationalization**: Chinese (`zh-CN`) and English (`en-US`) built in.
- **Keyboard shortcuts**: Delete, Escape, Ctrl/⌘+Z / Ctrl/⌘+Y / Ctrl/⌘+X / Ctrl/⌘+C / Ctrl/⌘+V.
- **Modifier keys**: Ctrl = constrain 1:1 ratio, Shift = center-out expansion / 45° line snap.
- **Two-way binding**: read and write the entire drawing via `v-model`.

## Installation

```bash
npm install xiaodao-painter
# or
pnpm add xiaodao-painter
yarn add xiaodao-painter
```

Peer dependency: `vue@^3.0.0`.

## Usage

The component requires no plugin or global setup: only Vue 3.

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Painter } from 'xiaodao-painter'
import type { PainterData } from 'xiaodao-painter'
import 'xiaodao-painter/style.css'

const data = ref<PainterData>({
  strokes: [],
  canvasWidth: 800,
  canvasHeight: 600,
})

watch(data, (val) => {
  console.log('Drawing changed:', val)
}, { deep: true })
</script>

<template>
  <Painter
    v-model="data"
    theme="light"
    locale="zh-CN"
  />
</template>
```

### With explicit dimensions and dark theme

```html
<Painter
  v-model="data"
  theme="dark"
  locale="en-US"
  :width="1200"
  :height="800"
/>
```

### With a custom canvas background

```html
<Painter
  v-model="data"
  :modelValue="{
    strokes: [],
    canvasWidth: 800,
    canvasHeight: 600,
    canvasBackgroundColor: '#f5f5f5',
  }"
/>
```

### Accessing the demo build

A standalone demo page is built with:

```bash
npm run build:demo   # outputs ./dist-demo (open dist-demo/index.html)
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `modelValue` | `PainterData` | `{ strokes: [], canvasWidth: 800, canvasHeight: 600 }` | Two-way bound drawing data. Supports `canvasBackgroundColor`. |
| `theme` | `'light' \| 'dark'` | `'light'` | UI theme. |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | UI language. Any other value falls back to `zh-CN`. |
| `width` | `string \| number` | `'100%'` | Component width (CSS value or px number). |
| `height` | `string \| number` | `'100%'` | Component height (CSS value or px number). |

## Data Model

The entire drawing is described by a single serializable object, which makes persistence, undo/redo, and collaboration straightforward.

```ts
interface PainterData {
  strokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  canvasBackgroundColor?: string   // any CSS color or 'transparent'
}

type ToolType =
  | 'select' | 'pan' | 'zoom'
  | 'pencil' | 'line' | 'circle' | 'rect' | 'triangle' | 'star'
  | 'text'

interface Point { x: number; y: number }

interface Stroke {
  id: string                       // crypto.randomUUID()
  type: ToolType
  x: number                        // bounding-box top-left (normalized on commit)
  y: number
  width: number                    // bounding-box width (may be negative while drawing)
  height: number
  points: Point[]                  // pencil path points; empty for non-pencil
  strokeColor: string
  fillColor: string                // 'transparent' / 'none' for pencil & line
  strokeWidth: number
  // text-only fields
  text?: string
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  textColor?: string
  textAutoWidth?: boolean
}
```

Coordinates are stored in **canvas (SVG user) coordinate space**, independent of zoom and pan. The component normalizes negative-width/height shapes on commit so the stored bounding box is always positive.

## Tools

| Tool | Behavior |
| --- | --- |
| Select | Click to select; drag empty space to box-select; drag a selected shape to move; drag handles to resize. |
| Pan | Drag to move the canvas viewport. |
| Zoom | Click to zoom in; right-click to zoom out; pinch on touch. |
| Pencil | Freehand path; stored as a smoothed quadratic Bézier. |
| Line | Straight segment; supports 45° snap (Shift). |
| Rectangle / Circle | Closed shapes; Shift = center-out, Ctrl = 1:1. |
| Triangle / Star | Closed shapes; same modifiers as above. |
| Text | Click to place an editable text box; double-click existing text to edit. |

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Delete` / `Backspace` | Delete selected strokes |
| `Escape` | Clear selection / cancel text edit |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Y` or `Ctrl/⌘ + Shift + Z` | Redo |
| `Ctrl/⌘ + X` | Cut |
| `Ctrl/⌘ + C` | Copy |
| `Ctrl/⌘ + V` | Paste (offset +20 px) |

While drawing or resizing, `Ctrl` constrains to 1:1, `Shift` gives center-out expansion (for closed shapes) or 45° line snapping (for lines).

## Theming

The component ships two themes via the `theme` prop. Colors are driven by CSS custom properties defined in `style.css` (`--wb-*`), so the component adapts to light/dark automatically. Switching theme also flips the default foreground color (`#000000` ⇄ `#ffffff`) when the current color is the theme default.

## Internationalization

UI text is provided for `zh-CN` and `en-US`. Pass `locale` to switch; unknown values fall back to `zh-CN`. The dictionary lives in `src/components/painter/utils/i18n.ts` and can be extended with additional locales.

## Development

```bash
npm run dev        # Start the Vite dev server (demo page)
npm run build      # Type-check (vue-tsc) and build the library bundle
npm run build:demo # Build the standalone demo page into ./dist-demo
npm run preview    # Preview the library production build
npm run lint:check # Run ESLint
npm run typecheck  # Type-check only
```

Library build outputs `dist/xiaodao-painter.es.js`, `dist/xiaodao-painter.umd.js`, `dist/xiaodao-painter.css`, and `dist/types/`.

## Project Structure

```
src/
  index.ts                         # Public entry: exports Painter + types/constants
  App.vue                          # Demo root (sets page title, mounts the component)
  style.css                        # Global theme CSS variables (light/dark)
  components/painter/
    Painter.vue                    # Public component: props, v-model sync, theme/locale provide
    Whiteboard.vue                 # SVG canvas, pointer/touch handling, zoom UI, text editing
    Toolbar.vue                    # Tool buttons, color indicators, canvas-size popover
    ColorPalette.vue               # Color picker popover for foreground/fill/text slots
    SelectionOverlay.vue           # Bounding box + 8 resize handles (line gets 2 handles)
    StrokeRenderer.vue             # Renders one Stroke as an SVG element
    composables/
      useDrawing.ts                # Interaction engine (draw/select/move/resize/pan/zoom/text)
      useI18n.ts                   # provide/inject for locale, theme, root element
    stores/
      canvas.ts                    # Central store: strokes, colors, pan/zoom, undo, clipboard
      tools.ts                     # Active tool state
    utils/
      geometry.ts                  # Hit testing, star/triangle vertices, bounding box
      svg.ts                       # Stroke → SVG element conversion
      i18n.ts                     # zh-CN / en-US dictionaries + t()
    types/index.ts                 # TypeScript types and default constants
```

## License

MIT
