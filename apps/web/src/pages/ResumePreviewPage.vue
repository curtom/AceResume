<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { RenderDiagnostics, ResumeDetail } from '@aceresume/contracts';
import { getApiErrorMessage } from '@/api/http';
import { getResume } from '@/api/resume';
import ResumePreview from '@/components/ResumePreview.vue';

const route = useRoute();
const router = useRouter();
const resume = ref<ResumeDetail | null>(null);
const diagnostics = ref<RenderDiagnostics | null>(null);
const errorMessage = ref<string | null>(null);
onMounted(async () => {
  try {
    resume.value = await getResume(String(route.params.id));
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error);
  }
});
</script>

<template>
  <main class="preview-page">
    <header>
      <button type="button" @click="router.push(`/resumes/${route.params.id}/edit`)">
        ← 返回编辑
      </button>
      <div>
        <strong>{{ resume?.name || '独立预览' }}</strong>
        <span v-if="diagnostics">{{ diagnostics.pageCount }} 页 · A4 · 字体已加载</span>
      </div>
      <span class="mode">PREVIEW ONLY</span>
    </header>
    <a-result v-if="errorMessage" status="error" title="无法打开预览" :sub-title="errorMessage" />
    <a-skeleton v-else-if="!resume" class="loading" active :paragraph="{ rows: 12 }" />
    <ResumePreview
      v-else
      class="full-preview"
      :document="resume.document"
      @diagnostics="diagnostics = $event"
    />
  </main>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  background: #dfe4eb;
}
.preview-page > header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  height: 4.2rem;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 1.5rem;
  border-bottom: 1px solid #d7dbe2;
  background: rgb(255 253 248 / 96%);
}
header button {
  justify-self: start;
  border: 0;
  background: none;
  color: #173fbd;
}
header div {
  display: grid;
  text-align: center;
}
header strong {
  font: 1rem var(--serif);
}
header div span,
.mode {
  color: #7d8490;
  font-size: 0.66rem;
  letter-spacing: 0.1em;
}
.mode {
  justify-self: end;
}
.full-preview {
  display: block;
  height: calc(100vh - 4.2rem);
}
.loading {
  padding: 4rem;
}
</style>
