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
  education: { title: '教育经历', hint: '学校、专业、学历与绩点信息', add: '添加教育经历' },
  project: { title: '项目经历', hint: '记录你真正参与过的项目和成果', add: '添加项目经历' },
  experience: { title: '实习 / 工作', hint: '组织、职位、职责与可验证成果', add: '添加实习或工作' },
  skill: { title: '技能清单', hint: '按分类维护可复用的技能条目', add: '添加技能' },
};
function title(entry: ProfileEntry): string {
  const content = entry.content;
  if ('school' in content) return content.school;
  if ('organization' in content) return content.organization;
  if ('category' in content) return `${content.category} · ${content.name}`;
  return content.name;
}
function subtitle(entry: ProfileEntry): string {
  const content = entry.content;
  if ('major' in content) return `${content.degree} · ${content.major}`;
  if ('position' in content) return content.position;
  if ('technologies' in content) return content.technologies.join(' / ') || '尚未填写技术栈';
  return content.proficiency || content.description || '未填写补充说明';
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
