<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import {
  EducationContentSchema,
  ExperienceContentSchema,
  ProjectContentSchema,
  SkillContentSchema,
  UpdateProfileRequestSchema,
  type CreateProfileEntryRequest,
  type Profile,
  type ProfileEntry,
  type ProfileEntryType,
} from '@aceresume/contracts';
import ProfileEntrySection from '@/components/ProfileEntrySection.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import { getApiErrorMessage } from '@/api/http';
import * as profileApi from '@/api/profile';

type ProfileTab = 'basic' | ProfileEntryType;
type EntryForm = {
  id: string | null;
  version: number;
  type: ProfileEntryType;
  primary: string;
  secondary: string;
  degree: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  grade: string;
  ranking: string;
  description: string;
  background: string;
  responsibilities: string;
  technologies: string;
  outcomes: string;
  url: string;
  proficiency: string;
};
const profile = ref<Profile | null>(null);
const basic = reactive({
  fullName: '',
  targetRole: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  summary: '',
});
const activeTab = ref<ProfileTab>('basic');
const entries = ref<ProfileEntry[]>([]);
const page = ref(1);
const total = ref(0);
const isLoading = ref(true);
const isEntriesLoading = ref(false);
const isSaving = ref(false);
const isModalOpen = ref(false);
const entryForm = reactive<EntryForm>(blankEntry('education'));
const tabs: { key: ProfileTab; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'education', label: '教育经历' },
  { key: 'project', label: '项目经历' },
  { key: 'experience', label: '实习 / 工作' },
  { key: 'skill', label: '技能' },
];

function blankEntry(type: ProfileEntryType): EntryForm {
  return {
    id: null,
    version: 1,
    type,
    primary: '',
    secondary: '',
    degree: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    grade: '',
    ranking: '',
    description: '',
    background: '',
    responsibilities: '',
    technologies: '',
    outcomes: '',
    url: '',
    proficiency: '',
  };
}
const nullable = (value: string): string | null => value.trim() || null;
const lines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

async function loadProfile(): Promise<void> {
  isLoading.value = true;
  try {
    profile.value = await profileApi.getProfile();
    Object.assign(basic, {
      fullName: profile.value.fullName ?? '',
      targetRole: profile.value.targetRole ?? '',
      email: profile.value.email ?? '',
      phone: profile.value.phone ?? '',
      location: profile.value.location ?? '',
      website: profile.value.website ?? '',
      summary: profile.value.summary ?? '',
    });
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isLoading.value = false;
  }
}

async function selectTab(tab: ProfileTab): Promise<void> {
  activeTab.value = tab;
  if (tab !== 'basic') await loadEntries(tab, 1);
}

async function loadEntries(type: ProfileEntryType, targetPage: number): Promise<void> {
  isEntriesLoading.value = true;
  try {
    const result = await profileApi.listEntries(type, targetPage);
    entries.value = result.items;
    total.value = result.total;
    page.value = result.page;
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isEntriesLoading.value = false;
  }
}

async function saveBasic(): Promise<void> {
  if (!profile.value) return;
  const parsed = UpdateProfileRequestSchema.safeParse({
    ...basic,
    fullName: nullable(basic.fullName),
    targetRole: nullable(basic.targetRole),
    email: nullable(basic.email),
    phone: nullable(basic.phone),
    location: nullable(basic.location),
    website: nullable(basic.website),
    summary: nullable(basic.summary),
    baseVersion: profile.value.version,
  });
  if (!parsed.success) {
    message.error(parsed.error.issues[0]?.message ?? '请检查基本信息。');
    return;
  }
  isSaving.value = true;
  try {
    profile.value = await profileApi.updateProfile(parsed.data);
    message.success('基本信息已保存。');
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isSaving.value = false;
  }
}

function openCreate(): void {
  Object.assign(entryForm, blankEntry(activeTab.value === 'basic' ? 'education' : activeTab.value));
  isModalOpen.value = true;
}
function openEdit(entry: ProfileEntry): void {
  Object.assign(entryForm, blankEntry(entry.type), { id: entry.id, version: entry.version });
  const content = entry.content;
  if ('school' in content)
    Object.assign(entryForm, {
      primary: content.school,
      secondary: content.major,
      degree: content.degree,
      startDate: content.startDate,
      endDate: content.endDate ?? '',
      isCurrent: content.isCurrent,
      grade: content.grade ?? '',
      ranking: content.ranking ?? '',
      description: content.description ?? '',
    });
  else if ('organization' in content)
    Object.assign(entryForm, {
      primary: content.organization,
      secondary: content.position,
      startDate: content.startDate,
      endDate: content.endDate ?? '',
      isCurrent: content.isCurrent,
      responsibilities: content.responsibilities.join('\n'),
      outcomes: content.outcomes.join('\n'),
      technologies: content.skills.join('\n'),
    });
  else if ('category' in content)
    Object.assign(entryForm, {
      primary: content.name,
      secondary: content.category,
      proficiency: content.proficiency ?? '',
      description: content.description ?? '',
    });
  else
    Object.assign(entryForm, {
      primary: content.name,
      secondary: content.role ?? '',
      startDate: content.startDate,
      endDate: content.endDate ?? '',
      isCurrent: content.isCurrent,
      background: content.background ?? '',
      responsibilities: content.responsibilities.join('\n'),
      technologies: content.technologies.join('\n'),
      outcomes: content.outcomes.join('\n'),
      url: content.url ?? '',
    });
  isModalOpen.value = true;
}

function buildEntryRequest(): CreateProfileEntryRequest {
  const dates = {
    startDate: entryForm.startDate,
    endDate: entryForm.isCurrent ? null : nullable(entryForm.endDate),
    isCurrent: entryForm.isCurrent,
  };
  if (entryForm.type === 'education')
    return {
      type: 'education',
      content: EducationContentSchema.parse({
        schemaVersion: 1,
        school: entryForm.primary,
        major: entryForm.secondary,
        degree: entryForm.degree,
        ...dates,
        grade: nullable(entryForm.grade),
        ranking: nullable(entryForm.ranking),
        description: nullable(entryForm.description),
      }),
    };
  if (entryForm.type === 'project')
    return {
      type: 'project',
      content: ProjectContentSchema.parse({
        schemaVersion: 1,
        name: entryForm.primary,
        role: nullable(entryForm.secondary),
        ...dates,
        background: nullable(entryForm.background),
        responsibilities: lines(entryForm.responsibilities),
        technologies: lines(entryForm.technologies),
        outcomes: lines(entryForm.outcomes),
        url: nullable(entryForm.url),
      }),
    };
  if (entryForm.type === 'experience')
    return {
      type: 'experience',
      content: ExperienceContentSchema.parse({
        schemaVersion: 1,
        organization: entryForm.primary,
        position: entryForm.secondary,
        ...dates,
        responsibilities: lines(entryForm.responsibilities),
        outcomes: lines(entryForm.outcomes),
        skills: lines(entryForm.technologies),
      }),
    };
  return {
    type: 'skill',
    content: SkillContentSchema.parse({
      schemaVersion: 1,
      category: entryForm.secondary,
      name: entryForm.primary,
      proficiency: nullable(entryForm.proficiency),
      description: nullable(entryForm.description),
    }),
  };
}

async function saveEntry(): Promise<void> {
  isSaving.value = true;
  try {
    const request = buildEntryRequest();
    if (entryForm.id)
      await profileApi.updateEntry(entryForm.id, {
        baseVersion: entryForm.version,
        content: request.content,
      });
    else await profileApi.createEntry(request);
    isModalOpen.value = false;
    message.success(entryForm.id ? '资料条目已更新。' : '资料条目已添加。');
    await loadEntries(entryForm.type, page.value);
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isSaving.value = false;
  }
}

async function deleteEntry(entry: ProfileEntry): Promise<void> {
  try {
    await profileApi.deleteEntry(entry.id);
    message.success('资料条目已删除。');
    await loadEntries(entry.type, 1);
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  }
}

async function moveEntry(index: number, direction: -1 | 1): Promise<void> {
  const target = index + direction;
  if (target < 0 || target >= entries.value.length || activeTab.value === 'basic') return;
  const reordered = [...entries.value];
  const [moved] = reordered.splice(index, 1);
  if (!moved) return;
  reordered.splice(target, 0, moved);
  try {
    entries.value = await profileApi.reorderEntries({
      type: activeTab.value,
      orderedIds: reordered.map((entry) => entry.id),
      versions: Object.fromEntries(reordered.map((entry) => [entry.id, entry.version])),
    });
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
    await loadEntries(activeTab.value, page.value);
  }
}

onMounted(() => void loadProfile());
</script>

<template>
  <div class="profile-shell">
    <AppSidebar />
    <main class="profile-main">
      <header class="page-header">
        <div>
          <p>PERSONAL ARCHIVE</p>
          <h1>个人资料</h1>
          <span>维护一次，在不同简历中选择性复用。</span>
        </div>
        <div class="completion">
          <b>{{ profile?.fullName ? '资料已建立' : '等待完善' }}</b
          ><span>修改不会自动覆盖已有简历</span>
        </div>
      </header>
      <nav class="profile-tabs" aria-label="个人资料分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="selectTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
        </button>
      </nav>
      <div class="content-area">
        <a-skeleton v-if="isLoading" active :paragraph="{ rows: 8 }" />
        <form v-else-if="activeTab === 'basic'" class="basic-card" @submit.prevent="saveBasic">
          <div class="section-heading">
            <div>
              <p>BASIC PROFILE</p>
              <h2>基本信息</h2>
            </div>
            <span>版本 {{ profile?.version }}</span>
          </div>
          <div class="form-grid">
            <label
              ><span>姓名</span><a-input v-model:value="basic.fullName" placeholder="你的姓名"
            /></label>
            <label
              ><span>求职意向</span
              ><a-input v-model:value="basic.targetRole" placeholder="前端开发工程师"
            /></label>
            <label><span>联系邮箱</span><a-input v-model:value="basic.email" type="email" /></label>
            <label><span>电话</span><a-input v-model:value="basic.phone" /></label>
            <label><span>所在地</span><a-input v-model:value="basic.location" /></label>
            <label
              ><span>个人网站</span><a-input v-model:value="basic.website" placeholder="https://"
            /></label>
            <label class="wide"
              ><span>个人简介</span
              ><a-textarea v-model:value="basic.summary" :rows="5" :maxlength="2000" show-count
            /></label>
          </div>
          <button class="save-button" type="submit" :disabled="isSaving">
            {{ isSaving ? '保存中…' : '保存基本信息' }}
          </button>
        </form>
        <ProfileEntrySection
          v-else
          :type="activeTab"
          :entries="entries"
          :is-loading="isEntriesLoading"
          @add="openCreate"
          @edit="openEdit"
          @delete="deleteEntry"
          @move="moveEntry"
        />
        <a-pagination
          v-if="activeTab !== 'basic' && total > 20"
          :current="page"
          :total="total"
          :page-size="20"
          :show-size-changer="false"
          @change="(value: number) => loadEntries(activeTab as ProfileEntryType, value)"
        />
      </div>
    </main>
    <a-modal
      v-model:open="isModalOpen"
      :title="entryForm.id ? '编辑资料条目' : '新增资料条目'"
      :confirm-loading="isSaving"
      ok-text="保存"
      cancel-text="取消"
      width="720px"
      @ok="saveEntry"
    >
      <div class="entry-form">
        <label
          ><span>{{
            entryForm.type === 'education'
              ? '学校'
              : entryForm.type === 'experience'
                ? '组织'
                : entryForm.type === 'skill'
                  ? '技能名称'
                  : '项目名称'
          }}</span
          ><a-input v-model:value="entryForm.primary"
        /></label>
        <label
          ><span>{{
            entryForm.type === 'education'
              ? '专业'
              : entryForm.type === 'experience'
                ? '职位'
                : entryForm.type === 'skill'
                  ? '分类'
                  : '角色'
          }}</span
          ><a-input v-model:value="entryForm.secondary"
        /></label>
        <template v-if="entryForm.type !== 'skill'">
          <label v-if="entryForm.type === 'education'"
            ><span>学历</span><a-input v-model:value="entryForm.degree"
          /></label>
          <label
            ><span>开始时间</span
            ><a-input v-model:value="entryForm.startDate" placeholder="YYYY-MM"
          /></label>
          <label
            ><span>结束时间</span
            ><a-input
              v-model:value="entryForm.endDate"
              :disabled="entryForm.isCurrent"
              placeholder="YYYY-MM"
          /></label>
          <label class="checkbox"
            ><a-checkbox v-model:checked="entryForm.isCurrent">仍在进行</a-checkbox></label
          >
        </template>
        <template v-if="entryForm.type === 'education'">
          <label><span>绩点</span><a-input v-model:value="entryForm.grade" /></label
          ><label><span>排名</span><a-input v-model:value="entryForm.ranking" /></label>
        </template>
        <label v-if="entryForm.type === 'skill'"
          ><span>熟练度（可选）</span><a-input v-model:value="entryForm.proficiency"
        /></label>
        <label v-if="entryForm.type === 'project'" class="wide"
          ><span>项目背景</span><a-textarea v-model:value="entryForm.background" :rows="3"
        /></label>
        <label v-if="entryForm.type === 'project' || entryForm.type === 'experience'" class="wide"
          ><span>职责（每行一项）</span
          ><a-textarea v-model:value="entryForm.responsibilities" :rows="4"
        /></label>
        <label v-if="entryForm.type === 'project' || entryForm.type === 'experience'" class="wide"
          ><span>{{ entryForm.type === 'project' ? '技术栈' : '相关技能' }}（每行一项）</span
          ><a-textarea v-model:value="entryForm.technologies" :rows="3"
        /></label>
        <label v-if="entryForm.type === 'project' || entryForm.type === 'experience'" class="wide"
          ><span>成果（每行一项）</span><a-textarea v-model:value="entryForm.outcomes" :rows="3"
        /></label>
        <label v-if="entryForm.type === 'project'"
          ><span>项目链接</span><a-input v-model:value="entryForm.url" placeholder="https://"
        /></label>
        <label v-if="entryForm.type === 'education' || entryForm.type === 'skill'" class="wide"
          ><span>补充说明</span><a-textarea v-model:value="entryForm.description" :rows="4"
        /></label>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.profile-shell {
  min-height: 100vh;
  display: flex;
  background: #f8f7f2;
}
.profile-main {
  min-width: 0;
  flex: 1;
}
.profile-tabs {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 1rem 3rem 0;
  background: rgb(255 253 248 / 75%);
}
.profile-tabs button {
  min-width: max-content;
  padding: 0.65rem 1rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #717783;
}
.profile-tabs button.active {
  border-bottom-color: var(--brand-blue);
  color: var(--brand-blue);
  font-weight: 700;
}
.page-header {
  display: flex;
  min-height: 9rem;
  align-items: center;
  justify-content: space-between;
  padding: 2rem 3rem;
  border-bottom: 1px solid var(--line-color);
  background: rgb(255 253 248 / 75%);
}
.page-header p,
.section-heading p {
  margin: 0;
  color: var(--brand-blue);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.page-header h1 {
  margin: 0.4rem 0;
  font-family: var(--serif);
  font-size: 2.3rem;
}
.page-header > div > span {
  color: var(--muted-color);
  font-size: 0.8rem;
}
.completion {
  padding-left: 1.2rem;
  border-left: 3px solid var(--coral);
}
.completion b,
.completion span {
  display: block;
}
.completion span {
  margin-top: 0.3rem;
  color: var(--muted-color);
  font-size: 0.7rem;
}
.content-area {
  display: grid;
  gap: 1rem;
  padding: 2rem 3rem 4rem;
}
.basic-card {
  padding: 2rem 2.25rem;
  border: 1px solid var(--line-color);
  background: white;
  box-shadow: 0 1rem 3rem rgb(23 32 51 / 6%);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.7rem;
  padding-bottom: 1.3rem;
  border-bottom: 1px solid var(--line-color);
}
.section-heading h2 {
  margin: 0.35rem 0 0;
  font-family: var(--serif);
  font-size: 1.6rem;
}
.section-heading > span {
  color: var(--muted-color);
  font-size: 0.7rem;
}
.form-grid,
.entry-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.2rem;
}
.form-grid label > span,
.entry-form label > span {
  display: block;
  margin-bottom: 0.45rem;
  color: #5c6573;
  font-size: 0.72rem;
  font-weight: 700;
}
.wide {
  grid-column: 1 / -1;
}
.checkbox {
  align-self: end;
  padding-bottom: 0.4rem;
}
.save-button {
  min-height: 2.7rem;
  margin-top: 1.5rem;
  padding: 0 1.2rem;
  border: 0;
  background: var(--brand-blue);
  color: white;
  font-weight: 700;
  box-shadow: 4px 4px 0 var(--ink-color);
}
@media (max-width: 900px) {
  .page-header,
  .content-area,
  .profile-tabs {
    padding-right: 1.2rem;
    padding-left: 1.2rem;
  }
  .form-grid,
  .entry-form {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
