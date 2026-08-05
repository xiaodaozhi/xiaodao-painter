import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToolType } from '../types';

export const useToolsStore = defineStore('tools', () => {
  const activeTool = ref<ToolType>('select');

  function setTool(tool: ToolType) {
    activeTool.value = tool;
  }

  function reset() {
    activeTool.value = 'select';
  }

  return { activeTool, setTool, reset };
});
