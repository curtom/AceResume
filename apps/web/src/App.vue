<script setup lang="ts">
import { watch } from 'vue';
import { RouterView } from 'vue-router';
import { message } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const uiStore = useUiStore();
const { globalError } = storeToRefs(uiStore);
const locale = {
  ...zhCN,
  DatePicker: {
    ...zhCN.DatePicker,
    lang: {
      ...zhCN.DatePicker?.lang,
      shortMonths: Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
    },
  },
};
watch(globalError, (value) => {
  if (!value) return;
  message.error(value);
  uiStore.setGlobalError(null);
});
</script>

<template>
  <a-config-provider :locale="locale">
    <RouterView />
  </a-config-provider>
</template>
