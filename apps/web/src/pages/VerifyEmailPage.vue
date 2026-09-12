<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { verifyEmail } from '@/api/auth';
import { getApiErrorMessage } from '@/api/http';

const route = useRoute();
const state = ref<'loading' | 'success' | 'error'>('loading');
const message = ref('正在验证邮箱…');
onMounted(async () => {
  try {
    const token = typeof route.query.token === 'string' ? route.query.token : '';
    message.value = await verifyEmail(token);
    state.value = 'success';
  } catch (error: unknown) {
    message.value = getApiErrorMessage(error);
    state.value = 'error';
  }
});
</script>

<template>
  <main class="result-page">
    <section>
      <span>{{ state === 'loading' ? '···' : state === 'success' ? '✓' : '!' }}</span>
      <h1>{{ message }}</h1>
      <RouterLink v-if="state !== 'loading'" to="/login">前往登录 →</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.result-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: #f8f6ef;
  text-align: center;
}
.result-page section {
  max-width: 34rem;
}
.result-page span {
  display: grid;
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1.5rem;
  place-items: center;
  border-radius: 50%;
  background: #173fbd;
  color: white;
  font-size: 1.6rem;
}
.result-page h1 {
  font-family: 'Songti SC', serif;
}
.result-page a {
  color: #173fbd;
}
</style>
