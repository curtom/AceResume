import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', () => {
  const globalError = ref<string | null>(null);
  const setGlobalError = (message: string | null): void => {
    globalError.value = message;
  };
  return { globalError, setGlobalError };
});
