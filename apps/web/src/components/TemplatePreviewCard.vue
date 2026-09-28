<script setup lang="ts">
import { computed } from 'vue';
import type { TemplateSummary } from '@aceresume/contracts';
import type { ResumeDocument } from '@aceresume/resume-schema';
import { SAMPLE_RESUME_DOCUMENT } from '@aceresume/template-engine';
import ResumePreview from './ResumePreview.vue';

const props = withDefaults(defineProps<{ template: TemplateSummary; mode?: 'card' | 'dialog' }>(), {
  mode: 'card',
});
const document = computed<ResumeDocument>(() => ({
  ...globalThis.structuredClone(SAMPLE_RESUME_DOCUMENT),
  templateVersionId: props.template.versionId,
  theme: props.template.defaultTheme,
}));
</script>

<template>
  <div class="template-preview" :class="{ dialog: mode === 'dialog' }" aria-hidden="true">
    <ResumePreview
      :document="document"
      :template="template"
      :mode="mode === 'dialog' ? 'print' : 'screen'"
      :is-scroll-enabled="mode !== 'dialog'"
    />
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
.template-preview.dialog {
  height: calc(100vh - 14rem);
  min-height: 28rem;
  padding: 0.75rem;
  overflow: auto;
  pointer-events: auto;
}
.template-preview.dialog :deep(.resume-preview) {
  position: relative;
  top: auto;
  left: auto;
  display: block;
  width: 794px;
  height: 1123px;
  margin: 0 auto;
  transform: none;
  pointer-events: none;
}
</style>
