# 小刀画板工具 (Xiaodao Painter)

一个自包含、可嵌入的 Vue 3 SVG 画板 / 绘图组件：除 Vue 3 外零运行时依赖，可把功能完整的画布直接嵌入任意应用。支持自由铅笔、基础图形（直线 / 矩形 / 圆 / 三角形 / 五角星）、文本、选择与变换、平移缩放、撤销重做、内部剪贴板、图层顺序、颜色系统、明/暗主题，以及内置的中英文国际化：全部由单个 `v-model` 驱动。

![预览](./img/preview.png)

## 功能特性

- **9 种工具**：选择、平移、铅笔、直线、矩形、圆、三角形、五角星、文本（另含独立的缩放工具）。
- **选择与编辑**：单击选择、框选、拖动移动、8 个手柄缩放（Shift = 对称 / 中心扩展）、图层顺序（上移 / 下移）。
- **平移与缩放**：拖动平移画布；离散缩放档位（10%–1000%）以光标为锚点；触屏支持双指捏合缩放。
- **撤销 / 重做**：完整的笔画级撤销/重做栈。
- **内部剪贴板**：剪切、复制、粘贴（粘贴时偏移 +20px）。
- **颜色系统**：描边（前景）、填充（背景）、文本颜色三个色槽；可对选中图形逐个应用颜色，画布背景支持纯色或透明网格。
- **主题**：明/暗双主题，切换主题时自动调整默认前景色。
- **国际化**：内置中文（`zh-CN`）与英文（`en-US`）。
- **快捷键**：Delete、Esc、Ctrl/⌘+Z / Ctrl/⌘+Y / Ctrl/⌘+X / Ctrl/⌘+C / Ctrl/⌘+V。
- **修饰键**：Ctrl = 锁定 1:1 比例，Shift = 中心扩展 / 直线 45° 吸附。
- **双向绑定**：通过 `v-model` 读写整份绘图数据。

## 安装

```bash
npm install xiaodao-painter
# 或
pnpm add xiaodao-painter
yarn add xiaodao-painter
```

对等依赖：`vue@^3.0.0`。

## 使用

组件无需任何插件或全局配置，仅需 Vue 3。

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
  console.log('绘图数据变化：', val)
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

### 指定尺寸与暗色主题

```html
<Painter
  v-model="data"
  theme="dark"
  locale="en-US"
  :width="1200"
  :height="800"
/>
```

### 自定义画布背景

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

### 构建演示页

```bash
npm run build:demo   # 输出到 ./dist-demo（打开 dist-demo/index.html）
```

## Props（属性）

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `PainterData` | `{ strokes: [], canvasWidth: 800, canvasHeight: 600 }` | 双向绑定的绘图数据，支持 `canvasBackgroundColor`。 |
| `theme` | `'light' \| 'dark'` | `'light'` | 界面主题。 |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | 界面语言，传入其他值回退到 `zh-CN`。 |
| `width` | `string \| number` | `'100%'` | 组件宽度（CSS 值或 px 数值）。 |
| `height` | `string \| number` | `'100%'` | 组件高度（CSS 值或 px 数值）。 |

## 数据模型

整份绘图由一个可序列化的对象描述，便于持久化、撤销重做与协作。

```ts
interface PainterData {
  strokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  canvasBackgroundColor?: string   // 任意 CSS 颜色或 'transparent'
}

type ToolType =
  | 'select' | 'pan' | 'zoom'
  | 'pencil' | 'line' | 'circle' | 'rect' | 'triangle' | 'star'
  | 'text'

interface Point { x: number; y: number }

interface Stroke {
  id: string                       // crypto.randomUUID()
  type: ToolType
  x: number                        // 包围盒左上角（提交时归一化）
  y: number
  width: number                    // 包围盒宽（绘制中可能为负）
  height: number
  points: Point[]                  // 铅笔路径点；非铅笔图形为空
  strokeColor: string
  fillColor: string                // 铅笔与直线为 'transparent' / 'none'
  strokeWidth: number
  // 仅文本图形
  text?: string
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  textColor?: string
  textAutoWidth?: boolean
}
```

坐标统一保存在**画布（SVG 用户）坐标系**中，与缩放和平移无关。组件在提交时会把负宽高的图形归一化，保证存储的包围盒始终为正。

## 工具

| 工具 | 行为 |
| --- | --- |
| 选择 | 单击选择；在空白拖动框选；拖动已选图形移动；拖手柄缩放。 |
| 平移 | 拖动以移动画布视口。 |
| 缩放 | 单击放大；右键缩小；触屏双指捏合。 |
| 铅笔 | 自由绘制，存储为平滑二次贝塞尔曲线。 |
| 直线 | 直线段，支持 45° 吸附（Shift）。 |
| 矩形 / 圆 | 闭合图形，Shift = 中心扩展，Ctrl = 1:1。 |
| 三角形 / 五角星 | 闭合图形，修饰键同上。 |
| 文本 | 单击放置可编辑文本框；双击已有文本进行编辑。 |

## 快捷键

| 按键 | 动作 |
| --- | --- |
| `Delete` / `Backspace` | 删除选中图形 |
| `Escape` | 取消选择 / 取消文本编辑 |
| `Ctrl/⌘ + Z` | 撤销 |
| `Ctrl/⌘ + Y` 或 `Ctrl/⌘ + Shift + Z` | 重做 |
| `Ctrl/⌘ + X` | 剪切 |
| `Ctrl/⌘ + C` | 复制 |
| `Ctrl/⌘ + V` | 粘贴（偏移 +20px） |

绘制或缩放过程中，`Ctrl` 锁定 1:1，`Shift` 对闭合图形为中心扩展、对直线为 45° 吸附。

## 主题

组件通过 `theme` 属性提供两套主题，颜色由 `style.css` 中的 CSS 变量（`--wb-*`）驱动，自动适配明/暗。切换主题时若当前前景色为默认值，会自动在 `#000000` 与 `#ffffff` 之间翻转。

## 国际化

内置 `zh-CN` 与 `en-US` 文案。通过 `locale` 切换，未知取值回退到 `zh-CN`。字典位于 `src/components/painter/utils/i18n.ts`，可方便的扩展更多语言。

## 开发

```bash
npm run dev        # 启动 Vite 开发服务器（演示页）
npm run build      # 类型检查（vue-tsc）并构建库产物
npm run build:demo # 构建独立演示页到 ./dist-demo
npm run preview    # 预览库的生产构建
npm run lint:check # 运行 ESLint
npm run typecheck  # 仅类型检查
```

库构建产出 `dist/xiaodao-painter.es.js`、`dist/xiaodao-painter.umd.js`、`dist/xiaodao-painter.css` 与 `dist/types/`。

## 项目结构

```
src/
  index.ts                         # 公开入口：导出 Painter 与类型/常量
  App.vue                          # 演示根组件（设置页面标题、挂载组件）
  style.css                        # 全局主题 CSS 变量（明/暗）
  components/painter/
    Painter.vue                    # 公开组件：props、v-model 同步、主题/语言注入
    Whiteboard.vue                 # SVG 画布、指针/触摸处理、缩放 UI、文本编辑
    Toolbar.vue                    # 工具按钮、颜色指示、画布尺寸弹窗
    ColorPalette.vue               # 前景/填充/文本色槽的颜色选择器
    SelectionOverlay.vue           # 包围框 + 8 个缩放手柄（直线仅 2 个）
    StrokeRenderer.vue             # 把单个 Stroke 渲染为 SVG 元素
    composables/
      useDrawing.ts                # 交互引擎（绘制/选择/移动/缩放/平移/文本）
      useI18n.ts                   # locale、theme、根元素的 provide/inject
    stores/
      canvas.ts                    # 中心仓库：笔画、颜色、平移缩放、撤销、剪贴板
      tools.ts                     # 当前工具状态
    utils/
      geometry.ts                  # 命中测试、星/三角形顶点、包围盒
      svg.ts                       # Stroke → SVG 元素转换
      i18n.ts                      # zh-CN / en-US 字典 + t()
    types/index.ts                 # TypeScript 类型与默认常量
```

## 许可证

MIT
