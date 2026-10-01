<script setup lang="ts">
import type { ProfileEntry, ProfileEntryType } from '@aceresume/contracts';

defineProps<{
  type: ProfileEntryType;
  entries: ProfileEntry[];
  isLoading: boolean;
}>();
const emit = defineEmits<{
  add: [];
  edit: [entry: ProfileEntry];
  delete: [entry: ProfileEntry];
  move: [index: number, direction: -1 | 1];
}>();
const labels: Record<ProfileEntryType, { title: string; hint: string; add: string }> = {
  education: { title: '教育经历', hint: '学校、专业、学历与在校经历', add: '添加教育经历' },
  project: { title: '项目经历', hint: '记录项目、角色、时间与内容描述', add: '添加项目经历' },
  experience: {
    title: '实习 / 工作经历',
    hint: '记录组织、职位、时间与内容描述',
    add: '添加实习或工作',
  },
  campus: {
    title: '校园经历',
    hint: '记录校园组织、角色、时间与内容描述',
    add: '添加校园经历',
  },
  skill: { title: '专业技能', hint: '维护可复用的专业技能描述', add: '添加专业技能' },
};
function title(entry: ProfileEntry): string {
  if (entry.type === 'education') return entry.content.school;
  if (entry.type === 'experience' || entry.type === 'campus') return entry.content.organization;
  if (entry.type === 'skill') return '专业技能';
  return entry.content.name;
}
function subtitle(entry: ProfileEntry): string {
  if (entry.type === 'education') return `${entry.content.degree} · ${entry.content.major}`;
  if (entry.type === 'experience') return entry.content.position;
  if (entry.type === 'campus') return entry.content.role;
  if (entry.type === 'project')
    return (
      entry.content.role ||
      entry.content.background ||
      entry.content.responsibilities[0] ||
      '未填写内容描述'
    );
  return entry.content.description || '未填写内容描述';
}
</script>

<template>
  <section class="entry-section">
    <header>
      <div>
        <p>PROFILE LIBRARY</p>
        <h2>{{ labels[type].title }}</h2>
        <span>{{ labels[type].hint }}</span>
      </div>
      <button type="button" @click="emit('add')">＋ {{ labels[type].add }}</button>
    </header>
    <a-skeleton v-if="isLoading" active :paragraph="{ rows: 4 }" />
    <a-empty v-else-if="entries.length === 0" description="还没有资料条目，先添加第一条吧。" />
    <div v-else class="entry-list">
      <article v-for="(entry, index) in entries" :key="entry.id">
        <div class="entry-index">{{ String(index + 1).padStart(2, '0') }}</div>
        <div>
          <h3>{{ title(entry) }}</h3>
          <p>{{ subtitle(entry) }}</p>
        </div>
        <div class="entry-actions">
          <button
            type="button"
            :disabled="index === 0"
            aria-label="上移"
            @click="emit('move', index, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="index === entries.length - 1"
            aria-label="下移"
            @click="emit('move', index, 1)"
          >
            ↓
          </button>
          <button type="button" @click="emit('edit', entry)">编辑</button>
          <a-popconfirm
            title="确定删除这条资料吗？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="emit('delete', entry)"
          >
            <button class="danger" type="button">删除</button>
          </a-popconfirm>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.entry-section {
  padding: 2rem 2.25rem;
  border: 1px solid var(--line-color);
  background: var(--surface-color);
  box-shadow: 0 1rem 3rem rgb(23 32 51 / 6%);
}
.entry-section header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--line-color);
}
.entry-section header p {
  margin: 0;
  color: var(--brand-blue);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.entry-section h2 {
  margin: 0.35rem 0;
  font-family: var(--serif);
  font-size: 1.6rem;
}
.entry-section header span {
  color: var(--muted-color);
  font-size: 0.78rem;
}
.entry-section header button {
  min-height: 2.6rem;
  padding: 0 1rem;
  border: 0;
  background: var(--brand-blue);
  color: white;
  font-weight: 700;
  box-shadow: 4px 4px 0 var(--ink-color);
}
.entry-list {
  display: grid;
}
.entry-list article {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  min-height: 6.5rem;
  border-bottom: 1px solid var(--line-color);
}
.entry-index {
  color: var(--coral);
  font:
    700 0.75rem Georgia,
    serif;
}
.entry-list h3 {
  margin: 0 0 0.35rem;
  font-family: var(--serif);
  font-size: 1.05rem;
}
.entry-list p {
  margin: 0;
  color: var(--muted-color);
  font-size: 0.75rem;
}
.entry-actions {
  display: flex;
  gap: 0.35rem;
}
.entry-actions button {
  min-height: 2rem;
  padding: 0 0.55rem;
  border: 1px solid var(--line-color);
  background: white;
  color: #596273;
  font-size: 0.72rem;
}
.entry-actions button:disabled {
  opacity: 0.3;
  cursor: default;
}
.entry-actions .danger {
  color: #b53a35;
}
</style>
