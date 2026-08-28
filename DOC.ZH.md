# 小刀画板架构设计文档

**中文** | [English](./DOC.md)

一个基于 SVG 的 Vue 3 绘图组件。它在可平移、可缩放的画布上渲染自由铅笔笔迹、直线、形状（圆、矩形、三角形、星形）以及可编辑文本，支持颜色、填充、文本控制、撤销重做与剪贴板。整份绘图可序列化成一个普通对象，便于保存、加载与外部集成。

---

## 1. 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | Vue 3（Composition API + `<script setup>`） | ^3.5 |
| 构建 | Vite | ^8.2 |
| 语言 | TypeScript（strict） | ~6.0 |
| 渲染 | SVG / DOM（非 Canvas 2D / 非 WebGL） | - |
| 类型检查 | vue-tsc | ^3.3 |
| 包管理器 | npm / pnpm | - |

---

## 2. 文件结构

```
xiaodao-painter/
├── index.html                          # 演示页入口 HTML（挂载 App.vue）
├── package.json
├── tsconfig.json                       # strict 模式
├── tsconfig.app.json                  # 应用构建配置
├── tsconfig.node.json
├── vite.config.ts                     # 库构建（lib 模式）
├── vite.demo.config.ts                # 演示站构建（app 模式，输出 dist-demo/）
└── src/
    ├── main.ts                         # createApp(App).mount('#app')
    ├── App.vue                         # 演示应用（挂载 <Painter>）
    ├── index.ts                        # 库入口：导出组件 + 类型
    └── components/
        └── painter/
            ├── Painter.vue             # 公共组件：props、v-model、provide、reset
            ├── Whiteboard.vue          # SVG 画布、指针/触摸接线、缩放 UI、文本编辑
            ├── Toolbar.vue             # 工具按钮、颜色槽、画布尺寸对话框
            ├── ColorPalette.vue        # 前景 / 填充 / 文本颜色选择器
            ├── StrokeRenderer.vue      # 单条笔画 → SVG 元素（经 strokeToSvg）
            ├── SelectionOverlay.vue    # 选择框 + 缩放手柄（8 / 6 / 2 端点）
            ├── style.css               # 主题 CSS 变量（.wb-theme-light / .wb-theme-dark）
            ├── types/
            │   └── index.ts            # 全部类型定义 + 导出常量
            ├── stores/
            │   ├── canvas.ts           # 响应式单例 store：笔画、颜色、平移缩放、撤销重做、剪贴板
            │   └── tools.ts            # 响应式单例 store：activeTool + setTool()
            ├── composables/
            │   ├── useDrawing.ts       # 指针/触摸引擎：绘制 / 选择 / 缩放 / 平移 / 文本
            │   └── useI18n.ts          # provideLocale / provideRootEl + useI18n()
            └── utils/
                ├── svg.ts              # strokeToSvg()、pencilToPathD()、SvgAttrs
                ├── geometry.ts         # 命中测试、顶点、包围盒
                └── i18n.ts             # zh-CN / en-US 字典 + t()
```

**依赖方向**：`App.vue → Painter.vue → stores/* + composables/* + components/*`；`useDrawing.ts → canvas.store + tools.store + utils/geometry`；`StrokeRenderer.vue → utils/svg`；`Toolbar.vue → canvas.store + tools.store + utils/i18n`。所有 UI 模块共享两个模块级单例 store（`canvas.ts`、`tools.ts`）。

---

## 3. 类型系统

全部类型定义位于 `components/painter/types/index.ts`（经 `src/index.ts` 重新导出）。

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
  type: ToolType;                              // 形状种类（text 使用 foreignObject）
  x: number;                                   // 包围盒原点（画布坐标，整数）
  y: number;
  width: number;                               // 包围盒尺寸（整数；line/标注可为负）
  height: number;
  points: Point[];                             // 铅笔路径点；非铅笔类型为空
  strokeColor: string;                         // 描边颜色（text 为 'transparent'）
  fillColor: string;                           // 'none' / 'transparent' / 颜色
  strokeWidth: number;
  text?: string;                               // text 笔画才有
  fontSize?: number;                           // 默认 16
  textAlign?: 'left' | 'center' | 'right';    // 默认 'left'
  textColor?: string;                          // 默认等于 strokeColor
  textAutoWidth?: boolean;                     // true = 宽度跟随文本内容
}

export interface CanvasConfig {
  width: number;
  height: number;
}

export interface PainterData {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBackgroundColor?: string;               // 'transparent' 或颜色
}

// 导出的常量
export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const STROKE_WIDTH = 3;
export const DEFAULT_FONT_SIZE = 16;
export const HIT_THRESHOLD = 8;
```

`PainterData` 是 `v-model` 使用的唯一可序列化契约。内部 store（`canvas.ts`）将 `strokes` 保存为 `ref<Stroke[]>`，且从不保存任何无法被 JSON 序列化的内容。

---

## 4. 状态管理

状态保存在两个用 `reactive()` 创建的模块级响应式单例中：

| Store | 职责 |
| --- | --- |
| `canvas.ts` | `strokes[]`、`selectedStrokeIds`（`Set`）、前景/背景/文本颜色、当前颜色槽、描边宽度、画布尺寸、平移缩放、撤销重做栈、内部剪贴板、文本编辑态、主题、`dataVersion`。 |
| `tools.ts` | `activeTool` 与 `setTool()`（离开 `select` 时清空选择）。 |

`canvas.ts` 暴露一个 `state` 对象，`useCanvasStore()` 直接返回它：

```ts
export function useCanvasStore(): CanvasStore {
  return state;
}
```

**限制与含义：** 因为 store 是模块作用域的，应用中所有 `useCanvasStore()` 调用返回的都是同一个对象。当前设计假设页面上只有一个激活的 `<Painter>`（`.reset()` 在 `Painter.vue` 的 setup 中被调用以保证干净初始状态）。在同一页面渲染两个 `<Painter>` 会共享状态。若要支持多实例，应把 store 提升为按组件作用域的 `provide`/`inject` store。

### 4.1 核心状态

| 状态 | 类型 | 说明 |
| --- | --- | --- |
| `strokes` | `ref<Stroke[]>` | 画布上的全部笔画 |
| `selectedStrokeIds` | `ref<Set<string>>` | 当前选中的笔画 id 集合 |
| `foregroundColor` / `backgroundColor` / `textColor` | `ref<string>` | 下一条笔画 / 颜色槽的当前颜色 |
| `activeColorSlot` | `ref<'foreground' | 'background' | 'textColor'>` | 调色板正在编辑的颜色槽 |
| `strokeWidth` | `ref<number>` | 形状 / 铅笔的轮廓宽度 |
| `canvasBackgroundColor` | `ref<string>` | `'transparent'` 或某个绘制颜色 |
| `canvasWidth` / `canvasHeight` | `ref<number>` | 逻辑画布尺寸（SVG viewBox） |
| `panX` / `panY` | `ref<number>` | 以屏幕像素计的平移偏移 |
| `zoomLevel` | `ref<number>` | 缩放系数；被钳制到 `ZOOM_STEPS` |
| `editingTextId` / `hoveredTextId` | `ref<string \| null>` | 文本编辑 / 悬停状态 |
| `isSelecting` / `selectionBox` | `ref` | 框选矩形 |
| `undoStack` / `redoStack` | `ref<Stroke[][]>` | 快照栈（快照为深拷贝） |
| `theme` | `ref<'light' | 'dark'>` | 主题模式 |
| `dataVersion` | `ref<number>` | 在结构性编辑后自增，触发 `v-model` 上报 |

派生（computed）选择器：`selectedStrokes`、`selectedStroke`、`selectedStrokeId`、`selectedStrokeColor`、`selectedFillColor`、`selectedTextColor`、`canUndo`、`canRedo`，以及 `viewBox`（`0 0 canvasWidth canvasHeight`）和 `canvasTransform`（`translate(...) scale(...)`）。

`ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10]` 是固定的缩放档位阶梯；`zoomAt()` 以光标为锚点吸附到下一档，`continuousZoomAt()` 支持捏合手势连续缩放。

### 4.2 v-model 同步协议

`Painter.vue` 用双重标志设计在父级的 `modelValue: PainterData` 与内部 store 之间架桥：

- **父 → store：** 对 `modelValue.strokes` 的深度监听调用 `canvasStore.syncFromParent()`（由 `syncing` 标志保护）。画布宽高与背景在变化时推入。
- **store → 父：** 对 `strokes.length | canvasWidth | canvasHeight | canvasBackgroundColor | dataVersion` 的监听触发 `emit('update:modelValue', …)` 并克隆快照。组件内的 `suppressing` 标志阻止回写值重新进入 `syncFromParent`。

`store 内的 syncing` + `组件内的 suppressing` 这套组合，正是双向绑定保持稳定、不陷入无限监听的关键。

---

## 5. 布局常量与坐标系

常量（来自 `types/index.ts`）：

```
DEFAULT_CANVAS_WIDTH  = 800
DEFAULT_CANVAS_HEIGHT = 600
STROKE_WIDTH          = 3
DEFAULT_FONT_SIZE     = 16
HIT_THRESHOLD         = 8   （命中测试的容差，单位为画布单位）
```

画布是一个 **固定** `viewBox`（`0 0 canvasWidth canvasHeight`）的 SVG。平移和缩放通过对包裹层施加一次 CSS 变换实现：

```
transform: translate(panX px, panY px) scale(zoomLevel)
```

屏幕 → 画布的转换是手动计算的（不使用 `getScreenCTM`）：

```ts
canvasX = (clientX - wrapperRect.left) / zoomLevel
canvasY = (clientY - wrapperRect.top)  / zoomLevel
```

这是有意为之：`getScreenCTM()` 在 iOS Safari 上、当祖先元素使用带 `will-change` 的 CSS transform 时不可靠，因此手动计算可在各浏览器间保持一致行为。

---

## 6. 渲染管线

每条 `Stroke` 由 `StrokeRenderer.vue` 渲染，其内部调用 `utils/svg.ts` 的 `strokeToSvg(stroke)`：

| `type` | SVG 元素 | 说明 |
| --- | --- | --- |
| `pencil` | `<path>` | 由 `points` 生成平滑的二次贝塞尔；`fill:none`。 |
| `line` | `<line>` | 从 `(x,y)` 到 `(x+width, y+height)`。 |
| `circle` | `<ellipse>` | 以包围盒居中。 |
| `rect` | `<rect>` | 归一化为正宽高。 |
| `triangle` | `<polygon>` | 顶点来自 `triangleVertices()`。 |
| `star` | `<polygon>` | 5 角星，来自 `starVertices()`（内缩比 0.382）。 |
| `text` | `foreignObject` | 改为在 `Whiteboard.vue` 中作为可编辑 `<div>` 渲染。 |

文本笔画是特例：它发出一个包裹 `contenteditable` `<div>` 的 `<foreignObject>`，用户可直接输入。`SelectionOverlay.vue` 负责绘制虚线包围框与缩放手柄：闭合图形 8 个、文本 6 个（无上下手柄）、直线 2 个端点。

渲染是声明式的（由 Vue 驱动），而非手动绘制循环。网格背景、画布边框、笔画图层、预览笔画、选择覆盖层与悬停轮廓，都是绑定到 store 状态的 SVG 节点。缩放与平移直接来自包裹层变换，因此不需要逐帧重绘逻辑。

---

## 7. 笔画几何与 SVG 转换

`utils/geometry.ts` 与 `utils/svg.ts` 中的纯函数，不依赖 Vue：

- `pencilToPathD(points)`：由原始铅笔点构建二次贝塞尔的 `d` 字符串（通过中点做平滑）。
- `triangleVertices(x, y, w, h)` / `starVertices(cx, cy, rx, ry, flipY)`：计算多边形顶点数组。
- `pointToSegmentDistance()`、`pointInPolygon()`、`pointInEllipse()`、`computeBoundingBox()`：供 `hitTestStroke` 使用。
- `hitTestStroke(p, stroke)`：返回某个画布点是否命中一条笔画；对铅笔/直线使用点到线段距离，对填充图元使用点在形状内测试。就近边缘命中遵循 `HIT_THRESHOLD`。

`strokeToSvg(stroke)` 把每条 `Stroke` 映射为 `{ tag, attrs }`（一个 SVG 元素 + 属性表），共享 `stroke`、`stroke-width`、`stroke-linecap: round`、`stroke-linejoin: round`。铅笔强制 `fill:none`；形状使用 `fillColor`；文本返回空的 `<g>`（单独渲染）。这些函数零 Vue 依赖，易于单元测试。

---

## 8. 交互模型

### 8.1 鼠标

| 操作 | 行为 |
| --- | --- |
| 点击（选择） | 选中光标下的单条笔画 |
| 拖动（选择） | 框选；`dist < 3` → 单击选择 / 清空 |
| 拖动（形状工具） | 生成实时预览笔画；抬起时提交 |
| 拖动手柄 | 缩放选中的笔画（8 / 6 / 2 手柄） |
| 平移工具 | 拖动以移动画布 |
| 缩放工具（左键） | 放大；右键缩小 |
| 键盘 Ctrl+滚轮 / 缩放工具捏合 | 以光标为锚点缩放 |

### 8.2 触摸

- 单指拖动按当前激活工具绘制 / 选择 / 平移。
- 双指捏合（仅在缩放工具激活时）经 `continuousZoomAt()` 连续缩放。
- 双击/双触（非文本工具时）进入已有文本笔画的文本编辑。

### 8.3 键盘（全局）

| 按键 | 动作 |
| --- | --- |
| `Delete` / `Backspace` | 删除选中的笔画 |
| `Escape` | 清空选择（同时也取消文本编辑） |
| `Ctrl/Cmd+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | 剪切 / 复制 / 粘贴笔画 |

拖动期间的修饰键：**Ctrl** 将闭合图形约束为 1:1；**Shift** 以起点为中心绘制图形，并（对直线）将角度吸附到 45° 增量。

### 8.4 文本编辑

- 文本笔画在指针抬起时创建（从指针按下延后）。
- 编辑使用行内 `contenteditable` `<div>`；在 `Enter`（单行）或失焦时提交，在 `Escape` 时取消。
- 提交时若文本为空，则移除该笔画并弹出其创建时压入的撤销记录（不留空历史）。
- 当选中单条文本笔画时，浮动工具条提供字号 +/- 与左/中/右对齐。

---

## 9. 剪贴板协议

剪贴板是内部（store 内）的，而非操作系统剪贴板：

- **复制**：把选中的笔画（深拷贝 `points`）快照进 `clipboard`。
- **剪切**：先复制，再删除选择。
- **粘贴**：用新 `id` 深拷贝每条剪贴板笔画，把所有坐标偏移 `+20,+20`，清空旧选择，并选中粘贴后的集合。

因为剪贴板是模型级 JSON，同一套机制可以接到操作系统剪贴板（TSV/JSON）而不必改动变更逻辑。

---

## 10. 主题系统

主题通过 `style.css` 中的 CSS 自定义属性实现：

- `.wb-theme-light` / `.wb-theme-dark` 定义 `--wb-*` 变量（背景、表面、文本、边框、强调色、画布背景、阴影、圆角）。
- `Painter.vue` 在根节点切换 `wb-theme-{light|dark}` 类；所有组件只消费 `--wb-*`，因此切换主题只是换一个 class。
- 暗色模式下，默认前景色从 `#000000` 翻转为 `#ffffff`，使首笔画仍可见；切回时若用户未覆盖该颜色，会再次翻转回来。

---

## 11. 响应式适配

`Whiteboard.vue` 在父容器上挂载 `ResizeObserver`。任何尺寸变化（以及挂载时）都会通过 `setPan((cw2 - cw) / 2, (ch2 - ch) / 2)` 把画布重新居中到父容器内部。`width`/`height` props 既可接受字符串（`'100%'`）也可接受数字（像素）；根元素相应伸缩，画布在其中居中。

---

## 12. 撤销 / 重做

撤销重做是 **快照式** 的。`pushUndo()` 把整个 `strokes` 数组（含 `points`）深拷贝压入 `undoStack`，并清空 `redoStack`。变更在应用之前调用 `pushUndo()`（`addStroke`、`updateStroke`、`delete…`、`move…`、`paste…`、颜色/对齐变更）。`undo()` / `redo()` 在栈与工作数组之间交换。`dataVersion` 在结构性编辑后自增，以便 `v-model` 监听上报更新。

文本创建是特例：一条空文本笔画在创建时会压入撤销记录；若用户取消或最终为空，则将该记录弹出，避免记录空历史。

---

## 13. 扩展点 / 路线图

### 13.1 绘图工具
- 更多形状（箭头、自由多边形、图片嵌入）。
- 压感铅笔（可变宽度）。

### 13.2 状态与文件
- **持久化**：导出/导入 JSON、PNG 与独立 SVG（可序列化的 `PainterData` 已让这件事很直接）。
- **多实例**：用按组件作用域的 `provide`/`inject` store 替换模块级单例 store，使多个 `<Painter>` 组件可以共存。

### 13.3 交互
- 吸附网格 / 对齐参考线。
- 成组选择 / 笔画分组。
- 图层面板（当前仅有置顶 / 置底）。
- 旋转手柄。

### 13.4 渲染
- 针对极大绘图量的 Canvas 2D 模式（SVG/DOM 方案在常规使用时没问题，但节点上千后会变重）。
- 性能：按笔画的局部更新，而非整树响应式重渲染。

---

## 14. 开发笔记

1. **手动坐标变换。** 所有屏幕 → 画布转换都使用 `wrapper.getBoundingClientRect()` + 除以 `zoomLevel`，绝不用 `getScreenCTM()`，以在 iOS Safari 的 CSS transform 下保持一致行为。
2. **模块级单例 store。** `canvas.ts` / `tools.ts` 是共享的模块状态。`Painter.vue` 在 setup 时调用 `.reset()` 以避免跨实例泄漏；多实例支持需要把 store 按组件作用域化。
3. **整数坐标。** 铅笔点与包围盒在提交时取整，使序列化数据紧凑；平滑（`Q` 曲线）在渲染时应用。
4. **双重标志 v-model。** store 内的 `syncing` + 组件内的 `suppressing` 防止父级与内部状态之间的无限更新循环。
5. **TypeScript strict。** 所有函数参数/返回值都有类型标注；`vue-tsc` 在 `build` 期间运行。
6. **跨平台输入。** `onMouseDown/Move/Up` 与 `onTouchStart/Move/End` 通过共享的 `handlePointer*` 处理器统一；修饰键使用 `e.ctrlKey || e.metaKey` 以兼容 macOS。

---

## 15. 构建与产物

- `npm run build` 经由 `vite.config.ts`（lib 模式）把库（ESM + UMD + CSS + 类型）构建到 `dist/`。
- `npm run build:demo` 经由 `vite.demo.config.ts` 以 `index.html` + `App.vue` 把演示页构建到 `dist-demo/`，可作为静态站点使用。
- `dist` 与 `dist-demo` 都被 git 忽略，且按同等规则对待。

## 16. 许可证

本项目基于 MIT 许可证发布：详见 [LICENSE](LICENSE) 文件。
