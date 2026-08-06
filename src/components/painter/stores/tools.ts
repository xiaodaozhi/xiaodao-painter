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
    // If switching away from text tool, cancel any active text edit
    if (activeTool.value === 'text' && tool !== 'text') {
      const canvasStore = useCanvasStore();
      if (canvasStore.editingTextId) {
        const stroke = canvasStore.strokes.find((s) => s.id === canvasStore.editingTextId);
        if (stroke && (!stroke.text || !stroke.text.trim())) {
          canvasStore.strokes = canvasStore.strokes.filter((s) => s.id !== canvasStore.editingTextId);
          if (canvasStore.undoStack.length > 0) {
            canvasStore.undoStack.pop();
          }
        }
        canvasStore.editingTextId = null;
      }
    }
    activeTool.value = tool;
  }

  function reset() {
    activeTool.value = 'select';
  }

  return { activeTool, setTool, reset };
});
