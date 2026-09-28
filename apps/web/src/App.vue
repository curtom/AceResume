<script setup lang="ts">
import { watch } from 'vue';
import { RouterView } from 'vue-router';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();
const { globalError } = storeToRefs(uiStore);
watch(globalError, (value) => {
  if (!value) return;
  message.error(value);
  uiStore.setGlobalError(null);
});
</script>

<template>
  <RouterView />
</template>
