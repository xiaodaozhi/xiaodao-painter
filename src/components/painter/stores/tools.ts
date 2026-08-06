import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToolType } from '../types';
import { useCanvasStore } from './canvas';

export const useToolsStore = defineStore('tools', () => {
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

  return { activeTool, setTool, reset };
});
