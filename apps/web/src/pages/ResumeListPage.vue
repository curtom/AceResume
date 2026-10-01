<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import type {
  ProfileEntry,
  ProfileEntryType,
  ResumeStatus,
  ResumeSummary,
  TemplateSummary,
} from '@aceresume/contracts';
import { getApiErrorMessage } from '@/api/http';
import * as profileApi from '@/api/profile';
import * as resumeApi from '@/api/resume';
import { listTemplates } from '@/api/template';
import AppSidebar from '@/components/AppSidebar.vue';

const router = useRouter();
const route = useRoute();
const status = ref<ResumeStatus>('active');
const items = ref<ResumeSummary[]>([]);
const total = ref(0);
const overallTotal = ref(0);
const isLoading = ref(true);
const isCreating = ref(false);
const isCreateOpen = ref(false);
const isRenameOpen = ref(false);
const editingResume = ref<ResumeSummary | null>(null);
const profileEntries = ref<ProfileEntry[]>([]);
const selectedProfileIds = ref<string[]>([]);
const templates = ref<TemplateSummary[]>([]);
const createForm = reactive({
  mode: 'blank' as 'blank' | 'profile',
  name: '我的简历',
  targetRole: '',
  templateVersionId: 'classic-single-v1',
});
const renameValue = ref('');
const remaining = computed(() => Math.max(0, 6 - overallTotal.value));
const templateName = (versionId: string): string =>
  templates.value.find((item) => item.versionId === versionId)?.name ?? versionId;
const entryLabel = (entry: ProfileEntry): string => {
  if (entry.type === 'education') return entry.content.school + ' · ' + entry.content.major;
  if (entry.type === 'experience')
    return entry.content.organization + ' · ' + entry.content.position;
  if (entry.type === 'project') return entry.content.name;
  if (entry.type === 'campus') return entry.content.organization + ' · ' + entry.content.role;
  return entry.content.description?.split('\n')[0] || '专业技能';
};
async function load(): Promise<void> {
  isLoading.value = true;
  try {
    const [result, other] = await Promise.all([
      resumeApi.listResumes(status.value),
      resumeApi.listResumes(status.value === 'active' ? 'archived' : 'active'),
    ]);
    items.value = result.items;
    total.value = result.total;
    overallTotal.value = result.total + other.total;
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isLoading.value = false;
  }
}
async function changeStatus(value: ResumeStatus): Promise<void> {
  status.value = value;
  await load();
}
async function openCreate(mode: 'blank' | 'profile'): Promise<void> {
  createForm.mode = mode;
  createForm.name = mode === 'blank' ? '我的简历' : '资料库简历';
  createForm.targetRole = '';
  selectedProfileIds.value = [];
  if (typeof route.query.template === 'string') createForm.templateVersionId = route.query.template;
  isCreateOpen.value = true;
  if (mode === 'profile' && !profileEntries.value.length) {
    try {
      const types: ProfileEntryType[] = ['education', 'experience', 'project', 'campus', 'skill'];
      const pages = await Promise.all(types.map((type) => profileApi.listEntries(type, 1)));
      profileEntries.value = pages.flatMap((page) => page.items);
      selectedProfileIds.value = profileEntries.value.map((entry) => entry.id);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    }
  }
}
async function createResume(): Promise<void> {
  if (!createForm.name.trim()) return;
  isCreating.value = true;
  try {
    const common = {
      name: createForm.name.trim(),
      targetRole: createForm.targetRole.trim() || null,
      locale: 'zh-CN' as const,
      templateVersionId: createForm.templateVersionId,
    };
    const detail = await resumeApi.createResume(
      createForm.mode === 'profile'
        ? { mode: 'profile', ...common, profileEntryIds: selectedProfileIds.value }
        : { mode: 'blank', ...common },
    );
    isCreateOpen.value = false;
    await router.push('/resumes/' + detail.id + '/edit');
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isCreating.value = false;
  }
}
async function duplicate(item: ResumeSummary): Promise<void> {
  try {
    const result = await resumeApi.duplicateResume(item.id);
    await router.push('/resumes/' + result.id + '/edit');
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
async function toggleArchive(item: ResumeSummary): Promise<void> {
  try {
    await resumeApi.setResumeArchived(item.id, item.version, item.status === 'active');
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
async function remove(item: ResumeSummary): Promise<void> {
  try {
    await resumeApi.deleteResume(item.id);
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
function openRename(item: ResumeSummary): void {
  editingResume.value = item;
  renameValue.value = item.name;
  isRenameOpen.value = true;
}
async function rename(): Promise<void> {
  if (!editingResume.value || !renameValue.value.trim()) return;
  try {
    await resumeApi.updateResume(editingResume.value.id, {
      baseVersion: editingResume.value.version,
      name: renameValue.value.trim(),
      targetRole: editingResume.value.targetRole,
    });
    isRenameOpen.value = false;
    await load();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}
onMounted(async () => {
  await Promise.all([
    load(),
    listTemplates()
      .then((items) => {
        templates.value = items;
      })
      .catch((error: unknown) => {
        message.error(getApiErrorMessage(error));
      }),
  ]);
  if (route.query.create === '1' && overallTotal.value < 6) await openCreate('blank');
});
</script>

<template>
  <div class="resume-shell">
    <AppSidebar :resume-count="overallTotal" />
    <main class="resume-home">
      <header class="hero">
        <div>
          <p>RESUME WORKBENCH</p>
          <h1>你的简历，保持清晰。</h1>
          <span>一次只打磨一份可信、可读的职业叙事。</span>
        </div>
        <div class="quota">
          <strong>{{ overallTotal }} / 6</strong><span>全部简历 · 还可创建 {{ remaining }} 份</span>
        </div>
      </header>
      <section class="workspace">
        <div class="toolbar">
          <div class="tabs">
            <button :class="{ active: status === 'active' }" @click="changeStatus('active')">
              编辑中的简历</button
            ><button :class="{ active: status === 'archived' }" @click="changeStatus('archived')">
              已归档
            </button>
          </div>
          <button class="primary" :disabled="overallTotal >= 6" @click="openCreate('blank')">
            ＋ 新建简历
          </button>
        </div>
        <a-skeleton v-if="isLoading" active :paragraph="{ rows: 8 }" />
        <div v-else-if="items.length" class="resume-grid">
          <article v-for="item in items" :key="item.id" class="resume-card">
            <div class="paper" @click="router.push('/resumes/' + item.id + '/edit')">
              <i />
              <h3>{{ item.name }}</h3>
              <p>{{ item.targetRole || '尚未填写求职意向' }}</p>
              <span>{{ templateName(item.templateVersionId) }}</span>
            </div>
            <footer>
              <div>
                <strong>{{ item.name }}</strong
                ><small>{{ new Date(item.updatedAt).toLocaleString('zh-CN') }}</small>
              </div>
              <a-dropdown>
                <button class="more" type="button">•••</button>
                <template #overlay
                  ><a-menu>
                    <a-menu-item @click="router.push('/resumes/' + item.id + '/edit')"
                      >继续编辑</a-menu-item
                    >
                    <a-menu-item @click="openRename(item)">重命名</a-menu-item>
                    <a-menu-item @click="duplicate(item)">创建副本</a-menu-item>
                    <a-menu-item @click="toggleArchive(item)">{{
                      item.status === 'active' ? '归档' : '移回编辑中'
                    }}</a-menu-item>
                    <a-menu-item danger
                      ><a-popconfirm title="删除后不可恢复，确定吗？" @confirm="remove(item)"
                        >删除</a-popconfirm
                      ></a-menu-item
                    >
                  </a-menu></template
                >
              </a-dropdown>
            </footer>
          </article>
        </div>
        <div v-else class="empty-state">
          <b>01</b>
          <h2>{{ status === 'active' ? '从第一份简历开始' : '这里还没有归档简历' }}</h2>
          <p>可以创建空白简历，也可以从个人资料库选取经历生成初稿。</p>
          <button v-if="status === 'active'" class="primary" @click="openCreate('blank')">
            创建空白简历
          </button>
        </div>
      </section>
      <a-modal
        v-model:open="isCreateOpen"
        title="创建简历"
        :confirm-loading="isCreating"
        ok-text="创建并编辑"
        @ok="createResume"
      >
        <div class="create-options">
          <button
            :class="{ selected: createForm.mode === 'blank' }"
            @click="createForm.mode = 'blank'"
          >
            <b>空白简历</b><span>从标准模块开始填写</span>
          </button>
          <button
            :class="{ selected: createForm.mode === 'profile' }"
            @click="openCreate('profile')"
          >
            <b>从资料库创建</b><span>选择已有经历生成快照</span>
          </button>
          <button @click="router.push('/documents?import=1')">
            <b>导入旧简历</b><span>上传后逐项确认</span>
          </button>
        </div>
        <label
          ><span>简历名称</span><a-input v-model:value="createForm.name" :maxlength="120"
        /></label>
        <label
          ><span>求职意向（可选）</span><a-input v-model:value="createForm.targetRole"
        /></label>
        <label
          ><span>简历模板</span
          ><a-select v-model:value="createForm.templateVersionId">
            <a-select-option
              v-for="template in templates"
              :key="template.versionId"
              :value="template.versionId"
            >
              {{ template.name }} · {{ template.layout === 'two-column' ? '双栏' : '单栏' }}
            </a-select-option>
          </a-select></label
        >
        <div v-if="createForm.mode === 'profile'" class="profile-picker">
          <p>选择写入本简历的资料条目</p>
          <a-checkbox-group v-model:value="selectedProfileIds">
            <a-checkbox v-for="entry in profileEntries" :key="entry.id" :value="entry.id">{{
              entryLabel(entry)
            }}</a-checkbox>
          </a-checkbox-group>
          <a-empty v-if="!profileEntries.length" description="资料库还没有经历条目" />
        </div>
      </a-modal>
      <a-modal v-model:open="isRenameOpen" title="重命名简历" ok-text="保存" @ok="rename"
        ><a-input v-model:value="renameValue" :maxlength="120"
      /></a-modal>
    </main>
  </div>
</template>

<style scoped>
.resume-shell {
  display: flex;
  min-height: 100vh;
  background: #f7f5ef;
}
.resume-home {
  min-width: 0;
  flex: 1;
  background: #f7f5ef;
  color: #19283f;
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 4.5rem 7vw 3.5rem;
  background: #fffdf8;
  border-bottom: 1px solid #d9dde5;
}
.hero p {
  color: #173fbd;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.2em;
}
.hero h1 {
  margin: 0.5rem 0;
  font: 3.4rem/1.1 var(--serif);
}
.hero span {
  color: #6e7480;
}
.quota {
  display: grid;
  padding: 1.2rem 1.5rem;
  border-left: 5px solid #ff6a4d;
  background: #f2eee3;
}
.quota strong {
  font-size: 1.6rem;
}
.quota span {
  font-size: 0.78rem;
}
.workspace {
  padding: 2.5rem 7vw 5rem;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  margin: 1rem 0 2rem;
}
.tabs {
  display: flex;
  gap: 1.5rem;
}
.tabs button {
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  padding: 0.7rem 0;
  color: #7a7f89;
}
.tabs button.active {
  border-color: #173fbd;
  color: #173fbd;
  font-weight: 700;
}
.primary {
  border: 0;
  background: #173fbd;
  color: #fff;
  padding: 0.85rem 1.3rem;
  font-weight: 700;
  box-shadow: 5px 5px 0 #ff6a4d;
}
.primary:disabled {
  opacity: 0.45;
  box-shadow: none;
}
.resume-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 2rem;
}
.paper {
  aspect-ratio: 210/260;
  padding: 2rem;
  background: #fff;
  border: 1px solid #d7dbe2;
  box-shadow: 0 12px 30px rgba(28, 39, 65, 0.08);
  cursor: pointer;
  transition: 0.2s;
}
.paper:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(28, 39, 65, 0.14);
}
.paper i {
  display: block;
  width: 35%;
  height: 3px;
  background: #173fbd;
}
.paper h3 {
  margin: 2rem 0 0.5rem;
  font: 1.5rem var(--serif);
}
.paper p {
  color: #687183;
}
.paper span {
  display: block;
  margin-top: 2rem;
  padding-top: 0.7rem;
  border-top: 1px solid #d9dde5;
  color: #9a7180;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}
.resume-card footer {
  display: flex;
  justify-content: space-between;
  padding: 0.9rem 0.2rem;
}
.resume-card footer div {
  display: grid;
}
.resume-card small {
  color: #8b9099;
  margin-top: 0.2rem;
}
.more {
  border: 0;
  background: none;
  font-weight: 800;
}
.empty-state {
  text-align: center;
  padding: 6rem 1rem;
  border: 1px dashed #bdc4cf;
  background: #fffdf8;
}
.empty-state b {
  color: #ff6a4d;
  font: 4rem var(--serif);
}
.empty-state h2 {
  font: 2rem var(--serif);
}
.create-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.7rem;
  margin-bottom: 1.2rem;
}
.create-options button {
  display: grid;
  gap: 0.35rem;
  text-align: left;
  border: 1px solid #d9dde5;
  background: #fff;
  padding: 1rem;
}
.create-options button.selected {
  border: 2px solid #173fbd;
  background: #f1f4ff;
}
.create-options span {
  font-size: 0.75rem;
  color: #777;
}
label {
  display: grid;
  gap: 0.4rem;
  margin: 0.8rem 0;
  color: #4d5869;
}
.profile-picker {
  max-height: 15rem;
  overflow: auto;
  padding: 1rem;
  background: #f5f6f8;
}
.profile-picker :deep(.ant-checkbox-group) {
  display: grid;
  gap: 0.55rem;
}
@media (max-width: 700px) {
  .hero {
    align-items: start;
    gap: 2rem;
    flex-direction: column;
  }
  .hero h1 {
    font-size: 2.4rem;
  }
  .workspace {
    padding-inline: 1rem;
  }
  .create-options {
    grid-template-columns: 1fr;
  }
}
</style>
