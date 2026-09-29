<script setup lang="ts">
import { ref } from 'vue';
import {
  ResumeSectionSchema,
  EMPTY_RICH_TEXT,
  type ResumeSection,
  type RichTextDocument,
} from '@aceresume/resume-schema';
import ResumeRichTextEditor from './ResumeRichTextEditor.vue';

const props = defineProps<{
  section: ResumeSection;
  targetRole?: string | null;
  avatarUrl?: string | null;
  isAvatarBusy?: boolean;
}>();
const emit = defineEmits<{
  update: [section: ResumeSection];
  updateTarget: [value: string];
  uploadAvatar: [file: globalThis.File];
  removeAvatar: [];
  remove: [];
}>();
const avatarInput = ref<globalThis.HTMLInputElement | null>(null);
const copy = (): ResumeSection => JSON.parse(JSON.stringify(props.section));
function commit(change: (section: ResumeSection) => void): void {
  const next = copy();
  change(next);
  const parsed = ResumeSectionSchema.safeParse(next);
  if (parsed.success) emit('update', parsed.data);
}
function setBasic(
  field: 'fullName' | 'email' | 'phone' | 'location' | 'website',
  value: string,
): void {
  commit((section) => {
    if (section.type === 'basic') section.content[field] = value || null;
  });
}
function setTarget(value: string): void {
  emit('updateTarget', value);
}
function selectAvatar(event: globalThis.Event): void {
  const input = event.target as globalThis.HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('uploadAvatar', file);
  input.value = '';
}
function setBody(value: RichTextDocument): void {
  commit((section) => {
    if (section.type === 'summary' || section.type === 'custom') section.content.body = value;
  });
}
function updateEntry(index: number, field: string, value: unknown): void {
  commit((section) => {
    if (!('entries' in section.content)) return;
    const entry = section.content.entries[index];
    if (entry) Reflect.set(entry, field, value);
  });
}
function addEntry(): void {
  commit((section) => {
    if (!('entries' in section.content)) return;
    const base = { id: globalThis.crypto.randomUUID(), sortOrder: section.content.entries.length };
    const rich = JSON.parse(JSON.stringify(EMPTY_RICH_TEXT));
    const month = new Date().toISOString().slice(0, 7);
    const entry =
      section.type === 'education'
        ? {
            ...base,
            school: '',
            major: '',
            degree: '',
            startDate: month,
            endDate: null,
            isCurrent: true,
            grade: null,
            ranking: null,
            description: rich,
          }
        : section.type === 'experience'
          ? {
              ...base,
              organization: '',
              position: '',
              location: null,
              startDate: month,
              endDate: null,
              isCurrent: true,
              description: rich,
            }
          : section.type === 'project'
            ? {
                ...base,
                name: '',
                role: null,
                technologies: [],
                url: null,
                startDate: month,
                endDate: null,
                isCurrent: true,
                description: rich,
              }
            : section.type === 'campus'
              ? {
                  ...base,
                  organization: '',
                  role: '',
                  startDate: month,
                  endDate: null,
                  isCurrent: true,
                  description: rich,
                }
              : section.type === 'skill'
                ? { ...base, category: '', name: '', proficiency: null, description: rich }
                : section.type === 'award'
                  ? { ...base, name: '', issuer: null, awardedAt: null, description: rich }
                  : null;
    if (entry) Reflect.apply(Array.prototype.push, section.content.entries, [entry]);
  });
}
function removeEntry(index: number): void {
  commit((section) => {
    if (!('entries' in section.content)) return;
    Reflect.apply(Array.prototype.splice, section.content.entries, [index, 1]);
    section.content.entries.forEach((entry, sortOrder) => {
      entry.sortOrder = sortOrder;
    });
  });
}
function moveEntry(index: number, direction: -1 | 1): void {
  commit((section) => {
    if (!('entries' in section.content)) return;
    const target = index + direction;
    if (target < 0 || target >= section.content.entries.length) return;
    const removed: unknown[] = Reflect.apply(Array.prototype.splice, section.content.entries, [
      index,
      1,
    ]);
    const entry = removed[0];
    if (entry) Reflect.apply(Array.prototype.splice, section.content.entries, [target, 0, entry]);
    section.content.entries.forEach((item, sortOrder) => {
      item.sortOrder = sortOrder;
    });
  });
}
</script>

<template>
  <section class="section-editor">
    <div v-if="section.type === 'custom'" class="section-title">
      <a-popconfirm title="删除这个自定义模块？" @confirm="emit('remove')">
        <button class="danger-link" type="button">删除模块</button>
      </a-popconfirm>
    </div>
    <div v-if="section.type === 'basic'" class="field-grid">
      <div class="avatar-field wide">
        <span>个人头像</span>
        <div class="avatar-control">
          <img v-if="avatarUrl" :src="avatarUrl" alt="当前简历头像" />
          <div v-else class="avatar-placeholder">暂无头像</div>
          <div class="avatar-actions">
            <label class="avatar-upload">
              {{ isAvatarBusy ? '处理中…' : avatarUrl ? '更换头像' : '上传头像' }}
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="isAvatarBusy"
                @change="selectAvatar"
              />
            </label>
            <button
              v-if="avatarUrl"
              type="button"
              :disabled="isAvatarBusy"
              @click="emit('removeAvatar')"
            >
              移除头像
            </button>
            <small>支持 JPG、PNG、WebP，文件不超过 2 MB</small>
          </div>
        </div>
      </div>
      <label
        v-for="field in ['fullName', 'email', 'phone', 'location', 'website'] as const"
        :key="field"
      >
        <span>{{
          {
            fullName: '姓名',
            email: '邮箱',
            phone: '电话',
            location: '所在地',
            website: '个人网站',
          }[field]
        }}</span>
        <a-input
          :value="section.content[field] ?? ''"
          @change="setBasic(field, $event.target.value)"
        />
      </label>
      <label
        ><span>求职意向</span
        ><a-input
          :value="targetRole ?? ''"
          placeholder="例如：前端开发工程师"
          @change="setTarget($event.target.value)"
      /></label>
    </div>
    <label v-else-if="section.type === 'target'"
      ><span>目标职位</span
      ><a-input :value="section.content.role ?? ''" @change="setTarget($event.target.value)"
    /></label>
    <ResumeRichTextEditor
      v-else-if="section.type === 'summary' || section.type === 'custom'"
      :model-value="section.content.body"
      @update:model-value="setBody"
    />
    <template v-else-if="section.type === 'skill'">
      <article v-for="(entry, index) in section.content.entries" :key="entry.id" class="entry-card">
        <div class="entry-actions">
          <b>条目 {{ index + 1 }}</b>
          <span>
            <button type="button" :disabled="index === 0" @click="moveEntry(index, -1)">↑</button>
            <button
              type="button"
              :disabled="index === section.content.entries.length - 1"
              @click="moveEntry(index, 1)"
            >
              ↓
            </button>
            <button type="button" @click="removeEntry(index)">删除</button>
          </span>
        </div>
        <label
          ><span>内容描述</span
          ><ResumeRichTextEditor
            :model-value="entry.description"
            @update:model-value="updateEntry(index, 'description', $event)"
        /></label>
      </article>
      <button class="add-entry" type="button" @click="addEntry">＋ 添加条目</button>
    </template>
    <template v-else>
      <article v-for="(entry, index) in section.content.entries" :key="entry.id" class="entry-card">
        <div class="entry-actions">
          <b>条目 {{ index + 1 }}</b>
          <span>
            <button type="button" :disabled="index === 0" @click="moveEntry(index, -1)">↑</button>
            <button
              type="button"
              :disabled="index === section.content.entries.length - 1"
              @click="moveEntry(index, 1)"
            >
              ↓
            </button>
            <button type="button" @click="removeEntry(index)">删除</button>
          </span>
        </div>
        <div class="field-grid">
          <template v-if="'school' in entry">
            <label
              ><span>学校</span
              ><a-input
                :value="entry.school"
                @change="updateEntry(index, 'school', $event.target.value)"
            /></label>
            <label
              ><span>专业</span
              ><a-input
                :value="entry.major"
                @change="updateEntry(index, 'major', $event.target.value)"
            /></label>
            <label
              ><span>学历</span
              ><a-input
                :value="entry.degree"
                @change="updateEntry(index, 'degree', $event.target.value)"
            /></label>
          </template>
          <template v-else-if="'position' in entry">
            <label
              ><span>组织 / 公司</span
              ><a-input
                :value="entry.organization"
                @change="updateEntry(index, 'organization', $event.target.value)"
            /></label>
            <label
              ><span>职位</span
              ><a-input
                :value="entry.position"
                @change="updateEntry(index, 'position', $event.target.value)"
            /></label>
          </template>
          <template v-else-if="'technologies' in entry">
            <label
              ><span>项目名称</span
              ><a-input
                :value="entry.name"
                @change="updateEntry(index, 'name', $event.target.value)"
            /></label>
            <label
              ><span>担任角色</span
              ><a-input
                :value="entry.role ?? ''"
                @change="updateEntry(index, 'role', $event.target.value || null)"
            /></label>
          </template>
          <template v-else-if="'awardedAt' in entry">
            <label
              ><span>奖项名称</span
              ><a-input
                :value="entry.name"
                @change="updateEntry(index, 'name', $event.target.value)"
            /></label>
            <label
              ><span>颁发方</span
              ><a-input
                :value="entry.issuer ?? ''"
                @change="updateEntry(index, 'issuer', $event.target.value || null)"
            /></label>
            <label
              ><span>获奖时间</span
              ><a-input
                :value="entry.awardedAt ?? ''"
                placeholder="YYYY-MM"
                @change="updateEntry(index, 'awardedAt', $event.target.value || null)"
            /></label>
          </template>
          <template v-else>
            <label
              ><span>组织</span
              ><a-input
                :value="entry.organization"
                @change="updateEntry(index, 'organization', $event.target.value)"
            /></label>
            <label
              ><span>角色</span
              ><a-input
                :value="entry.role"
                @change="updateEntry(index, 'role', $event.target.value)"
            /></label>
          </template>
          <template v-if="'startDate' in entry">
            <div class="date-range-fields">
              <label class="start-date-field"
                ><span>开始时间</span
                ><a-date-picker
                  :value="entry.startDate"
                  class="month-picker"
                  picker="month"
                  format="YYYY年MM月"
                  value-format="YYYY-MM"
                  :allow-clear="false"
                  placeholder="选择开始月份"
                  @change="updateEntry(index, 'startDate', $event)"
              /></label>
              <label class="end-date-field"
                ><span>结束时间</span>
                <div class="end-date-control">
                  <a-date-picker
                    :disabled="entry.isCurrent"
                    :value="entry.endDate"
                    class="month-picker"
                    picker="month"
                    format="YYYY年MM月"
                    value-format="YYYY-MM"
                    placeholder="选择结束月份"
                    @change="updateEntry(index, 'endDate', $event || null)"
                  />
                  <a-checkbox
                    :checked="entry.isCurrent"
                    @change="updateEntry(index, 'isCurrent', $event.target.checked)"
                    >至今</a-checkbox
                  >
                </div></label
              >
            </div>
          </template>
          <label v-if="'description' in entry" class="wide"
            ><span>内容描述</span
            ><ResumeRichTextEditor
              :model-value="entry.description"
              @update:model-value="updateEntry(index, 'description', $event)"
          /></label>
        </div>
      </article>
      <button class="add-entry" type="button" @click="addEntry">＋ 添加条目</button>
    </template>
  </section>
</template>

<style scoped>
.section-editor {
  display: grid;
  gap: 1rem;
}
.section-title {
  display: flex;
  align-items: end;
  justify-content: end;
  gap: 1rem;
  border-bottom: 1px solid #e1e5ec;
  padding-bottom: 1rem;
}
label {
  display: grid;
  gap: 0.4rem;
  color: #445168;
  font-size: 0.82rem;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
.wide {
  grid-column: 1 / -1;
}
.date-range-fields {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
  align-items: end;
  gap: 0.85rem;
}
.month-picker {
  width: 20rem;
  max-width: 100%;
}
.end-date-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.end-date-control .month-picker {
  flex: 0 1 20rem;
}
.end-date-control :deep(.ant-checkbox-wrapper) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  white-space: nowrap;
}
.avatar-field {
  display: grid;
  gap: 0.4rem;
  color: #445168;
  font-size: 0.82rem;
}
.avatar-control {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid #e0e4eb;
  border-radius: 8px;
  background: #fafbfc;
}
.avatar-control img,
.avatar-placeholder {
  width: 4.5rem;
  height: 5.6rem;
  flex: 0 0 auto;
  border-radius: 5px;
}
.avatar-control img {
  object-fit: cover;
}
.avatar-placeholder {
  display: grid;
  place-items: center;
  border: 1px dashed #b8c1d0;
  color: #8a94a5;
  font-size: 0.7rem;
}
.avatar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}
.avatar-actions button,
.avatar-upload {
  padding: 0.48rem 0.75rem;
  border: 1px solid #8fa4cc;
  border-radius: 5px;
  background: #fff;
  color: #173fbd;
  cursor: pointer;
}
.avatar-actions button:disabled,
.avatar-upload:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}
.avatar-upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}
.avatar-actions small {
  flex-basis: 100%;
  color: #7b8494;
}
.entry-card {
  padding: 1rem;
  border: 1px solid #e0e4eb;
  border-radius: 8px;
  background: #fafbfc;
}
.entry-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.8rem;
  color: #25334b;
}
.entry-actions button,
.danger-link {
  border: 0;
  background: transparent;
  color: #7a5460;
}
.add-entry {
  padding: 0.7rem;
  border: 1px dashed #8fa4cc;
  background: #f4f7ff;
  color: #173fbd;
}
@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
  .date-range-fields {
    grid-template-columns: 1fr;
  }
}
</style>
