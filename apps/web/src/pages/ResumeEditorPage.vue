<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { ResumeThemeSchema, type ResumeSection, type ResumeTheme } from '@aceresume/resume-schema';
import type {
  AiContentType,
  AiTask,
  DocumentSummary,
  ExportJob,
  ProfileEntry,
  ProfileEntryType,
  RenderDiagnostics,
  ResumeSuggestion,
  TemplateSummary,
} from '@aceresume/contracts';
import * as aiApi from '@/api/ai';
import * as documentApi from '@/api/document';
import * as exportApi from '@/api/export';
import { getApiErrorMessage } from '@/api/http';
import * as profileApi from '@/api/profile';
import { listTemplates } from '@/api/template';
import ResumePreview from '@/components/ResumePreview.vue';
import ResumeSectionEditor from '@/components/ResumeSectionEditor.vue';
import { useResumeEditorStore } from '@/stores/resume-editor';

const route = useRoute();
const router = useRouter();
const store = useResumeEditorStore();
const refs = storeToRefs(store);
const {
  detail,
  document,
  selectedSection,
  saveStatus,
  isLoading,
  errorMessage,
  pendingDraft,
  conflictServer,
} = refs;
const isThemeOpen = ref(false);
const isTemplateOpen = ref(false);
const isExportOpen = ref(false);
const isAiOpen = ref(false);
const isLoadingAiSources = ref(false);
const isGeneratingAi = ref(false);
const aiError = ref<string | null>(null);
const aiTask = ref<AiTask | null>(null);
const aiDocuments = ref<DocumentSummary[]>([]);
const aiProfileEntries = ref<ProfileEntry[]>([]);
const selectedDocumentIds = ref<string[]>([]);
const selectedProfileEntryIds = ref<string[]>([]);
const aiInstruction = ref('突出与目标岗位相关的职责、行动和结果，表达专业简洁。');
const aiJobDescription = ref('');
const aiConsent = ref(false);
const aiContentType = ref<AiContentType>('project');
const editedSuggestions = ref<Record<string, string>>({});
const isCreatingExport = ref(false);
const isAvatarBusy = ref(false);
const isFormCollapsed = ref(false);
const templates = ref<TemplateSummary[]>([]);
const diagnostics = ref<RenderDiagnostics | null>(null);
const exportJob = ref<ExportJob | null>(null);
const exportError = ref<string | null>(null);
const draggedIndex = ref<number | null>(null);
const editingSectionId = ref<string | null>(null);
const editingSectionTitle = ref('');
let exportPollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let aiPollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
watch(aiError, (value) => {
  if (!value) return;
  message.error(value);
  aiError.value = null;
});
watch(exportError, (value) => {
  if (!value) return;
  message.error(value);
  exportError.value = null;
});
const profileTypeLabel: Record<ProfileEntryType, string> = {
  education: '教育经历',
  project: '项目经历',
  experience: '实习 / 工作',
  skill: '技能',
};
const aiContentTypeLabel: Record<AiContentType, string> = {
  project: '项目经历',
  experience: '工作 / 实习经历',
  campus: '校园经历',
};
const visibleAiProfileEntries = computed(() =>
  aiProfileEntries.value.filter((entry) => entry.type === aiContentType.value),
);
const canUseAi = computed(() => {
  const section = selectedSection.value;
  if (!section || !['project', 'experience', 'campus'].includes(section.type)) return false;
  if ('entries' in section.content) return section.content.entries.length > 0;
  return false;
});
const saveLabel = computed(
  () =>
    ({
      idle: '等待编辑',
      dirty: '等待保存',
      saving: '保存中…',
      saved: '已自动保存',
      failed: '保存失败',
      conflict: '发现编辑冲突',
    })[saveStatus.value],
);
const currentTemplate = computed(
  () =>
    detail.value?.template ??
    templates.value.find((item) => item.versionId === document.value?.templateVersionId),
);
const targetSection = computed(() =>
  document.value?.sections.find((section) => section.type === 'target'),
);
const hasBlockingPreviewRisk = computed(
  () =>
    Boolean(diagnostics.value) &&
    (!diagnostics.value!.fontReady ||
      diagnostics.value!.overflowCount > 0 ||
      diagnostics.value!.blankPageCount > 0 ||
      diagnostics.value!.invalidLinkCount > 0 ||
      diagnostics.value!.exceedsMaximumPages),
);
function updateTheme(field: keyof ResumeTheme, value: unknown): void {
  if (!document.value) return;
  const next: ResumeTheme = JSON.parse(JSON.stringify(document.value.theme));
  Reflect.set(next, field, value);
  const parsed = ResumeThemeSchema.safeParse(next);
  if (parsed.success) store.updateTheme(parsed.data);
}
function updateMargin(field: keyof ResumeTheme['pageMargin'], value: number): void {
  if (document.value)
    updateTheme('pageMargin', { ...document.value.theme.pageMargin, [field]: value });
}
function dropSection(to: number): void {
  if (draggedIndex.value !== null) store.reorderSections(draggedIndex.value, to);
  draggedIndex.value = null;
}
function selectSection(id: string): void {
  store.selectedSectionId = id;
  isFormCollapsed.value = false;
}
function canMoveSection(sectionId: string, direction: -1 | 1): boolean {
  const sections = document.value?.sections.filter((section) => section.type !== 'target') ?? [];
  const index = sections.findIndex((section) => section.id === sectionId);
  return index >= 0 && index + direction >= 0 && index + direction < sections.length;
}
function toggleSection(section: ResumeSection): void {
  store.updateSection({ ...section, isVisible: !section.isVisible });
}
function startRename(section: ResumeSection): void {
  editingSectionId.value = section.id;
  editingSectionTitle.value = section.title;
}
function finishRename(section: ResumeSection): void {
  if (editingSectionId.value !== section.id) return;
  const title = editingSectionTitle.value.trim();
  if (title && title !== section.title) store.updateSection({ ...section, title });
  editingSectionId.value = null;
}
function cancelRename(): void {
  editingSectionId.value = null;
}
function blurRenameInput(event: globalThis.KeyboardEvent): void {
  (event.currentTarget as globalThis.HTMLInputElement).blur();
}
function updateTarget(value: string): void {
  const section = targetSection.value;
  if (section?.type === 'target')
    store.updateSection({ ...section, content: { role: value.trim() || null } });
}
async function uploadAvatar(file: globalThis.File): Promise<void> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    message.error('头像仅支持 JPG、PNG 或 WebP 图片。');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    message.error('头像不能超过 2 MB。');
    return;
  }
  isAvatarBusy.value = true;
  try {
    await store.uploadAvatar(file);
    message.success('头像已更新。');
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isAvatarBusy.value = false;
  }
}
async function removeAvatar(): Promise<void> {
  isAvatarBusy.value = true;
  try {
    await store.removeAvatar();
    message.success('头像已移除。');
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isAvatarBusy.value = false;
  }
}
function retryOnline(): void {
  if (store.saveStatus === 'failed') void store.saveNow();
}
function changeTemplate(versionId: string): void {
  store.changeTemplate(versionId);
  isTemplateOpen.value = false;
}
function openExport(): void {
  exportJob.value = null;
  exportError.value = null;
  isExportOpen.value = true;
}
async function pollExport(id: string, attempt = 0): Promise<void> {
  try {
    exportJob.value = await exportApi.getExport(id);
    if (exportJob.value.status === 'completed') {
      await exportApi.downloadExport(exportJob.value);
      return;
    }
    if (exportJob.value.status === 'failed') {
      exportError.value = exportJob.value.errorMessage ?? 'PDF 导出失败，请重试。';
      return;
    }
    if (attempt >= 120) {
      exportError.value = '导出仍在后台处理中，可以稍后重新打开并查询。';
      return;
    }
    exportPollTimer = globalThis.setTimeout(() => void pollExport(id, attempt + 1), 1_000);
  } catch (error: unknown) {
    exportError.value = getApiErrorMessage(error);
  }
}
async function startExport(): Promise<void> {
  if (!detail.value || hasBlockingPreviewRisk.value) return;
  isCreatingExport.value = true;
  exportError.value = null;
  try {
    if (store.isDirty) await store.saveNow();
    if (!store.detail || store.saveStatus !== 'saved') {
      exportError.value = '请先解决保存失败或版本冲突，再导出 PDF。';
      return;
    }
    exportJob.value = await exportApi.createExport(store.detail.id, {
      resumeVersion: store.detail.version,
      idempotencyKey: globalThis.crypto.randomUUID(),
    });
    await pollExport(exportJob.value.id);
  } catch (error: unknown) {
    exportError.value = getApiErrorMessage(error);
  } finally {
    isCreatingExport.value = false;
  }
}
function toggleSource(ids: string[], id: string, checked: boolean): string[] {
  return checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id);
}
async function openAi(): Promise<void> {
  if (!canUseAi.value) return;
  aiContentType.value = selectedSection.value!.type as AiContentType;
  selectedProfileEntryIds.value = [];
  aiError.value = null;
  aiTask.value = null;
  editedSuggestions.value = {};
  isAiOpen.value = true;
  isLoadingAiSources.value = true;
  try {
    const profileTypes: ProfileEntryType[] = ['project', 'experience'];
    const [documentsPage, ...entryPages] = await Promise.all([
      documentApi.listDocuments(),
      ...profileTypes.map((type) => profileApi.listEntries(type)),
    ]);
    aiDocuments.value = documentsPage.items.filter((item) => item.status === 'ready');
    aiProfileEntries.value = entryPages.flatMap((page) => page.items);
  } catch (error: unknown) {
    aiError.value = getApiErrorMessage(error);
  } finally {
    isLoadingAiSources.value = false;
  }
}
function changeAiContentType(value: unknown): void {
  if (value !== 'project' && value !== 'experience' && value !== 'campus') return;
  aiContentType.value = value;
  selectedProfileEntryIds.value = [];
  aiTask.value = null;
  editedSuggestions.value = {};
}
async function pollAiTask(id: string, attempt = 0): Promise<void> {
  try {
    aiTask.value = await aiApi.getTask(id);
    if (aiTask.value.status === 'awaiting_confirmation') {
      editedSuggestions.value = Object.fromEntries(
        aiTask.value.suggestions.map((suggestion) => [suggestion.id, suggestion.text]),
      );
      isGeneratingAi.value = false;
      return;
    }
    if (aiTask.value.status === 'failed') {
      aiError.value = aiTask.value.errorMessage ?? 'AI 生成失败，请保留当前输入后重试。';
      isGeneratingAi.value = false;
      return;
    }
    if (attempt >= 120) {
      aiError.value = 'AI 任务仍在后台执行，可以稍后重新查询。';
      isGeneratingAi.value = false;
      return;
    }
    aiPollTimer = globalThis.setTimeout(() => void pollAiTask(id, attempt + 1), 1_000);
  } catch (error: unknown) {
    aiError.value = getApiErrorMessage(error);
    isGeneratingAi.value = false;
  }
}
async function generateAi(): Promise<void> {
  if (!detail.value) return;
  aiError.value = null;
  if (!selectedDocumentIds.value.length && !selectedProfileEntryIds.value.length) {
    aiError.value = '请至少选择一项事实来源。';
    return;
  }
  if (!aiConsent.value) {
    aiError.value = '请先确认第三方模型数据说明。';
    return;
  }
  isGeneratingAi.value = true;
  try {
    if (store.isDirty) await store.saveNow();
    if (!store.detail || store.saveStatus !== 'saved') {
      aiError.value = '请先解决保存失败或版本冲突，再生成 AI 建议。';
      isGeneratingAi.value = false;
      return;
    }
    const target = document.value?.sections.find((section) => section.type === aiContentType.value);
    if (!target || !('entries' in target.content) || target.content.entries.length === 0) {
      aiError.value = `请先在${aiContentTypeLabel[aiContentType.value]}中添加至少一条内容。`;
      isGeneratingAi.value = false;
      return;
    }
    aiTask.value = await aiApi.createTask({
      resumeId: store.detail.id,
      sectionId: target.id,
      contentType: aiContentType.value,
      baseVersion: store.detail.version,
      instruction: aiInstruction.value,
      jobDescription: aiJobDescription.value.trim() || null,
      sources: {
        documentIds: selectedDocumentIds.value,
        profileEntryIds: selectedProfileEntryIds.value,
      },
      consentToThirdParty: true,
    });
    await pollAiTask(aiTask.value.id);
  } catch (error: unknown) {
    aiError.value = getApiErrorMessage(error);
    isGeneratingAi.value = false;
  }
}
async function acceptAiSuggestion(suggestion: ResumeSuggestion): Promise<void> {
  if (!aiTask.value || !store.detail) return;
  aiError.value = null;
  try {
    const updated = await aiApi.acceptSuggestion(aiTask.value.id, suggestion.id, {
      baseVersion: store.detail.version,
      editedText: editedSuggestions.value[suggestion.id]?.trim() || null,
    });
    store.applyServerDetail(updated);
    aiTask.value = await aiApi.getTask(aiTask.value.id);
  } catch (error: unknown) {
    aiError.value = getApiErrorMessage(error);
  }
}
async function rejectAiSuggestion(suggestion: ResumeSuggestion): Promise<void> {
  if (!aiTask.value) return;
  try {
    aiTask.value = await aiApi.rejectSuggestion(aiTask.value.id, suggestion.id);
  } catch (error: unknown) {
    aiError.value = getApiErrorMessage(error);
  }
}
onMounted(() => {
  void store.load(String(route.params.id));
  void listTemplates()
    .then((items) => {
      templates.value = items;
    })
    .catch((error: unknown) => {
      store.errorMessage = getApiErrorMessage(error);
    });
  globalThis.addEventListener('online', retryOnline);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('online', retryOnline);
  if (exportPollTimer) globalThis.clearTimeout(exportPollTimer);
  if (aiPollTimer) globalThis.clearTimeout(aiPollTimer);
  if (store.isDirty && store.saveStatus !== 'conflict') void store.saveNow();
});
</script>

<template>
  <main class="editor-shell">
    <header class="editor-topbar">
      <div class="editor-title">
        <button
          class="back"
          type="button"
          aria-label="返回工作台"
          @click="router.push('/dashboard')"
        >
          ←
        </button>
        <div>
          <strong>{{ detail?.name || '简历编辑器' }}</strong
          ><span :class="{ bad: saveStatus === 'failed' || saveStatus === 'conflict' }"
            ><i />{{ saveLabel }}</span
          >
        </div>
      </div>
      <div class="top-actions">
        <button :disabled="!store.undoStack.length" @click="store.undo">撤销</button
        ><button :disabled="!store.redoStack.length" @click="store.redo">重做</button
        ><button @click="isTemplateOpen = true">{{ currentTemplate?.name || '选择模板' }}</button
        ><button @click="isThemeOpen = true">样式设置</button
        ><button @click="router.push(`/resumes/${route.params.id}/preview`)">全屏预览</button
        ><button class="download" @click="openExport">导出 PDF</button
        ><button v-if="saveStatus === 'failed'" class="retry" @click="store.saveNow">
          重试保存
        </button>
      </div>
    </header>
    <a-skeleton v-if="isLoading" class="loading" active :paragraph="{ rows: 12 }" />
    <a-result
      v-else-if="errorMessage && !document"
      status="error"
      title="无法打开简历"
      :sub-title="errorMessage"
      ><template #extra
        ><a-button @click="router.push('/resumes')">返回工作台</a-button></template
      ></a-result
    >
    <div v-else-if="document" class="editor-grid" :class="{ 'form-collapsed': isFormCollapsed }">
      <aside class="sections-panel">
        <p>CONTENT BLOCKS</p>
        <h2>简历模块</h2>
        <template v-for="(section, index) in document.sections" :key="section.id">
          <div
            v-if="section.type !== 'target'"
            class="module-card"
            draggable="true"
            :class="{ active: store.selectedSectionId === section.id, hidden: !section.isVisible }"
            @dragstart="draggedIndex = index"
            @dragover.prevent
            @drop="dropSection(index)"
          >
            <i class="module-dot" />
            <div class="module-controls">
              <button
                type="button"
                aria-label="前移模块"
                :disabled="!canMoveSection(section.id, -1)"
                @click.stop="store.moveSection(section.id, -1)"
              >
                ‹
              </button>
              <button
                class="module-visibility"
                type="button"
                role="switch"
                :aria-checked="section.isVisible"
                :aria-label="section.isVisible ? '隐藏模块' : '显示模块'"
                @click.stop="toggleSection(section)"
              >
                <i />
              </button>
              <button
                type="button"
                aria-label="后移模块"
                :disabled="!canMoveSection(section.id, 1)"
                @click.stop="store.moveSection(section.id, 1)"
              >
                ›
              </button>
            </div>
            <div class="module-name-row">
              <input
                v-if="editingSectionId === section.id"
                v-model="editingSectionTitle"
                class="module-title-input"
                maxlength="80"
                aria-label="模块名称"
                autofocus
                @blur="finishRename(section)"
                @keydown.enter.prevent="blurRenameInput"
                @keydown.esc.prevent="cancelRename"
              />
              <button v-else class="module-select" type="button" @click="selectSection(section.id)">
                {{ section.title }}
              </button>
              <button
                v-if="editingSectionId !== section.id"
                class="module-rename"
                type="button"
                aria-label="编辑模块名称"
                @click.stop="startRename(section)"
              >
                ✎
              </button>
            </div>
          </div>
        </template>
        <button class="custom-add" @click="store.addCustomSection">＋ 自定义模块</button>
        <button
          class="drawer-handle"
          type="button"
          :aria-expanded="!isFormCollapsed"
          @click="isFormCollapsed = !isFormCollapsed"
        >
          {{ isFormCollapsed ? '展开编辑' : '收起编辑' }}
        </button>
      </aside>
      <section class="form-panel">
        <div v-if="selectedSection" class="form-header">
          <div>
            <p>EDIT SECTION</p>
            <h1>{{ selectedSection.title }}</h1>
          </div>
          <div class="section-controls">
            <button
              class="ai-entry"
              type="button"
              :disabled="!canUseAi"
              :title="canUseAi ? '基于事实来源生成建议' : '请先为该模块添加一条内容'"
              @click="openAi"
            >
              ✦ AI 辅助
            </button>
          </div>
        </div>
        <ResumeSectionEditor
          v-if="selectedSection"
          :section="selectedSection"
          :target-role="targetSection?.type === 'target' ? targetSection.content.role : null"
          :avatar-url="detail?.avatarUrl ?? null"
          :is-avatar-busy="isAvatarBusy"
          @update="store.updateSection"
          @update-target="updateTarget"
          @upload-avatar="uploadAvatar"
          @remove-avatar="removeAvatar"
          @remove="store.removeCustomSection(selectedSection.id)"
        />
      </section>
      <section class="preview-panel">
        <div class="preview-label">A4 · 实时预览</div>
        <div v-if="diagnostics?.exceedsRecommendedPages" class="preview-warning">
          当前 {{ diagnostics.pageCount }} 页，超过该模板建议页数
        </div>
        <ResumePreview
          :document="document"
          :avatar-url="detail?.avatarUrl ?? null"
          v-bind="currentTemplate ? { template: currentTemplate } : {}"
          @diagnostics="diagnostics = $event"
        />
      </section>
    </div>
    <a-modal
      :open="Boolean(pendingDraft)"
      title="发现未同步的本地草稿"
      :closable="false"
      :mask-closable="false"
      cancel-text="使用服务端内容"
      ok-text="恢复本地草稿"
      @ok="store.restorePendingDraft"
      @cancel="store.discardPendingDraft"
      ><p>上次编辑可能在保存完成前关闭。恢复后系统会继续自动保存。</p></a-modal
    >
    <a-modal
      :open="Boolean(conflictServer)"
      title="简历在其他位置被修改"
      :closable="false"
      :mask-closable="false"
      cancel-text="使用服务端内容"
      ok-text="保留本地内容"
      @ok="store.keepLocalAfterConflict"
      @cancel="store.useServerAfterConflict"
      ><p>为避免静默覆盖，请选择要保留的内容。</p></a-modal
    >
    <a-drawer
      v-model:open="isAiOpen"
      width="430"
      :closable="false"
      root-class-name="ai-assistant-drawer"
    >
      <template #title>
        <div class="ai-drawer-title">
          <span>✦</span>
          <div><strong>Ace AI 写作助手</strong><small>基于材料 · 不编造事实</small></div>
          <button type="button" aria-label="关闭 AI 助手" @click="isAiOpen = false">×</button>
        </div>
      </template>
      <div class="ai-flow">
        <a-skeleton v-if="isLoadingAiSources" active :paragraph="{ rows: 8 }" />
        <template v-else>
          <section class="ai-output-type">
            <div class="ai-section-title">
              <span>01</span>
              <div><b>输出内容类型</b><small>只检索与所选经历类型相关的事实</small></div>
            </div>
            <a-radio-group
              :value="aiContentType"
              :disabled="isGeneratingAi"
              button-style="solid"
              class="ai-type-options"
              @change="changeAiContentType($event.target.value)"
            >
              <a-radio-button value="project">项目经历</a-radio-button>
              <a-radio-button value="experience">工作 / 实习</a-radio-button>
              <a-radio-button value="campus">校园经历</a-radio-button>
            </a-radio-group>
          </section>
          <section class="ai-context">
            <div class="ai-section-title">
              <span>02</span>
              <div><b>事实来源</b><small>只会检索你明确选择的资料</small></div>
            </div>
            <div v-if="!aiDocuments.length && !visibleAiProfileEntries.length" class="ai-empty">
              暂无可用来源，请先在个人资料或材料库补充事实。
            </div>
            <label v-for="item in aiDocuments" :key="item.id" class="source-option">
              <a-checkbox
                :checked="selectedDocumentIds.includes(item.id)"
                @change="
                  selectedDocumentIds = toggleSource(
                    selectedDocumentIds,
                    item.id,
                    $event.target.checked,
                  )
                "
              />
              <span
                ><b>{{ item.fileName }}</b
                ><small>材料库 · {{ item.chunkCount }} 个片段</small></span
              >
            </label>
            <label v-for="item in visibleAiProfileEntries" :key="item.id" class="source-option">
              <a-checkbox
                :checked="selectedProfileEntryIds.includes(item.id)"
                @change="
                  selectedProfileEntryIds = toggleSource(
                    selectedProfileEntryIds,
                    item.id,
                    $event.target.checked,
                  )
                "
              />
              <span
                ><b>{{ profileTypeLabel[item.type] }}</b
                ><small>个人资料 · 结构化条目</small></span
              >
            </label>
          </section>
          <section class="ai-prompt">
            <div class="ai-section-title">
              <span>03</span>
              <div><b>写作要求</b><small>岗位描述只影响表达，不会成为事实</small></div>
            </div>
            <label
              ><span>你想怎么优化？</span
              ><a-textarea v-model:value="aiInstruction" :rows="4" :maxlength="2000" show-count
            /></label>
            <label
              ><span>目标岗位描述（可选）</span
              ><a-textarea v-model:value="aiJobDescription" :rows="3" :maxlength="10000"
            /></label>
            <label class="consent-row">
              <a-checkbox v-model:checked="aiConsent" />
              <span>我同意将本次选择的必要材料发送给模型服务商；未选择的资料不会发送。</span>
            </label>
            <button
              class="ai-generate"
              type="button"
              :disabled="isGeneratingAi || !aiInstruction.trim()"
              @click="generateAi"
            >
              <span
                >✦
                {{
                  isGeneratingAi
                    ? '正在校验事实并生成…'
                    : aiTask
                      ? '重新生成优化建议'
                      : '生成优化建议'
                }}</span
              >
              <small v-if="aiTask">{{ aiTask.progress }}%</small>
            </button>
          </section>
          <section v-if="aiTask?.suggestions.length" class="ai-results">
            <div class="result-heading">
              <span>04 · 建议已生成</span><small>{{ aiTask.suggestions.length }} 条</small>
            </div>
            <article
              v-for="(suggestion, index) in aiTask.suggestions"
              :key="suggestion.id"
              class="suggestion-card"
            >
              <header>
                <span>建议 {{ String(index + 1).padStart(2, '0') }}</span>
                <b :class="suggestion.supportStatus">
                  {{
                    suggestion.supportStatus === 'supported'
                      ? '依据充分'
                      : suggestion.supportStatus === 'conflict'
                        ? '来源冲突'
                        : '依据不足'
                  }}
                </b>
              </header>
              <div class="suggestion-diff">
                <small>修改前</small>
                <p>{{ suggestion.beforeText || '（当前为空）' }}</p>
                <small>修改建议</small>
                <p class="suggestion-advice">{{ suggestion.advice }}</p>
                <small>建议成稿（STAR 分点）</small>
                <a-textarea
                  v-model:value="editedSuggestions[suggestion.id]"
                  :rows="5"
                  :disabled="suggestion.decision !== 'pending'"
                />
              </div>
              <details>
                <summary>查看 {{ suggestion.citations.length }} 项事实来源</summary>
                <div v-for="citation in suggestion.citations" :key="citation.id" class="citation">
                  <b>{{ citation.label }}</b>
                  <p>{{ citation.excerpt }}</p>
                </div>
              </details>
              <div
                v-if="suggestion.riskFlags.length || suggestion.missingFacts.length"
                class="ai-risk"
              >
                <b>需要人工确认</b>
                <p v-for="fact in suggestion.missingFacts" :key="fact">{{ fact }}</p>
                <p v-if="suggestion.riskFlags.includes('source_conflict')">
                  所选来源存在时间冲突。
                </p>
                <p v-if="suggestion.riskFlags.includes('prompt_injection_source')">
                  材料中含疑似指令文本，已按普通资料隔离。
                </p>
              </div>
              <footer v-if="suggestion.decision === 'pending'">
                <button type="button" @click="rejectAiSuggestion(suggestion)">忽略</button>
                <button
                  type="button"
                  class="accept"
                  :disabled="suggestion.supportStatus !== 'supported'"
                  @click="acceptAiSuggestion(suggestion)"
                >
                  ✓ 接受并写入
                </button>
              </footer>
              <div v-else class="decision-state">
                {{ suggestion.decision === 'accepted' ? '已接受并写入' : '已忽略' }}
              </div>
            </article>
          </section>
        </template>
      </div>
    </a-drawer>
    <a-drawer v-model:open="isThemeOpen" title="样式设置" width="360">
      <div v-if="document" class="theme-form">
        <label
          ><span>字体</span
          ><a-select
            :value="document.theme.fontFamily"
            @change="(value: ResumeTheme['fontFamily']) => updateTheme('fontFamily', value)"
            ><a-select-option value="Noto Sans SC">思源黑体</a-select-option
            ><a-select-option value="Noto Serif SC">思源宋体</a-select-option
            ><a-select-option value="Source Han Sans SC">Source Han Sans</a-select-option></a-select
          ></label
        >
        <label
          ><span>字号 {{ document.theme.fontSize }}px</span
          ><a-slider
            :min="9"
            :max="16"
            :step="0.5"
            :value="document.theme.fontSize"
            @change="(v: number) => updateTheme('fontSize', v)"
        /></label>
        <label
          ><span>行高 {{ document.theme.lineHeight }}</span
          ><a-slider
            :min="1.2"
            :max="2"
            :step="0.05"
            :value="document.theme.lineHeight"
            @change="(v: number) => updateTheme('lineHeight', v)"
        /></label>
        <label
          ><span>模块间距 {{ document.theme.sectionGap }}px</span
          ><a-slider
            :min="6"
            :max="32"
            :value="document.theme.sectionGap"
            @change="(v: number) => updateTheme('sectionGap', v)"
        /></label>
        <label
          ><span>段落间距 {{ document.theme.paragraphGap }}px</span
          ><a-slider
            :min="2"
            :max="20"
            :value="document.theme.paragraphGap"
            @change="(v: number) => updateTheme('paragraphGap', v)"
        /></label>
        <label
          ><span>强调色</span
          ><input
            type="color"
            :value="document.theme.accentColor"
            @input="updateTheme('accentColor', ($event.target as HTMLInputElement).value)"
        /></label>
        <fieldset>
          <legend>页边距（毫米）</legend>
          <label v-for="side in ['top', 'right', 'bottom', 'left'] as const" :key="side"
            ><span
              >{{ { top: '上', right: '右', bottom: '下', left: '左' }[side] }}
              {{ document.theme.pageMargin[side] }}</span
            ><a-slider
              :min="10"
              :max="30"
              :value="document.theme.pageMargin[side]"
              @change="(v: number) => updateMargin(side, v)"
          /></label>
        </fieldset>
      </div>
    </a-drawer>
    <a-drawer v-model:open="isTemplateOpen" title="切换模板" width="460">
      <p class="template-note">切换只改变布局与样式，不会删除或改写任何简历内容。</p>
      <div class="template-switcher">
        <button
          v-for="item in templates"
          :key="item.versionId"
          type="button"
          :class="{ active: document?.templateVersionId === item.versionId }"
          @click="changeTemplate(item.versionId)"
        >
          <span>{{ item.layout === 'two-column' ? '双栏' : '单栏' }}</span>
          <strong>{{ item.name }}</strong>
          <small>{{ item.description }}</small>
        </button>
      </div>
    </a-drawer>
    <a-modal v-model:open="isExportOpen" title="PDF 导出检查" :footer="null">
      <div class="export-checks">
        <a-alert
          v-if="hasBlockingPreviewRisk"
          type="error"
          show-icon
          message="当前预览存在裁切、空白页、链接或字体风险，暂不能导出。"
        />
        <a-alert
          v-else-if="diagnostics?.exceedsRecommendedPages"
          type="warning"
          show-icon
          :message="`当前共 ${diagnostics.pageCount} 页，超过模板建议页数，但仍可导出。`"
        />
        <ul v-if="diagnostics">
          <li>页面：{{ diagnostics.pageCount }} 页</li>
          <li>内容裁切：{{ diagnostics.overflowCount ? '存在风险' : '未发现' }}</li>
          <li>空白页：{{ diagnostics.blankPageCount ? '存在' : '无' }}</li>
          <li>无效链接：{{ diagnostics.invalidLinkCount ? '存在' : '无' }}</li>
          <li>授权字体：{{ diagnostics.fontReady ? '已加载' : '未加载' }}</li>
        </ul>
        <div v-if="exportJob" class="export-state">
          <strong>{{
            exportJob.status === 'completed' ? 'PDF 已生成并开始下载' : '正在后台生成 PDF…'
          }}</strong>
          <span>任务编号 {{ exportJob.id }}</span>
        </div>
        <button
          v-if="!exportJob || exportJob.status === 'failed'"
          class="export-submit"
          type="button"
          :disabled="hasBlockingPreviewRisk || isCreatingExport"
          @click="startExport"
        >
          {{ isCreatingExport ? '正在创建任务…' : '确认并导出 PDF' }}
        </button>
        <button
          v-else-if="exportJob.status === 'completed'"
          class="export-submit"
          type="button"
          @click="exportApi.downloadExport(exportJob)"
        >
          再次下载
        </button>
      </div>
    </a-modal>
  </main>
</template>

<style scoped>
.editor-shell {
  height: 100vh;
  overflow: hidden;
  background: #edf0f4;
  color: #1b2a42;
}
.editor-topbar {
  height: 4.25rem;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 0 1rem;
  background: #fff;
  border-bottom: 1px solid #d9dee8;
}
.editor-title {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.editor-title > div {
  display: grid;
}
.editor-title strong {
  font-family: var(--serif);
  font-size: 0.95rem;
}
.editor-topbar span {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #6c7584;
}
.editor-topbar span i {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: #58a96a;
}
.editor-topbar span.bad {
  color: #c44141;
}
.back,
.top-actions button,
.section-controls button {
  border: 0;
  background: transparent;
  color: #526078;
}
.back {
  width: 2rem;
  height: 2rem;
  border: 1px solid #ddd9d0;
}
.top-actions {
  display: flex;
  justify-content: end;
  gap: 0.7rem;
}
.top-actions button {
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid #d9d6ce;
  font-size: 0.72rem;
}
.top-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.top-actions .download {
  border-color: #173fbd;
  background: #173fbd;
  color: #fff;
}
.top-actions .retry {
  color: #b73535;
}
.editor-grid {
  height: calc(100vh - 4.25rem);
  display: grid;
  grid-template-areas:
    'preview'
    'modules'
    'form';
  grid-template-columns: 1fr;
  grid-template-rows: minmax(18rem, 1fr) 7rem minmax(19rem, 0.72fr);
  transition: grid-template-rows 0.25s ease;
}
.editor-grid.form-collapsed {
  grid-template-rows: minmax(25rem, 1fr) 7rem 0;
}
.sections-panel {
  grid-area: modules;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  overflow-x: auto;
  padding: 0.8rem 2.5rem;
  background: #fff;
  box-shadow: 0 -10px 26px rgba(17, 29, 48, 0.13);
  color: #35445b;
}
.sections-panel > p,
.sections-panel > h2 {
  display: none;
}
.form-header p {
  margin: 0;
  color: #ff8068;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}
.module-card {
  position: relative;
  flex: 0 0 7.4rem;
  height: 5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.55rem 0.5rem 0.65rem;
  border: 1px solid #e3e7ed;
  border-radius: 0.85rem;
  background: #fff;
  color: #657083;
  text-align: center;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
}
.module-card.active {
  border-color: #b8d1fb;
  background: #f1f6ff;
  box-shadow: inset 0 -3px #3b82f6;
  color: #3176df;
}
.module-card.hidden {
  opacity: 0.55;
}
.module-dot {
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: #d4dae3;
}
.module-card.active .module-dot {
  background: #9abfff;
}
.module-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 1.45rem;
  margin-top: -0.2rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}
.module-card:hover .module-controls,
.module-card:focus-within .module-controls {
  opacity: 1;
  pointer-events: auto;
}
.module-card:hover .module-dot,
.module-card:focus-within .module-dot {
  display: none;
}
.module-controls > button,
.module-rename,
.module-select {
  border: 0;
  background: transparent;
  color: inherit;
}
.module-controls > button:not(.module-visibility) {
  width: 1.45rem;
  height: 1.45rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #dfe4ec;
  border-radius: 50%;
  background: #fff;
  color: #788398;
  font-size: 1rem;
  line-height: 1;
}
.module-controls > button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.module-controls .module-visibility {
  position: relative;
  width: 2.35rem;
  height: 1.3rem;
  padding: 0;
  border-radius: 999px;
  background: #cbd2dc;
  transition: background 0.18s ease;
}
.module-controls .module-visibility[aria-checked='true'] {
  background: #3b82f6;
}
.module-visibility i {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(27, 42, 66, 0.2);
  transition: transform 0.18s ease;
}
.module-visibility[aria-checked='true'] i {
  transform: translateX(1.05rem);
}
.module-name-row {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}
.module-select {
  min-width: 0;
  overflow: hidden;
  padding: 0.15rem 0;
  font-size: 0.84rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.module-rename {
  flex: 0 0 1.3rem;
  height: 1.3rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #dfe4ec;
  border-radius: 0.35rem;
  background: #fff;
  color: #8190a7;
  font-size: 0.72rem;
}
.module-title-input {
  width: 100%;
  min-width: 0;
  height: 1.8rem;
  padding: 0 0.35rem;
  border: 1px solid #78a8f8;
  border-radius: 0.35rem;
  outline: none;
  color: #244f9c;
  text-align: center;
}
.sections-panel .custom-add {
  flex: 0 0 7.4rem;
  height: 5rem;
  margin: 0;
  padding: 0.65rem;
  border: 1px dashed #aab7ca;
  border-radius: 0.85rem;
  background: #fff;
  color: #55647a;
  text-align: center;
}
.form-panel {
  grid-area: form;
  overflow: auto;
  padding: 2rem;
  background: #fff;
}
.form-collapsed .form-panel {
  display: none;
}
.drawer-handle {
  flex: 0 0 auto;
  align-self: flex-end;
  margin: 0 0 0 auto;
  padding: 0.45rem 0.9rem;
  border: 1px solid #dbe1e9;
  border-radius: 0.5rem;
  background: #fff;
  color: #647087;
  font-size: 0.68rem;
  white-space: nowrap;
}
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 1.5rem;
}
.form-header h1 {
  font: 2rem var(--serif);
  margin: 0.2rem 0;
}
.section-controls {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}
.section-controls .ai-entry {
  min-width: 6.5rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid #173fbd;
  background: #fffdf8;
  color: #173fbd;
  font-weight: 750;
}
.section-controls .ai-entry:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.preview-panel {
  position: relative;
  grid-area: preview;
  overflow: hidden;
  background: #dfe3e9;
}
.preview-label {
  position: absolute;
  z-index: 1;
  top: 0.7rem;
  right: 1rem;
  padding: 0.25rem 0.55rem;
  background: #172a4b;
  color: #fff;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
}
.preview-warning {
  position: absolute;
  z-index: 1;
  top: 0.7rem;
  left: 1rem;
  padding: 0.3rem 0.6rem;
  background: #fff0e9;
  color: #b64e38;
  font-size: 0.68rem;
}
.loading {
  padding: 4rem;
}
.theme-form {
  display: grid;
  gap: 1.2rem;
}
.theme-form label {
  display: grid;
  gap: 0.4rem;
}
.theme-form fieldset {
  border: 1px solid #dce1e8;
}
.theme-form input[type='color'] {
  width: 100%;
  height: 2.5rem;
  border: 1px solid #dce1e8;
  background: #fff;
}
.template-note {
  color: #687386;
  line-height: 1.7;
}
.template-switcher {
  display: grid;
  gap: 0.7rem;
}
.template-switcher button {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid #d9dee7;
  background: #fff;
  color: #1b2a42;
  text-align: left;
}
.template-switcher button.active {
  border-color: #173fbd;
  box-shadow: inset 4px 0 #173fbd;
  background: #f3f6ff;
}
.template-switcher span {
  color: #ff6a4d;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
}
.template-switcher small {
  color: #7b8390;
  line-height: 1.5;
}
.export-checks {
  display: grid;
  gap: 1rem;
}
.export-checks ul {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 1rem 1rem 1rem 2rem;
  background: #f5f6f8;
}
.export-state {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border-left: 4px solid #173fbd;
  background: #eef2ff;
}
.export-state span {
  color: #6f7784;
  font-size: 0.7rem;
}
.export-submit {
  padding: 0.85rem;
  border: 0;
  background: #173fbd;
  color: #fff;
  font-weight: 700;
  box-shadow: 4px 4px 0 #ff6a4d;
}
.export-submit:disabled {
  opacity: 0.45;
  box-shadow: none;
}
.ai-drawer-title {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  margin: -1rem -1.5rem;
  padding: 1rem 1.2rem;
  background: #172033;
  color: #fff;
}
.ai-drawer-title > span {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  background: #f6d86b;
  color: #172033;
}
.ai-drawer-title > div {
  display: grid;
}
.ai-drawer-title small {
  color: #cbd2dd;
  font-size: 0.68rem;
  font-weight: 400;
}
.ai-drawer-title button {
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 1.5rem;
}
.ai-flow {
  display: grid;
  gap: 1.4rem;
}
.ai-output-type,
.ai-context,
.ai-prompt,
.ai-results {
  display: grid;
  gap: 0.75rem;
}
.ai-type-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.ai-type-options :deep(.ant-radio-button-wrapper) {
  height: auto;
  padding: 0.55rem 0.35rem;
  text-align: center;
  white-space: normal;
}
.ai-section-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #e1ded5;
}
.ai-section-title > span {
  color: #ff6a4d;
  font: 1.2rem var(--serif);
}
.ai-section-title > div {
  display: grid;
}
.ai-section-title small {
  color: #777f8d;
  font-size: 0.68rem;
}
.source-option {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem;
  border: 1px solid #dfe3ea;
  background: #fffdf8;
}
.source-option > span {
  display: grid;
}
.source-option small {
  color: #79808c;
  font-size: 0.68rem;
}
.ai-empty {
  padding: 1rem;
  border: 1px dashed #c8ced8;
  color: #737b88;
  line-height: 1.7;
}
.ai-prompt > label {
  display: grid;
  gap: 0.4rem;
  color: #303d52;
  font-size: 0.78rem;
  font-weight: 700;
}
.ai-prompt .consent-row {
  grid-template-columns: auto 1fr;
  align-items: start;
  font-weight: 400;
  line-height: 1.6;
}
.ai-generate {
  display: flex;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border: 0;
  background: #173fbd;
  box-shadow: 4px 4px 0 #ff6a4d;
  color: #fff;
  font-weight: 750;
}
.ai-generate:disabled {
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.45;
}
.result-heading {
  display: flex;
  justify-content: space-between;
  color: #173fbd;
  font-weight: 800;
}
.suggestion-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid #dcdad2;
  border-top: 4px solid #173fbd;
  background: #fff;
}
.suggestion-card > header,
.suggestion-card > footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.suggestion-card > header > span {
  font:
    0.78rem Georgia,
    serif;
  letter-spacing: 0.08em;
}
.suggestion-card > header b {
  padding: 0.25rem 0.45rem;
  font-size: 0.65rem;
}
.suggestion-card > header b.supported {
  background: #dff3e7;
  color: #397348;
}
.suggestion-card > header b.conflict,
.suggestion-card > header b.unsupported {
  background: #fff0eb;
  color: #b74432;
}
.suggestion-diff {
  display: grid;
  gap: 0.35rem;
}
.suggestion-diff small {
  color: #7c8491;
  font-weight: 750;
}
.suggestion-diff p {
  max-height: 6rem;
  overflow: auto;
  margin: 0;
  padding: 0.65rem;
  background: #f4f2ec;
  color: #69717e;
  line-height: 1.6;
}
.suggestion-diff .suggestion-advice {
  background: #eef2ff;
  color: #303d52;
}
.suggestion-card details {
  color: #173fbd;
  font-size: 0.75rem;
}
.citation {
  margin-top: 0.5rem;
  padding: 0.65rem;
  border-left: 3px solid #f6d86b;
  background: #fffcf0;
  color: #37445a;
}
.citation p {
  margin: 0.25rem 0 0;
  color: #687184;
  line-height: 1.55;
}
.ai-risk {
  padding: 0.75rem;
  border-left: 4px solid #ff6a4d;
  background: #fff0eb;
  color: #963e31;
}
.ai-risk p {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
}
.suggestion-card footer button {
  padding: 0.55rem 0.8rem;
  border: 1px solid #d5d9e1;
  background: #fff;
  color: #667084;
}
.suggestion-card footer .accept {
  border-color: #173fbd;
  background: #173fbd;
  color: #fff;
}
.suggestion-card footer button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.decision-state {
  padding: 0.55rem;
  background: #dff3e7;
  color: #397348;
  text-align: center;
  font-weight: 700;
}
@media (max-width: 1100px) {
  .editor-grid {
    grid-template-rows: minmax(15rem, 1fr) 6.5rem minmax(18rem, 0.8fr);
  }
}
@media (max-width: 720px) {
  .editor-topbar {
    grid-template-columns: auto 1fr;
  }
  .top-actions {
    display: none;
  }
  .editor-grid {
    grid-template-rows: minmax(13rem, 0.8fr) 6rem minmax(20rem, 1fr);
  }
  .form-panel {
    padding: 1rem;
  }
  .sections-panel {
    padding-inline: 1rem;
  }
  .module-card,
  .sections-panel .custom-add {
    flex-basis: 6.7rem;
  }
}
</style>
