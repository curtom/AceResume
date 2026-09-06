<script setup lang="ts">
import { RouterView } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();
const { globalError } = storeToRefs(uiStore);
</script>

<template>
  <p v-if="globalError" class="global-error" role="alert">{{ globalError }}</p>
  <RouterView />
</template>

<style scoped>
.global-error {
  position: fixed;
  inset: 1rem 1rem auto;
  z-index: 1;
  color: #9d1c1c;
}
</style>
