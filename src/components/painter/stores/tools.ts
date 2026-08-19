import { ref, reactive } from 'vue';
import type { ToolType } from '../types';
import { useCanvasStore } from './canvas';

const activeTool = ref<ToolType>('select');

function setTool(tool: ToolType) {
  if (activeTool.value === 'select' && tool !== 'select') {
    const canvasStore = useCanvasStore();
    if (canvasStore.selectedStrokeIds.size > 0) {
      canvasStore.clearSelection();
    }
  }
  activeTool.value = tool;
}

function reset() {
  activeTool.value = 'select';
}

const state = reactive({
  activeTool,
  setTool,
  reset,
});

export type ToolsStore = typeof state;

export function useToolsStore(): ToolsStore {
  return state;
}
