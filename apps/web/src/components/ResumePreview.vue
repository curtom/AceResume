<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import type { ResumeDocument } from '@aceresume/resume-schema';
import { renderResume } from '@aceresume/template-engine';
import fontUrl from '@aceresume/template-engine/assets/NotoSansSC-Variable.ttf?url';
import type { RenderDiagnostics } from '@aceresume/contracts';

const props = defineProps<{ document: ResumeDocument }>();
const emit = defineEmits<{ diagnostics: [value: RenderDiagnostics] }>();
const instanceId = globalThis.crypto.randomUUID();
const html = computed(() =>
  renderResume({
    resume: props.document,
    mode: 'screen',
    fontUrl,
    instanceId,
  }),
);
function receiveDiagnostics(event: globalThis.MessageEvent<unknown>): void {
  if (
    typeof event.data === 'object' &&
    event.data !== null &&
    'type' in event.data &&
    event.data.type === 'ace-resume-render' &&
    'instanceId' in event.data &&
    event.data.instanceId === instanceId &&
    'diagnostics' in event.data
  )
    emit('diagnostics', event.data.diagnostics as RenderDiagnostics);
}
onMounted(() => globalThis.addEventListener('message', receiveDiagnostics));
onBeforeUnmount(() => globalThis.removeEventListener('message', receiveDiagnostics));
</script>

<template>
  <iframe class="resume-preview" title="简历实时预览" sandbox="allow-scripts" :srcdoc="html" />
</template>

<style scoped>
.resume-preview {
  width: 100%;
  height: 100%;
  min-height: 48rem;
  border: 0;
  background: #e8ebf0;
}
</style>
