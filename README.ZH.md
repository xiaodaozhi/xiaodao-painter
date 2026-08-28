# 小刀画板工具 (Xiaodao Painter)

**中文** | [English](./README.md) | [演示](https://painter.xdz.me)

[![Downloads](https://img.shields.io/npm/d18m/xiaodao-painter)](https://www.npmjs.com/package/xiaodao-painter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5+-42b883.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF.svg)](https://vitejs.dev/)

一个自包含、可嵌入的 Vue 3 绘图组件，以可序列化的 JSON 数据驱动、通过单个 `v-model` 读写：把功能完整的画布（自由铅笔、基础图形、文本、选择与变换、平移缩放、撤销重做、内部剪贴板、颜色系统、明/暗主题、内置中英文国际化）打包进单个组件。

![预览](./img/preview.png)

---

## 功能特性

### 绘制与编辑

- **9 种工具**：选择、平移、铅笔、直线、矩形、圆、三角形、五角星、文本（另含独立的缩放工具）。
- **选择与变换**：单击选择；空白拖动框选；拖动已选图形移动；8 个手柄缩放（Shift = 对称 / 中心扩展）；图层顺序（上移 / 下移）。
- **平移与缩放**：拖动平移画布；离散缩放档位（10%–1000%）以光标为锚点；触屏支持双指捏合缩放。
- **撤销 / 重做**：完整的笔画级撤销/重做栈。
- **内部剪贴板**：剪切、复制、粘贴（粘贴时偏移 +20px）。
- **颜色系统**：描边（前景）、填充（背景）、文本颜色三个色槽；可对选中图形逐个应用颜色，画布背景支持纯色或透明网格。
- **文本工具**：单击放置可编辑文本框；双击已有文本进行编辑。

### 交互

- **指针与触屏**：统一的 `useDrawing` 交互层同时处理鼠标与触摸路径，包括双指捏合缩放、拖动绘制/选择。
- **缩放手柄**：图形 8 个、直线 2 个端点，拖动时实时预览。
- **修饰键**：`Ctrl` = 锁定 1:1 比例（闭合图形）；`Shift` = 中心扩展 / 直线 45° 吸附。
- **快捷键**：Delete、Esc、Ctrl/⌘+Z / Ctrl/⌘+Y / Ctrl/⌘+X / Ctrl/⌘+C / Ctrl/� (V。
- **SVG 渲染**：每一条笔画都是真实的 SVG 元素（`<path>`、`<line>`、`<ellipse>`、`<rect>`、`<polygon>`、`foreignObject`），输出与分辨率无关、易于导出。

### 视觉与主题

- **明 / 暗主题**：由 CSS 变量（`--wb-*`）驱动，切换主题只是换一个 class。
- **国际化**：内置中文（`zh-CN`）与英文（`en-US`），工具栏文案与缩放指示均走 `t()` 字典。
- **双向绑定**：通过 `v-model` 读写整份绘图数据。

---

## 安装

```bash
# npm
npm install xiaodao-painter
# pnpm
pnpm add xiaodao-painter
# yarn
yarn add xiaodao-painter
```

### 对等依赖

- `vue` `^3.0.0`

需要引入一次样式文件：

```ts
import 'xiaodao-painter/style.css'
```

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/xiaodaozhi/xiaodao-painter.git
cd xiaodao-painter

# 安装依赖
npm install

# 启动开发服务器（演示页）
npm run dev
```

在浏览器打开 `http://localhost:5173` 查看演示应用。

要构建独立演示页，运行 `npm run build:demo` 并打开 `dist-demo/index.html`。

---

## 基础用法

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
  console.log('绘图数据变化：', val)
}, { deep: true })
</script>
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

---

## Props（属性）

| 属性 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` (v-model) | `PainterData` | `{ strokes: [], canvasWidth: 800, canvasHeight: 600 }` | 双向绑定的绘图数据，支持 `canvasBackgroundColor`。 |
| `theme` | `'light' \| 'dark'` | `'light'` | 界面主题。 |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | 界面语言，传入其他值回退到 `zh-CN`。 |
| `width` | `string \| number` | `'100%'` | 组件宽度（CSS 值或 px 数值）。 |
| `height` | `string \| number` | `'100%'` | 组件高度（CSS 值或 px 数值）。 |

---

## 数据模型

整份绘图由一个可序列化的 `PainterData` 对象描述，便于持久化、撤销重做与协作。

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

### 类型导出

```ts
import type {
  PainterData,        // 主数据接口
  Stroke,             // 单条笔画 / 图形 / 文本
  Point,              // { x: number; y: number }
  ToolType,           // 所有工具标识的联合类型
  CanvasConfig,       // 画布尺寸 / 背景配置
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

## 架构

```src/
├── index.ts                         # 公开入口：导出 Painter 与类型/常量
├── App.vue                          # 演示根组件（设置页面标题、挂载组件）
├── style.css                        # 全局主题 CSS 变量（明/暗）
└── components/painter/
    ├── Painter.vue                  # 公开组件：props、v-model 同步、主题/语言注入
    ├── Whiteboard.vue               # SVG 画布、指针/触摸处理、缩放 UI、文本编辑
    ├── Toolbar.vue                  # 工具按钮、颜色指示、画布尺寸弹窗
    ├── ColorPalette.vue             # 前景/填充/文本色槽的颜色选择器
    ├── SelectionOverlay.vue         # 包围框 + 8 个缩放手柄（直线仅 2 个）
    ├── StrokeRenderer.vue           # 把单个 Stroke 渲染为 SVG 元素
    ├── composables/
    │   ├── useDrawing.ts            # 交互引擎（绘制/选择/移动/缩放/平移/文本）
    │   └── useI18n.ts               # locale、theme、根元素的 provide/inject
    ├── stores/
    │   ├── canvas.ts                # 中心仓库：笔画、颜色、平移缩放、撤销、剪贴板
    │   └── tools.ts                 # 当前工具状态
    ├── utils/
    │   ├── geometry.ts              # 命中测试、星/三角形顶点、包围盒
    │   ├── svg.ts                   # Stroke → SVG 元素转换
    │   └── i18n.ts                  # zh-CN / en-US 字典 + t()
    └── types/index.ts               # TypeScript 类型与默认常量
```

### 设计原则

- **自包含**：单个 Vue 3 组件，除 Vue 外零运行时依赖，无需全局注册，无需 CSS 框架。
- **状态可序列化**：整份绘图是单个普通对象（`PainterData`），便于保存、加载与同步。
- **基于 SVG 渲染**：每条笔画都是真实 SVG 节点（`<path>`、`<line>`、`<ellipse>`、`<rect>`、`<polygon>`、`foreignObject`），输出与分辨率无关、易主题化、易导出。
- **可预测的双向绑定**：父组件拥有数据，组件回显并在变更时通过 `v-model` 上报；store 内的 `syncing` 标志与组件内的 `suppressing` 标志共同避免回环。
- **轻量交互**：手动处理指针与触摸事件并显式计算坐标变换（不使用 `getScreenCTM`），规避 CSS transform 下 iOS Safari 的不一致行为。
- **纯函数工具**：命中测试、SVG 转换、i18n 都放在 `utils/` 中作为无框架依赖的纯函数，易于复用与单测。
- **组合式 API**：业务逻辑抽离到 `composables/`（`useDrawing`、`useI18n`）与轻量 store 层（`canvas.ts`、`tools.ts`），保持单一职责。

> **单实例说明**：`canvas.ts` 与 `tools.ts` 是模块级响应式单例，同一页面多个 `<Painter>` 会共享状态。若要支持多实例，应将 store 改为基于 `provide`/`inject` 的组件级 store。

---

## 快捷键

| 按键 | 动作 |
|------|------|
| `Delete` / `Backspace` | 删除选中图形 |
| `Escape` | 取消选择 / 取消文本编辑 |
| `Ctrl/⌘ + Z` | 撤销 |
| `Ctrl/⌘ + Y` 或 `Ctrl/⌘ + Shift + Z` | 重做 |
| `Ctrl/⌘ + X` | 剪切 |
| `Ctrl/⌘ + C` | 复制 |
| `Ctrl/⌘ + V` | 粘贴（偏移 +20px） |

绘制或缩放过程中，`Ctrl` 锁定 1:1，`Shift` 对闭合图形为中心扩展、对直线为 45° 吸附。

---

## 主题与国际化

### 内置主题

通过 `theme` 属性提供两套主题，颜色由 `style.css` 中的 CSS 变量（`--wb-*`）驱动，自动适配明/暗。切换主题时若当前前景色为默认值，会自动在 `#000000` 与 `#ffffff` 之间翻转。

可在任意外层元素上覆盖 CSS 变量实现深度定制：

```html
<div style="--wb-bg: #1a1a2e; --wb-text: #e0e0e0;">
  <Painter v-model="data" theme="dark" />
</div>
```

### 国际化

内置 `zh-CN` 与 `en-US` 文案。通过 `locale` 切换，未知取值回退到 `zh-CN`。字典位于 `src/components/painter/utils/i18n.ts`，可方便扩展更多语言。

---

## 开发

```bash
npm run dev        # 启动 Vite 开发服务器（演示页）
npm run build      # 类型检查（vue-tsc）并构建库产物
npm run build:demo # 构建独立演示页到 ./dist-demo
npm run preview    # 预览库的生产构建
npm run lint:check # 运行 ESLint
npm run typecheck  # 仅类型检查
```

## 构建

库构建通过 `vite.config.ts`（lib 模式）。`npm run build` 产出：

| 文件 | 说明 |
|------|------|
| `dist/xiaodao-painter.es.js` | ES 模块（供打包工具使用） |
| `dist/xiaodao-painter.umd.js` | UMD 包（供直接 `<script>` 引入） |
| `dist/xiaodao-painter.css` | 提取的样式表 |
| `dist/types/` | TypeScript 类型声明 |

`npm run build:demo` 通过 `vite.demo.config.ts` 构建独立演示站点到 `dist-demo/`（按 `dist` 同等规则 git 忽略）。

---

## 路线图

### 近期

- [x] 铅笔、图形、文本绘制与选择变换
- [x] 平移缩放、撤销重做、内部剪贴板
- [x] 颜色系统、明/暗主题、国际化
- [ ] 导出 PNG / SVG / JSON
- [ ] 图形级对齐吸附与参考线

### 中期

- [ ] 多页面 / 多图层支持
- [ ] 图片嵌入
- [ ] 云端保存 / 加载集成

### 长期

- [ ] 协同编辑
- [ ] 自定义图形渲染插件系统

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 框架 | Vue 3（Composition API + `<script setup>`） | ^3.5 |
| 构建 | Vite | ^8.0 |
| 语言 | TypeScript（strict） | ~6.0 |
| 渲染 | SVG 2D（DOM） | - |
| 类型检查 | vue-tsc | ^3.3 |
| 包管理器 | npm / pnpm | - |
| CSS | Scoped CSS + CSS 自定义属性 | - |

---

## 许可证

本项目基于 MIT 许可证发布，详见 [LICENSE](LICENSE) 文件。
