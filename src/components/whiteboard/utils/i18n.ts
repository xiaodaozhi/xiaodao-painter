export type Locale = 'zh-CN' | 'en-US'

const zhCN: Record<string, string> = {
  'tool.select': '选择',
  'tool.pencil': '铅笔',
  'tool.line': '直线',
  'tool.circle': '圆形',
  'tool.rect': '矩形',
  'tool.triangle': '三角形',
  'tool.star': '五角星',
  'tool.pan': '移动画布',
  'tool.zoom': '缩放',
  'color.foreground': '前景色（描边）',
  'color.background': '背景色（填充）',
  'palette.stroke': '描边颜色',
  'palette.fill': '填充颜色',
  'palette.custom': '自定义颜色',
  'toolbar.undo': '撤销',
  'toolbar.redo': '重做',
  'toolbar.bringToFront': '上移图层',
  'toolbar.sendToBack': '下移图层',
  'toolbar.delete': '删除',
  'zoom.label': '缩放：{percent}%',
  'canvasSize.title': '画布设置',
  'canvasSize.width': '宽度',
  'canvasSize.height': '高度',
  'canvasSize.confirm': '确定',
  'canvasSize.cancel': '取消',
  'canvasSize.background': '背景',
  'canvasSize.transparent': '透明',
}

const enUS: Record<string, string> = {
  'tool.select': 'Select',
  'tool.pencil': 'Pencil',
  'tool.line': 'Line',
  'tool.circle': 'Circle',
  'tool.rect': 'Rectangle',
  'tool.triangle': 'Triangle',
  'tool.star': 'Star',
  'tool.pan': 'Pan Canvas',
  'tool.zoom': 'Zoom',
  'color.foreground': 'Stroke Color',
  'color.background': 'Fill Color',
  'palette.stroke': 'Stroke Color',
  'palette.fill': 'Fill Color',
  'palette.custom': 'Custom Color',
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.bringToFront': 'Bring to Front',
  'toolbar.sendToBack': 'Send to Back',
  'toolbar.delete': 'Delete',
  'zoom.label': 'Zoom: {percent}%',
  'canvasSize.title': 'Canvas Settings',
  'canvasSize.width': 'Width',
  'canvasSize.height': 'Height',
  'canvasSize.confirm': 'OK',
  'canvasSize.cancel': 'Cancel',
  'canvasSize.background': 'Background',
  'canvasSize.transparent': 'Transparent',
}

const locales: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export function t(locale: Locale, key: string): string {
  return locales[locale]?.[key] ?? key
}
