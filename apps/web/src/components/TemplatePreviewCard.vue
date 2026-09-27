<script setup lang="ts">
import { computed } from 'vue';
import type { TemplateSummary } from '@aceresume/contracts';
import type { ResumeDocument } from '@aceresume/resume-schema';
import { SAMPLE_RESUME_DOCUMENT } from '@aceresume/template-engine';
import ResumePreview from './ResumePreview.vue';

const props = defineProps<{ template: TemplateSummary }>();
const document = computed<ResumeDocument>(() => ({
  ...globalThis.structuredClone(SAMPLE_RESUME_DOCUMENT),
  templateVersionId: props.template.versionId,
  theme: props.template.defaultTheme,
}));
</script>

<template>
  <div class="template-preview" aria-hidden="true">
    <ResumePreview :document="document" />
  </div>
</template>

<style scoped>
.template-preview {
  position: relative;
  height: 24rem;
  overflow: hidden;
  border: 1px solid #d9dde5;
  background: #dfe4eb;
  pointer-events: none;
}
.template-preview :deep(.resume-preview) {
  position: absolute;
  top: 0;
  left: 50%;
  width: 794px;
  height: 1123px;
  min-height: 0;
  transform: translateX(-50%) scale(0.34);
  transform-origin: top center;
}
</style>
