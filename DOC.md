# Xiaodao Painter: Design Document

[中文](./DOC.ZH.md) | **English**

A Vue 3 drawing component based on SVG. It renders freehand pencil strokes, lines, shapes (circle, rectangle, triangle, star), and editable text on a pan/zoomable canvas, with color/fill/text controls, undo/redo, and clipboard support. The whole drawing is serializable to a plain object, making save/load and external integration trivial.

---

## 1. Tech Stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Vue 3 (Composition API + `<script setup>`) | ^3.5 |
| Build | Vite | ^8.2 |
| Language | TypeScript (strict) | ~6.0 |
| Rendering | SVG / DOM (no Canvas 2D / no WebGL) | - |
| Type Checker | vue-tsc | ^3.3 |
| Package Manager | npm / pnpm | - |

---

## 2. File Structure

```
xiaodao-painter/
├── index.html                          # Entry HTML for the demo page (mounts App.vue)
├── package.json
├── tsconfig.json                       # strict mode
├── tsconfig.app.json                  # app build config
├── tsconfig.node.json
├── vite.config.ts                     # library build (lib mode)
├── vite.demo.config.ts                # demo-site build (app mode, outputs dist-demo/)
└── src/
│   ├── main.ts                         # createApp(App).mount('#app')
│   ├── App.vue                         # Demo application (mounts <Painter>)
│   ├── index.ts                        # Library entry: re-exports component + types
│   └── components/
│       └── painter/
│           ├── Painter.vue             # Public component: props, v-model, provide, reset
│           ├── Whiteboard.vue          # SVG surface, pointer/touch wiring, zoom UI, text editing
│           ├── Toolbar.vue             # Tool buttons, color slots, canvas-size dialog
│           ├── ColorPalette.vue        # Foreground / fill / text color picker
│           ├── StrokeRenderer.vue      # Single stroke -> SVG element via strokeToSvg
│           ├── SelectionOverlay.vue    # Selection box + resize handles (8 / 6 / 2 endpoints)
│           ├── style.css               # Theme CSS variables (.wb-theme-light / .wb-theme-dark)
│           ├── types/
│           │   └── index.ts            # All type definitions + exported constants
│           ├── stores/
│           │   ├── canvas.ts           # Singleton reactive store: strokes, colors, pan/zoom, undo/redo, clipboard
│           │   └── tools.ts            # Singleton reactive store: activeTool + setTool()
│           ├── composables/
│           │   ├── useDrawing.ts       # Pointer/touch engine: draw / select / resize / pan / zoom / text
│           │   └── useI18n.ts          # provideLocale / provideRootEl + useI18n()
│           └── utils/
│               ├── svg.ts              # strokeToSvg(), pencilToPathD(), SvgAttrs
│               ├── geometry.ts         # hit-test, vertices, bounding box
│               └── i18n.ts             # zh-CN / en-US dictionaries + t()
```

**Dependency Direction**: `App.vue → Painter.vue → stores/* + composables/* + components/*`; `useDrawing.ts → canvas.store + tools.store + utils/geometry`; `StrokeRenderer.vue → utils/svg`; `Toolbar.vue → canvas.store + tools.store + utils/i18n`. All UI modules share the two module-level singleton stores (`canvas.ts`, `tools.ts`).

---

## 3. Type System

All type definitions live in `components/painter/types/index.ts` (re-exported from `src/index.ts`).

```typescript
export type ToolType =
  | 'select' | 'pencil' | 'line' | 'circle' | 'rect' | 'triangle' | 'star'
  | 'text' | 'pan' | 'zoom';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;                                  // crypto.randomUUID()
  type: ToolType;                              // shape kind (text uses foreignObject)
  x: number;                                   // bounding-box origin (canvas coords, integer)
  y: number;
  width: number;                               // bounding-box size (integer; signed for line/flag)
  height: number;
  points: Point[];                             // pencil path points; empty for non-pencil
  strokeColor: string;                         // stroke color ('transparent' for text)
  fillColor: string;                           // 'none' / 'transparent' / color
  strokeWidth: number;
  text?: string;                               // present for text strokes
  fontSize?: number;                           // default 16
  textAlign?: 'left' | 'center' | 'right';    // default 'left'
  textColor?: string;                          // defaults to strokeColor
  textAutoWidth?: boolean;                     // true = width follows text content
}

export interface CanvasConfig {
  width: number;
  height: number;
}

export interface PainterData {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBackgroundColor?: string;               // 'transparent' or color
}

// Exported constants
export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const STROKE_WIDTH = 3;
export const DEFAULT_FONT_SIZE = 16;
export const HIT_THRESHOLD = 8;
```

`PainterData` is the single serializable contract used by `v-model`. The internal store (`canvas.ts`) keeps `strokes` as a `ref<Stroke[]>` and never stores anything that cannot be JSON-serialized.

---

## 4. State Management

State lives in two module-level reactive singletons created with `reactive()`:

| Store | Responsibility |
| --- | --- |
| `canvas.ts` | `strokes[]`, `selectedStrokeIds` (`Set`), foreground/background/text colors, active color slot, stroke width, canvas size, pan/zoom, undo/redo stacks, internal clipboard, text-edit state, theme, `dataVersion`. |
| `tools.ts` | `activeTool` and `setTool()` (clears selection when leaving `select`). |

`canvas.ts` exposes a single `state` object; `useCanvasStore()` returns it directly:

```ts
export function useCanvasStore(): CanvasStore {
  return state;
}
```

**Limitation / implication:** because the store is module-scoped, every `useCanvasStore()` call across the app returns the same object. The current design assumes a single active `<Painter>` per page (`.reset()` is called on `Painter.vue` setup to guarantee a clean slate). Rendering two `<Painter>` instances on one page would share state. To support multiple instances, promote the store to a `provide`/`inject` scoped store per component.

### 4.1 Core State

| State | Type | Description |
| --- | --- | --- |
| `strokes` | `ref<Stroke[]>` | All strokes on the canvas |
| `selectedStrokeIds` | `ref<Set<string>>` | Currently selected stroke ids |
| `foregroundColor` / `backgroundColor` / `textColor` | `ref<string>` | Active colors for the next stroke / color slot |
| `activeColorSlot` | `ref<'foreground' | 'background' | 'textColor'>` | Which color the palette edits |
| `strokeWidth` | `ref<number>` | Outline width for shapes / pencil |
| `canvasBackgroundColor` | `ref<string>` | `'transparent'` or a paint color |
| `canvasWidth` / `canvasHeight` | `ref<number>` | Logical canvas size (SVG viewBox) |
| `panX` / `panY` | `ref<number>` | Pan offset in screen pixels |
| `zoomLevel` | `ref<number>` | Zoom factor; clamped to `ZOOM_STEPS` |
| `editingTextId` / `hoveredTextId` | `ref<string \| null>` | Text editing / hover state |
| `isSelecting` / `selectionBox` | `ref` | Marquee selection box |
| `undoStack` / `redoStack` | `ref<Stroke[][]>` | Snapshot stacks (snapshots are deep copies) |
| `theme` | `ref<'light' | 'dark'>` | Theme mode |
| `dataVersion` | `ref<number>` | Bumped on structural edits to trigger `v-model` emit |

Derived (computed) selectors: `selectedStrokes`, `selectedStroke`, `selectedStrokeId`, `selectedStrokeColor`, `selectedFillColor`, `selectedTextColor`, `canUndo`, `canRedo`, plus `viewBox` (`0 0 canvasWidth canvasHeight`) and `canvasTransform` (`translate(...) scale(...)`).

`ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10]` is the fixed zoom ladder; `zoomAt()` snaps to the next step while anchoring at the cursor, and `continuousZoomAt()` supports pinch gestures.

### 4.2 v-model Sync Protocol

`Painter.vue` bridges the parent's `modelValue: PainterData` and the internal store with a dual-flag design:

- **Parent → store:** a deep watcher on `modelValue.strokes` calls `canvasStore.syncFromParent()` (guarded by a `syncing` flag). Canvas width/height background are pushed on change.
- **Store → parent:** a watcher on `strokes.length | canvasWidth | canvasHeight | canvasBackgroundColor | dataVersion` triggers `emit('update:modelValue', …)` with a cloned snapshot. A `suppressing` flag in the component prevents the emitted value from re-entering `syncFromParent`.

The combination of `syncing` (store) + `suppressing` (component) is what keeps two-way binding stable without infinite watches.

---

## 5. Layout Constants & Coordinate System

Constants (from `types/index.ts`):

```
DEFAULT_CANVAS_WIDTH  = 800
DEFAULT_CANVAS_HEIGHT = 600
STROKE_WIDTH          = 3
DEFAULT_FONT_SIZE     = 16
HIT_THRESHOLD         = 8   (hit-test tolerance in canvas units)
```

The canvas is an SVG with a **fixed** `viewBox` (`0 0 canvasWidth canvasHeight`). Pan and zoom are applied as a single CSS transform on the wrapper:

```
transform: translate(panX px, panY px) scale(zoomLevel)
```

Screen → canvas conversion is computed manually (not via `getScreenCTM`):

```ts
canvasX = (clientX - wrapperRect.left) / zoomLevel
canvasY = (clientY - wrapperRect.top)  / zoomLevel
```

This is deliberate: `getScreenCTM()` is unreliable on iOS Safari when ancestor elements use CSS transforms with `will-change`, so the manual calculation gives consistent behavior across browsers.

---

## 6. Rendering Pipeline

Each `Stroke` is rendered by `StrokeRenderer.vue`, which calls `strokeToSvg(stroke)` from `utils/svg.ts`:

| `type` | SVG element | Notes |
| --- | --- | --- |
| `pencil` | `<path>` | Quadratic Bézier smoothing from `points`; `fill:none`. |
| `line` | `<line>` | From `(x,y)` to `(x+width, y+height)`. |
| `circle` | `<ellipse>` | Centered in the bounding box. |
| `rect` | `<rect>` | Normalized to positive width/height. |
| `triangle` | `<polygon>` | Vertices from `triangleVertices()`. |
| `star` | `<polygon>` | 5-point star from `starVertices()` (inner ratio 0.382). |
| `text` | `foreignObject` | Rendered as an editable `<div>` in `Whiteboard.vue` instead. |

Text strokes are special: they emit a `<foreignObject>` wrapping a `contenteditable` `<div>` so the user can type directly. `SelectionOverlay.vue` draws the dashed bounding box and resize handles: 8 for closed shapes, 6 for text (no north/south handles), and 2 endpoints for lines.

Rendering is declarative (Vue-driven), not a manual draw loop. The grid background, canvas-border, strokes layer, preview stroke, selection overlays, and hover outline are all SVG nodes bound to store state. Zoom and pan come for free from the wrapper transform, so no per-frame redraw logic is needed.

---

## 7. Stroke Geometry & SVG Conversion

Pure, Vue-free helpers in `utils/geometry.ts` and `utils/svg.ts`:

- `pencilToPathD(points)`: builds a quadratic Bézier `d` string from raw pencil points (smoothing via midpoints).
- `triangleVertices(x, y, w, h)` / `starVertices(cx, cy, rx, ry, flipY)`: compute polygon vertex arrays.
- `pointToSegmentDistance()`, `pointInPolygon()`, `pointInEllipse()`, `computeBoundingBox()`: used by `hitTestStroke`.
- `hitTestStroke(p, stroke)`: returns whether a canvas point hits a stroke; uses point-to-segment distance for pencil/lines and in-shape tests for fills. Honors `HIT_THRESHOLD` for near-edge hits.

`strokeToSvg(stroke)` maps each `Stroke` to `{ tag, attrs }` (an SVG element + attribute map) with shared `stroke`, `stroke-width`, `stroke-linecap: round`, `stroke-linejoin: round`. Pencil forces `fill:none`; shapes use `fillColor`; text returns an empty `<g>` (rendered separately). These functions are zero-Vue and easy to unit-test.

---

## 8. Interaction Model

### 8.1 Mouse

| Operation | Behavior |
| --- | --- |
| Click (select) | Select single stroke under cursor |
| Drag (select) | Marquee box-select; `dist < 3` → click-select / clear |
| Drag (shape tools) | Create a live preview stroke; commit on mouse-up |
| Drag handle | Resize selected stroke (8 / 6 / 2 handles) |
| Pan tool | Drag to move the canvas |
| Zoom tool (left click) | Zoom in; right click zooms out |
| Keyboard Ctrl+scroll / Zoom tool pinch | Zoom anchored at cursor |

### 8.2 Touch

- Single-finger drag draws / selects / pans depending on the active tool.
- Two-finger pinch (only when the zoom tool is active) zooms continuously via `continuousZoomAt()`.
- Double-click/tap (when not in text tool) enters text-edit on an existing text stroke.

### 8.3 Keyboard (global)

| Keys | Action |
| --- | --- |
| `Delete` / `Backspace` | Delete selected strokes |
| `Escape` | Clear selection (also cancels text edit) |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Cut / copy / paste strokes |

Modifier keys during drag: **Ctrl** constrains closed shapes to 1:1; **Shift** centers the shape on the start point and (for lines) snaps the angle to 45° increments.

### 8.4 Text Editing

- Text strokes are created on pointer-up (deferred from pointer-down).
- Editing uses an inline `contenteditable` `<div>`; commit on `Enter` (single-line) or blur, cancel on `Escape`.
- Empty text on commit removes the stroke and pops its creation undo entry (no empty history).
- When a single text stroke is selected, a floating bar exposes font-size +/- and left/center/right alignment.

---

## 9. Clipboard Protocol

The clipboard is internal (in-store), not the OS clipboard:

- **Copy**: snapshots the selected strokes (deep clone of `points`) into `clipboard`.
- **Cut**: copies, then deletes the selection.
- **Paste**: deep-clones each clipboard stroke with a new `id`, offsets every coordinate by `+20,+20`, clears the old selection, and selects the pasted set.

Because the clipboard is model-level JSON, the same mechanism could be wired to the OS clipboard (TSV/JSON) without touching the mutation logic.

---

## 10. Theme System

Theme is realized with CSS custom properties in `style.css`:

- `.wb-theme-light` / `.wb-theme-dark` define `--wb-*` variables (background, surface, text, border, accent, canvas background, shadows, radii).
- `Painter.vue` toggles the `wb-theme-{light|dark}` class on the root; all components consume `--wb-*` only: switching theme is a single class swap.
- On dark mode, the default foreground color is flipped from `#000000` to `#ffffff` so first strokes stay visible; switching back flips it again if the user has not overridden it.

---

## 11. Responsive Adaptation

`Whiteboard.vue` mounts a `ResizeObserver` on the parent container. On any size change (and on mount) it recenters the canvas inside its parent via `setPan((cw2 - cw) / 2, (ch2 - ch) / 2)`. The `width`/`height` props accept either a string (`'100%'`) or a number (pixels); the root element stretches accordingly, and the canvas centers within it.

---

## 12. Undo / Redo

Undo/redo is **snapshot-based**. `pushUndo()` deep-clones the entire `strokes` array (including `points`) onto `undoStack` and clears `redoStack`. Mutations call `pushUndo()` *before* applying the change (`addStroke`, `updateStroke`, `delete…`, `move…`, `paste…`, color/align changes). `undo()`/`redo()` swap the working array with the stacks. `dataVersion` is bumped after structural edits so the `v-model` watcher emits an update.

Text creation is special: an empty text stroke pushes an undo entry on creation; if the user cancels or leaves it empty, that entry is popped so no empty history is recorded.

---

## 13. Extension Points / Roadmap

### 13.1 Drawing Tools
- More shapes (arrow, free polygon, image embed).
- Pressure-sensitive pencil (variable width).

### 13.2 State & Files
- **Persistence**: export/import JSON, PNG, and standalone SVG (the serializable `PainterData` already makes this straightforward).
- **Multi-instance**: replace the module-level singleton store with a `provide`/`inject` scoped store so multiple `<Painter>` components can coexist.

### 13.3 Interaction
- Snap-to-grid / alignment guides.
- Group selection / grouping of strokes.
- Layer panel (currently only bring-to-front / send-to-back exist).
- Rotation handles.

### 13.4 Rendering
- Canvas 2D mode for very large drawings (the SVG/DOM approach is fine for typical use but can get heavy with thousands of nodes).
- Performance: per-stroke dirty updates instead of full reactive re-render.

---

## 14. Development Notes

1. **Manual coordinate transform.** All screen→canvas conversions use `wrapper.getBoundingClientRect()` + `zoomLevel` division, never `getScreenCTM()`, to stay consistent with iOS Safari behavior under CSS transforms.
2. **Module-level singleton store.** `canvas.ts`/`tools.ts` are shared module state. `Painter.vue` calls `.reset()` on setup to avoid cross-instance leakage; multi-instance support requires scoping the store per component.
3. **Integer coordinates.** Pencil points and bounding boxes are rounded at commit time to keep serialized data compact; smoothing (`Q` curves) is applied at render time.
4. **Dual-flag v-model.** `syncing` (store) + `suppressing` (component) prevents infinite update loops between parent and internal state.
5. **TypeScript strict.** All function parameters/returns are annotated; `vue-tsc` runs during `build`.
6. **Cross-platform input.** `onMouseDown/Move/Up` and `onTouchStart/Move/End` are unified through shared `handlePointer*` handlers; modifier keys use `e.ctrlKey || e.metaKey` for macOS compatibility.

---

## 15. Build & Outputs

- `npm run build` builds the library (ESM + UMD + CSS + types) via `vite.config.ts` (lib mode) into `dist/`.
- `npm run build:demo` builds the demo page (`index.html` + `App.vue`) via `vite.demo.config.ts` into `dist-demo/`, usable as a static site.
- Both `dist` and `dist-demo` are git-ignored and treated identically.

## 16. License

This project is licensed under the MIT License: see the [LICENSE](LICENSE) file for details.
