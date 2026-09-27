<script setup lang="ts">
import {
  ResumeSectionSchema,
  EMPTY_RICH_TEXT,
  type ResumeSection,
  type RichTextDocument,
} from '@aceresume/resume-schema';
import ResumeRichTextEditor from './ResumeRichTextEditor.vue';

const props = defineProps<{ section: ResumeSection }>();
const emit = defineEmits<{ update: [section: ResumeSection]; remove: [] }>();
const copy = (): ResumeSection => JSON.parse(JSON.stringify(props.section));
function commit(change: (section: ResumeSection) => void): void {
  const next = copy();
  change(next);
  const parsed = ResumeSectionSchema.safeParse(next);
  if (parsed.success) emit('update', parsed.data);
}
function setTitle(value: string): void {
  if (value.trim())
    commit((section) => {
      section.title = value;
    });
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
  commit((section) => {
    if (section.type === 'target') section.content.role = value || null;
  });
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
    <div class="section-title">
      <label
        ><span>模块标题</span
        ><a-input :value="section.title" @change="setTitle($event.target.value)"
      /></label>
      <a-popconfirm
        v-if="section.type === 'custom'"
        title="删除这个自定义模块？"
        @confirm="emit('remove')"
      >
        <button class="danger-link" type="button">删除模块</button>
      </a-popconfirm>
    </div>
    <div v-if="section.type === 'basic'" class="field-grid">
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
            <label
              ><span>地点</span
              ><a-input
                :value="entry.location ?? ''"
                @change="updateEntry(index, 'location', $event.target.value || null)"
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
            <label class="wide"
              ><span>技术栈（用逗号分隔）</span
              ><a-input
                :value="entry.technologies.join(', ')"
                @change="
                  updateEntry(
                    index,
                    'technologies',
                    $event.target.value
                      .split(',')
                      .map((v: string) => v.trim())
                      .filter(Boolean),
                  )
                "
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
          <template v-else-if="'proficiency' in entry">
            <label
              ><span>分类</span
              ><a-input
                :value="entry.category"
                @change="updateEntry(index, 'category', $event.target.value)"
            /></label>
            <label
              ><span>技能名称</span
              ><a-input
                :value="entry.name"
                @change="updateEntry(index, 'name', $event.target.value)"
            /></label>
            <label
              ><span>熟练度</span
              ><a-input
                :value="entry.proficiency ?? ''"
                @change="updateEntry(index, 'proficiency', $event.target.value || null)"
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
            <label
              ><span>开始时间</span
              ><a-input
                :value="entry.startDate"
                placeholder="YYYY-MM"
                @change="updateEntry(index, 'startDate', $event.target.value)"
            /></label>
            <label
              ><span>结束时间</span
              ><a-input
                :disabled="entry.isCurrent"
                :value="entry.endDate ?? ''"
                placeholder="YYYY-MM"
                @change="updateEntry(index, 'endDate', $event.target.value || null)"
            /></label>
            <label class="checkbox"
              ><a-checkbox
                :checked="entry.isCurrent"
                @change="updateEntry(index, 'isCurrent', $event.target.checked)"
                >仍在进行</a-checkbox
              ></label
            >
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
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid #e1e5ec;
  padding-bottom: 1rem;
}
.section-title label {
  flex: 1;
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
.checkbox {
  align-content: end;
  min-height: 3.7rem;
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
}
</style>
