<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import type {
  DocumentDetail,
  DocumentPurpose,
  DocumentSummary,
  ImportCandidate,
  ResumeSummary,
  TemplateSummary,
} from '@aceresume/contracts';
import { getApiErrorMessage } from '@/api/http';
import * as documentApi from '@/api/document';
import * as resumeApi from '@/api/resume';
import { listTemplates } from '@/api/template';
import AppSidebar from '@/components/AppSidebar.vue';

const route = useRoute();
const router = useRouter();
const items = ref<DocumentSummary[]>([]);
const total = ref(0);
const usageBytes = ref(0);
const limits = ref({
  maxFileBytes: 20 * 1024 * 1024,
  maxFiles: 50,
  maxTotalBytes: 200 * 1024 * 1024,
});
const isLoading = ref(true);
const isUploading = ref(false);
const detail = ref<DocumentDetail | null>(null);
const isDetailOpen = ref(false);
const isConfirming = ref(false);
const isReparsing = ref(false);
const selectedIds = ref<string[]>([]);
const editedValues = reactive<Record<string, string>>({});
const resumes = ref<ResumeSummary[]>([]);
const templates = ref<TemplateSummary[]>([]);
const confirmForm = reactive({
  destination: 'resume' as 'profile' | 'resume' | 'both',
  resumeMode: 'new' as 'new' | 'existing',
  resumeId: '',
  name: '导入的简历',
  targetRole: '',
  templateVersionId: 'classic-single-v1',
});
let pollTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
const statusLabel: Record<DocumentSummary['status'], string> = {
  queued: '等待解析',
  parsing: '解析中',
  ready: '解析完成',
  failed: '解析失败',
  deleting: '删除中',
};
const usagePercent = computed(() =>
  Math.min(100, (usageBytes.value / limits.value.maxTotalBytes) * 100),
);
const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const candidateSection: Record<ImportCandidate['section'], string> = {
  basic: '基本信息',
  summary: '个人简介',
  education: '教育经历',
  experience: '实习 / 工作',
  project: '项目经历',
  skill: '技能',
};
function toggleCandidate(id: string, checked: boolean): void {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((candidateId) => candidateId !== id);
}
function chunkSectionLabel(section: string | null): string {
  return section && section in candidateSection
    ? candidateSection[section as ImportCandidate['section']]
    : (section ?? '');
}

async function load(): Promise<void> {
  try {
    const page = await documentApi.listDocuments();
    items.value = page.items;
    total.value = page.total;
    usageBytes.value = page.usageBytes;
    limits.value = page.limits;
    if (page.items.some((item) => ['queued', 'parsing', 'deleting'].includes(item.status)))
      pollTimer = globalThis.setTimeout(() => void load(), 1_500);
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isLoading.value = false;
  }
}
async function chooseFile(purpose: DocumentPurpose): Promise<void> {
  const input = globalThis.document.createElement('input');
  input.type = 'file';
  input.accept = '.docx,.pdf,.txt,.md,.markdown';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void upload(file, purpose);
  };
  input.click();
}
async function upload(
  file: Parameters<typeof documentApi.uploadDocument>[0],
  purpose: DocumentPurpose,
): Promise<void> {
  isUploading.value = true;
  try {
    await documentApi.uploadDocument(file, purpose);
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isUploading.value = false;
  }
}
async function openDetail(item: DocumentSummary): Promise<void> {
  if (item.status !== 'ready' && item.status !== 'failed') return;
  try {
    detail.value = await documentApi.getDocument(item.id);
    selectedIds.value = detail.value.import?.candidates.map((candidate) => candidate.id) ?? [];
    for (const candidate of detail.value.import?.candidates ?? [])
      editedValues[candidate.id] = candidate.value;
    confirmForm.name = item.fileName.replace(/\.[^.]+$/, '');
    isDetailOpen.value = true;
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
async function reparse(): Promise<void> {
  if (!detail.value) return;
  isReparsing.value = true;
  try {
    await documentApi.reparseDocument(detail.value.id);
    isDetailOpen.value = false;
    message.success('已开始重新识别，解析完成后请再次打开该材料确认候选字段。');
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isReparsing.value = false;
  }
}
async function confirm(): Promise<void> {
  if (!detail.value?.import) {
    message.warning('当前没有可确认的识别结果，请先重新识别。');
    return;
  }
  if (!selectedIds.value.length) {
    message.warning('请至少选择一项候选字段后再写入。');
    return;
  }
  isConfirming.value = true;
  try {
    const existing =
      confirmForm.resumeMode === 'existing'
        ? resumes.value.find((item) => item.id === confirmForm.resumeId)
        : undefined;
    const result = await documentApi.confirmImport(detail.value.id, {
      selected: selectedIds.value.map((id) => ({ id, value: editedValues[id] ?? '' })),
      destination: confirmForm.destination,
      resumeId: confirmForm.destination !== 'profile' && existing ? existing.id : null,
      resumeVersion: confirmForm.destination !== 'profile' && existing ? existing.version : null,
      newResume:
        confirmForm.destination !== 'profile' && !existing
          ? {
              name: confirmForm.name,
              targetRole: confirmForm.targetRole || null,
              locale: 'zh-CN',
              templateVersionId: confirmForm.templateVersionId,
            }
          : null,
    });
    isDetailOpen.value = false;
    await load();
    if (result.resumeId) await router.push(`/resumes/${result.resumeId}/edit`);
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isConfirming.value = false;
  }
}
async function remove(item: DocumentSummary): Promise<void> {
  try {
    await documentApi.deleteDocument(item.id);
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
async function download(item: DocumentSummary): Promise<void> {
  try {
    await documentApi.downloadDocument(item);
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
onMounted(async () => {
  await Promise.all([
    load(),
    resumeApi.listResumes('active').then((page) => (resumes.value = page.items)),
    listTemplates().then((result) => (templates.value = result)),
  ]);
  if (route.query.import === '1') message.info('请选择旧简历文件，解析完成后逐项确认候选字段。');
});
onBeforeUnmount(() => globalThis.clearTimeout(pollTimer));
</script>

<template>
  <div class="document-shell">
    <AppSidebar />
    <main>
      <header class="hero">
        <div>
          <p>SOURCE LIBRARY</p>
          <h1>材料库</h1>
          <span>所有导入与后续 AI 建议，都从可追溯的事实开始。</span>
        </div>
        <div class="hero-actions">
          <button class="secondary" :disabled="isUploading" @click="chooseFile('resume')">
            导入旧简历
          </button>
          <button class="primary" :disabled="isUploading" @click="chooseFile('material')">
            ＋ 上传材料
          </button>
        </div>
      </header>
      <section class="workspace">
        <div class="usage">
          <div>
            <strong>{{ total }} / {{ limits.maxFiles }}</strong
            ><span>文件数量</span>
          </div>
          <div class="usage-bar"><i :style="{ width: usagePercent + '%' }" /></div>
          <span>{{ formatSize(usageBytes) }} / {{ formatSize(limits.maxTotalBytes) }}</span>
        </div>
        <a-skeleton v-if="isLoading" active :paragraph="{ rows: 8 }" />
        <div v-else-if="items.length" class="document-grid">
          <article
            v-for="(item, index) in items"
            :key="item.id"
            :class="['document-card', item.status]"
            @click="openDetail(item)"
          >
            <span class="number">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="file-mark">{{ item.fileType.toUpperCase() }}</div>
            <h2>{{ item.fileName }}</h2>
            <p>
              {{ formatSize(item.sizeBytes) }} ·
              {{ item.pageCount ? `${item.pageCount} 页` : `${item.chunkCount} 个片段` }}
            </p>
            <div class="card-foot">
              <span>{{ statusLabel[item.status] }}</span
              ><small v-if="item.purpose === 'resume'">旧简历</small><small v-else>事实材料</small>
            </div>
            <p v-if="item.errorMessage" class="failure">{{ item.errorMessage }}</p>
            <a-popconfirm title="将删除原文件、解析文本和片段，确定吗？" @confirm="remove(item)">
              <button class="delete" type="button" @click.stop>删除</button>
            </a-popconfirm>
            <button class="download" type="button" @click.stop="download(item)">下载原文件</button>
          </article>
        </div>
        <div v-else class="empty">
          <b>01</b>
          <h2>把事实材料放在这里</h2>
          <p>支持 DOCX、文本型 PDF、TXT 和 Markdown，单文件不超过 20 MB。</p>
          <button class="primary" @click="chooseFile('material')">上传第一份材料</button>
        </div>
      </section>
      <a-drawer v-model:open="isDetailOpen" width="min(860px, 92vw)" title="材料解析与导入确认">
        <template v-if="detail">
          <div class="detail-head">
            <div>
              <b>{{ detail.fileName }}</b
              ><span>{{ statusLabel[detail.status] }} · {{ detail.chunkCount }} 个定位片段</span>
            </div>
            <i>{{ detail.fileType.toUpperCase() }}</i>
          </div>
          <a-alert
            v-if="detail.errorMessage"
            :message="detail.errorMessage"
            type="error"
            show-icon
          />
          <template v-else>
            <section v-if="detail.import" class="candidate-panel">
              <h3>逐项确认候选字段</h3>
              <p>低于 80% 的候选需要重点检查；未勾选的内容不会写入。</p>
              <div v-if="!detail.import.candidates.length" class="candidate-empty">
                <strong>本次未识别出候选字段</strong>
                <span>原文已经保留，可以重新识别后再逐项确认写入。</span>
                <button class="secondary" :disabled="isReparsing" @click="reparse">
                  {{ isReparsing ? '正在提交…' : '重新识别' }}
                </button>
              </div>
              <template v-if="detail.import.candidates.length">
                <article
                  v-for="candidate in detail.import.candidates"
                  :key="candidate.id"
                  :class="{ low: candidate.confidence < 0.8 }"
                >
                  <a-checkbox
                    :checked="selectedIds.includes(candidate.id)"
                    @change="toggleCandidate(candidate.id, $event.target.checked)"
                  />
                  <div>
                    <span>{{ candidateSection[candidate.section] }} · {{ candidate.label }}</span
                    ><a-input v-model:value="editedValues[candidate.id]" />
                  </div>
                  <b>{{ Math.round(candidate.confidence * 100) }}%</b>
                  <small>{{
                    candidate.source.pageNumber
                      ? `第 ${candidate.source.pageNumber} 页`
                      : `段落 ${Number(candidate.source.paragraphStart) + 1}`
                  }}</small>
                </article>
              </template>
              <div v-if="detail.import.candidates.length" class="destination">
                <a-radio-group v-model:value="confirmForm.destination">
                  <a-radio value="resume">写入简历</a-radio
                  ><a-radio value="profile">写入个人资料</a-radio
                  ><a-radio value="both">两者都写入</a-radio>
                </a-radio-group>
                <template v-if="confirmForm.destination !== 'profile'">
                  <a-radio-group v-model:value="confirmForm.resumeMode"
                    ><a-radio value="new">创建新简历</a-radio
                    ><a-radio value="existing">写入现有简历</a-radio></a-radio-group
                  >
                  <a-select
                    v-if="confirmForm.resumeMode === 'existing'"
                    v-model:value="confirmForm.resumeId"
                    placeholder="选择简历"
                  >
                    <a-select-option
                      v-for="resume in resumes"
                      :key="resume.id"
                      :value="resume.id"
                      >{{ resume.name }}</a-select-option
                    >
                  </a-select>
                  <template v-else
                    ><a-input v-model:value="confirmForm.name" placeholder="简历名称" /><a-input
                      v-model:value="confirmForm.targetRole"
                      placeholder="求职意向（可选）"
                    /><a-select v-model:value="confirmForm.templateVersionId"
                      ><a-select-option
                        v-for="template in templates"
                        :key="template.versionId"
                        :value="template.versionId"
                        >{{ template.name }}</a-select-option
                      ></a-select
                    ></template
                  >
                </template>
                <span v-if="!selectedIds.length" class="selection-hint"
                  >请至少选择一项候选字段。</span
                >
                <button
                  class="primary"
                  :disabled="isConfirming || !selectedIds.length"
                  @click="confirm"
                >
                  {{ isConfirming ? '正在写入…' : '确认并写入' }}
                </button>
              </div>
            </section>
            <section v-else-if="detail.purpose === 'resume'" class="candidate-empty">
              <strong>当前没有可确认的识别结果</strong>
              <span>请重新解析这份旧简历。</span>
              <button class="secondary" :disabled="isReparsing" @click="reparse">
                {{ isReparsing ? '正在提交…' : '重新识别' }}
              </button>
            </section>
            <section class="preview-panel">
              <h3>解析原文</h3>
              <article v-for="chunk in detail.chunks" :key="chunk.id">
                <span
                  >{{
                    chunk.pageNumber
                      ? `第 ${chunk.pageNumber} 页`
                      : `段落 ${Number(chunk.paragraphStart) + 1}`
                  }}<template v-if="chunk.sectionPath">
                    · {{ chunkSectionLabel(chunk.sectionPath) }}</template
                  ></span
                >
                <pre>{{ chunk.content }}</pre>
              </article>
            </section>
          </template>
        </template>
      </a-drawer>
    </main>
  </div>
</template>

<style scoped>
.document-shell {
  display: flex;
  min-height: 100vh;
  background: #f7f5ef;
  color: #19283f;
}
.document-shell > main {
  min-width: 0;
  flex: 1;
}
.hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 4.5rem 7vw 3.5rem;
  border-bottom: 1px solid #d9dde5;
  background: #fffdf8;
}
.hero p {
  margin: 0;
  color: #173fbd;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.2em;
}
.hero h1 {
  margin: 0.45rem 0;
  font: 3.4rem/1.1 var(--serif);
}
.hero span {
  color: #6e7480;
}
.hero-actions {
  display: flex;
  gap: 1rem;
}
.primary,
.secondary {
  border: 0;
  padding: 0.85rem 1.25rem;
  font-weight: 750;
}
.primary {
  background: #173fbd;
  box-shadow: 5px 5px 0 #ff6a4d;
  color: #fff;
}
.primary:disabled,
.secondary:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.primary:disabled {
  box-shadow: none;
}
.secondary {
  border: 1px solid #173fbd;
  background: #fff;
  color: #173fbd;
}
.workspace {
  padding: 2.5rem 7vw 5rem;
}
.usage {
  display: grid;
  grid-template-columns: auto minmax(10rem, 24rem) auto;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0 2rem;
  padding: 1rem 1.2rem;
  border: 1px solid #ddd9cf;
  background: #fffdf8;
}
.usage div:first-child {
  display: grid;
}
.usage span {
  color: #757b85;
  font-size: 0.75rem;
}
.usage-bar {
  height: 6px;
  background: #e5e2d9;
}
.usage-bar i {
  display: block;
  height: 100%;
  background: #ff6a4d;
}
.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 1.4rem;
}
.document-card {
  position: relative;
  min-height: 15rem;
  padding: 1.5rem;
  border: 1px solid #d7dbe2;
  background: #fff;
  box-shadow: 0 12px 30px rgba(28, 39, 65, 0.07);
  cursor: pointer;
}
.document-card:hover {
  transform: translateY(-3px);
}
.document-card.parsing,
.document-card.queued {
  border-top: 4px solid #f6c453;
}
.document-card.ready {
  border-top: 4px solid #173fbd;
}
.document-card.failed {
  border-top: 4px solid #d84a3a;
}
.number {
  position: absolute;
  right: 1.3rem;
  color: #c5c7cb;
  font: 1.7rem var(--serif);
}
.file-mark {
  display: grid;
  width: 3.2rem;
  height: 3.8rem;
  place-items: center;
  background: #193b55;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
}
.document-card h2 {
  overflow: hidden;
  margin: 1.1rem 0 0.45rem;
  font: 1.25rem var(--serif);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.document-card p {
  color: #78808c;
  font-size: 0.78rem;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 0.8rem;
  border-top: 1px solid #e1e3e7;
}
.card-foot span {
  color: #173fbd;
  font-weight: 750;
}
.card-foot small {
  color: #9a7180;
}
.failure {
  color: #ba3f32 !important;
}
.delete {
  position: absolute;
  right: 1rem;
  bottom: 0.65rem;
  border: 0;
  background: none;
  color: #b63f34;
  font-size: 0.7rem;
}
.download {
  position: absolute;
  bottom: 0.65rem;
  left: 1rem;
  border: 0;
  background: none;
  color: #173fbd;
  font-size: 0.7rem;
}
.empty {
  text-align: center;
  padding: 6rem 1rem;
  border: 1px dashed #bdc4cf;
  background: #fffdf8;
}
.empty > b {
  color: #ff6a4d;
  font: 4rem var(--serif);
}
.empty h2 {
  font: 2rem var(--serif);
}
.detail-head {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-left: 5px solid #ff6a4d;
  background: #f3f0e7;
}
.detail-head div {
  display: grid;
}
.detail-head span {
  color: #777;
  font-size: 0.78rem;
}
.detail-head i {
  font-style: normal;
  font-weight: 800;
}
.candidate-panel,
.preview-panel {
  margin-top: 1.5rem;
}
.candidate-panel > p {
  color: #777;
}
.candidate-empty {
  display: grid;
  justify-items: start;
  gap: 0.7rem;
  margin-top: 1rem;
  padding: 1.2rem;
  border: 1px dashed #c9ced8;
  background: #fffdf8;
}
.candidate-empty span,
.selection-hint {
  color: #777;
  font-size: 0.78rem;
}
.candidate-panel article {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  margin: 0.6rem 0;
  padding: 0.8rem;
  border: 1px solid #dfe2e8;
  background: #fff;
}
.candidate-panel article.low {
  border-left: 4px solid #ff6a4d;
}
.candidate-panel article div {
  display: grid;
  gap: 0.35rem;
}
.candidate-panel article span,
.candidate-panel article small {
  color: #777;
  font-size: 0.72rem;
}
.candidate-panel article small {
  grid-column: 2;
}
.destination {
  display: grid;
  gap: 0.8rem;
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f3f0e7;
}
.preview-panel article {
  margin: 0.6rem 0;
  padding: 1rem;
  border: 1px solid #e1e2e5;
  background: #fff;
}
.preview-panel article > span {
  color: #173fbd;
  font-size: 0.7rem;
  font-weight: 800;
}
.preview-panel pre {
  white-space: pre-wrap;
  font: inherit;
  line-height: 1.7;
}
@media (max-width: 760px) {
  .hero {
    align-items: start;
    flex-direction: column;
    gap: 2rem;
  }
  .hero h1 {
    font-size: 2.4rem;
  }
  .workspace {
    padding-inline: 1rem;
  }
  .usage {
    grid-template-columns: 1fr;
  }
  .candidate-panel article {
    grid-template-columns: auto 1fr;
  }
  .candidate-panel article > b {
    display: none;
  }
}
</style>
