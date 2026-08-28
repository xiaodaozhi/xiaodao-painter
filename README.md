# Xiaodao Painter

[中文](./README.ZH.md) | **English** | [Demo](https://painter.xdz.me)

[![Downloads](https://img.shields.io/npm/d18m/xiaodao-painter)](https://www.npmjs.com/package/xiaodao-painter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5+-42b883.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF.svg)](https://vitejs.dev/)

A self-contained, embeddable **SVG drawing component** for Vue 3: a full-featured drawing surface (freehand pencil, shape primitives, text, selection & transform, pan & zoom, undo/redo, an internal clipboard, a color system, light/dark themes, and built-in i18n) packed into a single component, driven by one `v-model`.

![Preview](./img/preview.png)

---

## Features

### Drawing & Editing

- **9 tools**: Select, Pan, Pencil, Line, Rectangle, Circle, Triangle, Star, Text (plus a dedicated Zoom tool).
- **Selection & transform**: Click to select, box-select on empty space, drag to move, 8-handle resize (Shift = center-out / symmetric), layer reorder (bring to front / send to back).
- **Pan & zoom**: Grab-drag panning, discrete zoom steps (10%–1000%) anchored at the cursor; pinch zoom on touch devices.
- **Undo / redo**: Full stroke-level undo/redo stacks.
- **Internal clipboard**: Cut, copy, paste within the canvas (paste offset +20 px).
- **Color system**: Stroke (foreground), fill (background), and text-color slots; per-selection color application and canvas background (solid or transparent with grid).
- **Text tool**: Click to place an editable text box; double-click existing text to edit.

### Interaction

- **Pointer & touch**: A single interaction layer (`useDrawing`) unifies mouse and touch paths, including pinch-to-zoom and drag-to-draw/select.
- **Resize handles**: 8 handles for shapes, 2 endpoints for lines; live preview while dragging.
- **Modifier keys**: `Ctrl` = constrain 1:1 ratio (shapes), `Shift` = center-out expansion / 45° line snap.
- **Keyboard shortcuts**: Delete, Escape, Ctrl/⌘+Z / Ctrl/⌘+Y / Ctrl/⌘+X / Ctrl/⌘+C / Ctrl/⌘+V.
- **SVG rendering**: Every stroke is a real SVG element (`<path>`, `<line>`, `<ellipse>`, `<rect>`, `<polygon>`, `foreignObject`), so the output is resolution-independent and easy to export.

### Visual & Theming

- **Light / Dark themes**: Full color palette driven by CSS custom properties (`--wb-*`), switching swaps a single class.
- **Internationalization**: Chinese (`zh-CN`) and English (`en-US`) built in; toolbar labels and zoom indicator route through an `t()` dictionary.
- **Two-way binding**: Read and write the entire drawing via `v-model`.

---

## Installation

```bash
# npm
npm install xiaodao-painter
# pnpm
pnpm add xiaodao-painter
# yarn
yarn add xiaodao-painter
```

### Peer Dependencies

- `vue` `^3.0.0`

Import the stylesheet once:

```ts
import 'xiaodao-painter/style.css'
```

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/xiaodaozhi/xiaodao-painter.git
cd xiaodao-painter

# Install dependencies
npm install

# Start the dev server (demo page)
npm run dev
```

Navigate to `http://localhost:5173` to see the demo application.

To build a standalone demo page, run `npm run build:demo` and open `dist-demo/index.html`.

---

## Basic Usage

```vue
<template>
  <Painter
    v-model="data"
    theme="light"
    locale="zh-CN"
  />
</template>

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

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` (v-model) | `PainterData` | `{ strokes: [], canvasWidth: 800, canvasHeight: 600 }` | Two-way bound drawing data. Supports `canvasBackgroundColor`. |
| `theme` | `'light' \| 'dark'` | `'light'` | UI theme. |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | UI language. Any other value falls back to `zh-CN`. |
| `width` | `string \| number` | `'100%'` | Component width (CSS value or px number). |
| `height` | `string \| number` | `'100%'` | Component height (CSS value or px number). |

---

## Data Model

The whole drawing is described by a single serializable `PainterData` object, which makes persistence, undo/redo, and collaboration straightforward.

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

### Type Exports

```ts
import type {
  PainterData,        // main data interface
  Stroke,             // a single shape / text / pencil entry
  Point,              // { x: number; y: number }
  ToolType,           // union of all tool identifiers
  CanvasConfig,       // canvas size / background config
} from 'xiaodao-painter'

import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  HIT_THRESHOLD,
} from 'xiaodao-painter'
```

---

## Architecture

```src/
├── index.ts                         # Public entry: exports Painter + types/constants
├── App.vue                          # Demo root (sets page title, mounts the component)
├── style.css                        # Global theme CSS variables (light/dark)
└── components/painter/
    ├── Painter.vue                  # Public component: props, v-model sync, theme/locale provide
    ├── Whiteboard.vue               # SVG canvas, pointer/touch handling, zoom UI, text editing
    ├── Toolbar.vue                  # Tool buttons, color indicators, canvas-size popover
    ├── ColorPalette.vue             # Color picker for foreground/fill/text slots
    ├── SelectionOverlay.vue         # Bounding box + 8 resize handles (line gets 2 handles)
    ├── StrokeRenderer.vue           # Renders one Stroke as an SVG element
    ├── composables/
    │   ├── useDrawing.ts            # Interaction engine (draw/select/move/resize/pan/zoom/text)
    │   └── useI18n.ts               # provide/inject for locale, theme, root element
    ├── stores/
    │   ├── canvas.ts                # Central store: strokes, colors, pan/zoom, undo, clipboard
    │   └── tools.ts                 # Active tool state
    ├── utils/
    │   ├── geometry.ts              # Hit testing, star/triangle vertices, bounding box
    │   ├── svg.ts                   # Stroke → SVG element conversion
    │   └── i18n.ts                  # zh-CN / en-US dictionaries + t()
    └── types/index.ts               # TypeScript types and default constants
```

### Design Principles

- **Self-contained**: A single Vue 3 component with zero runtime dependencies beyond Vue; no global registration, no CSS framework.
- **Serializable state**: The whole drawing is one plain `PainterData` object, so it can be saved, loaded, and synced trivially.
- **SVG-based rendering**: Every stroke is a real SVG node (`<path>`, `<line>`, `<ellipse>`, `<rect>`, `<polygon>`, `foreignObject`). Output is resolution-independent, easily themeable, and export-friendly.
- **Predictable two-way binding**: The parent owns the data; the component reflects it and emits changes back through `v-model`. A `syncing` flag in the store plus a `suppressing` flag in the component prevents feedback loops.
- **Framework-light interaction**: Pointer + touch are handled manually with an explicit coordinate transform (not `getScreenCTM`), avoiding unreliable behavior under CSS transforms on iOS Safari.
- **Pure helpers**: Hit-testing, SVG conversion, and i18n live in `utils/` as framework-free functions, easy to reuse or unit-test.
- **Composition API**: Business logic is extracted into `composables/` (`useDrawing`, `useI18n`) and a small store layer (`canvas.ts`, `tools.ts`), keeping single-responsibility modules.

> **Single-instance note:** `canvas.ts` and `tools.ts` are module-level reactive singletons. Multiple `<Painter>` components on one page currently share state. To support multiple instances, promote the stores to a `provide`/`inject` scoped store per component.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | Delete selected strokes |
| `Escape` | Clear selection / cancel text edit |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Y` or `Ctrl/⌘ + Shift + Z` | Redo |
| `Ctrl/⌘ + X` | Cut |
| `Ctrl/⌘ + C` | Copy |
| `Ctrl/⌘ + V` | Paste (offset +20 px) |

While drawing or resizing, `Ctrl` constrains to 1:1, `Shift` gives center-out expansion (for closed shapes) or 45° line snapping (for lines).

---

## Theming & Internationalization

### Built-in Themes

The component ships two themes via the `theme` prop. Colors are driven by CSS custom properties defined in `style.css` (`--wb-*`), so the component adapts to light/dark automatically. Switching theme also flips the default foreground color (`#000000` ⇄ `#ffffff`) when the current color is the theme default.

Override CSS variables on any wrapper element for full customization:

```html
<div style="--wb-bg: #1a1a2e; --wb-text: #e0e0e0;">
  <Painter v-model="data" theme="dark" />
</div>
```

### Internationalization

UI text is provided for `zh-CN` and `en-US`. Pass `locale` to switch; unknown values fall back to `zh-CN`. The dictionary lives in `src/components/painter/utils/i18n.ts` and can be extended with additional locales.

---

## Development

```bash
npm run dev        # Start the Vite dev server (demo page)
npm run build      # Type-check (vue-tsc) and build the library bundle
npm run build:demo # Build the standalone demo page into ./dist-demo
npm run preview    # Preview the library production build
npm run lint:check # Run ESLint
npm run typecheck  # Type-check only
```

## Building

The library build uses `vite.config.ts` (lib mode). `npm run build` produces:

| File | Description |
|------|-------------|
| `dist/xiaodao-painter.es.js` | ES module (for bundlers) |
| `dist/xiaodao-painter.umd.js` | UMD bundle (for direct `<script>` usage) |
| `dist/xiaodao-painter.css` | Extracted stylesheet |
| `dist/types/` | TypeScript declaration files |

`npm run build:demo` builds a standalone demo site via `vite.demo.config.ts` into `dist-demo/` (git-ignored, same as `dist`).

---

## Roadmap

### Near-term

- [x] Pencil, shape, text drawing with selection & transform
- [x] Pan & zoom, undo/redo, internal clipboard
- [x] Color system, light/dark themes, i18n
- [ ] Export to PNG / SVG / JSON
- [ ] Shape-level snapping & alignment guides

### Mid-term

- [ ] Multi-page / multi-layer support
- [ ] Image embedding
- [ ] Cloud save / load integration

### Long-term

- [ ] Collaborative editing
- [ ] Plugin system for custom shape renderers

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Vue 3 (Composition API + `<script setup>`) | ^3.5 |
| Build | Vite | ^8.0 |
| Language | TypeScript (strict) | ~6.0 |
| Rendering | SVG 2D (DOM) | - |
| Type Checker | vue-tsc | ^3.3 |
| Package Manager | npm / pnpm | - |
| CSS | Scoped CSS + CSS Custom Properties | - |

---

## License

This project is licensed under the MIT License: see the [LICENSE](LICENSE) file for details.
