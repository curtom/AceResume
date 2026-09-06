<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getApiErrorMessage } from '@/api/http';
import { getHealth } from '@/api/health';
import type { HealthData } from '@aceresume/contracts';

const health = ref<HealthData | null>(null);
const errorMessage = ref<string | null>(null);
const isLoading = ref(true);

async function loadHealth(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    health.value = await getHealth();
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => void loadHealth());
</script>

<template>
  <main class="page-shell">
    <section class="status-card" aria-labelledby="page-title">
      <p class="eyebrow">AceResume</p>
      <h1 id="page-title">基础服务状态</h1>
      <p v-if="isLoading">正在检查本地服务…</p>
      <div v-else-if="errorMessage" role="alert">
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadHealth">重新检查</button>
      </div>
      <dl v-else-if="health">
        <template v-for="(status, name) in health" :key="name">
          <dt>{{ name }}</dt>
          <dd>{{ status }}</dd>
        </template>
      </dl>
      <p v-else>暂无状态数据。</p>
    </section>
  </main>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--app-canvas);
}

.status-card {
  width: min(100%, 36rem);
  padding: 2rem;
  border: 1px solid var(--line-color);
  border-radius: 1rem;
  background: var(--surface-color);
  box-shadow: 0 1rem 3rem rgb(14 35 53 / 8%);
}

.eyebrow {
  color: var(--accent-color);
  font-weight: 700;
}
h1 {
  margin: 0.25rem 0 1.5rem;
  color: var(--ink-color);
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}
dd {
  margin: 0;
  color: var(--accent-color);
  font-weight: 700;
}
button {
  padding: 0.5rem 0.8rem;
  border: 0;
  border-radius: 0.4rem;
  background: var(--ink-color);
  color: white;
}
</style>
