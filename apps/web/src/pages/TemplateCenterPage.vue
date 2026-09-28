<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { TemplateSummary } from '@aceresume/contracts';
import { getApiErrorMessage } from '@/api/http';
import { listTemplates } from '@/api/template';
import AppSidebar from '@/components/AppSidebar.vue';
import TemplatePreviewCard from '@/components/TemplatePreviewCard.vue';

const templates = ref<TemplateSummary[]>([]);
const selected = ref<TemplateSummary | null>(null);
const isLoading = ref(true);
const categoryLabel = {
  general: '通用',
  technology: '技术岗',
  internship: '实习 / 校招',
  academic: '学术',
} as const;

onMounted(async () => {
  try {
    templates.value = await listTemplates();
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error));
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="template-shell">
    <AppSidebar />
    <main>
      <header class="template-hero">
        <div>
          <span>TEMPLATE ARCHIVE · 08</span>
          <h1>选择表达方式，<br />不改变你的事实。</h1>
          <p>所有模板使用同一份结构化内容与分页引擎，切换不会删除任何模块。</p>
        </div>
        <b>8</b>
      </header>
      <section class="template-content">
        <a-skeleton v-if="isLoading" active :paragraph="{ rows: 12 }" />
        <div v-else class="template-grid">
          <article v-for="(item, index) in templates" :key="item.versionId">
            <button class="preview-button" type="button" @click="selected = item">
              <TemplatePreviewCard :template="item" />
            </button>
            <div class="template-meta">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <div>
                <small
                  >{{ categoryLabel[item.category] }} ·
                  {{ item.layout === 'two-column' ? '双栏' : '单栏' }}</small
                >
                <h2>{{ item.name }}</h2>
                <p>{{ item.description }}</p>
              </div>
            </div>
            <div class="template-actions">
              <button type="button" @click="selected = item">完整预览</button>
              <RouterLink :to="`/resumes?create=1&template=${item.versionId}`">使用模板</RouterLink>
            </div>
          </article>
        </div>
      </section>
      <a-modal
        :open="Boolean(selected)"
        width="820px"
        :title="selected?.name"
        :footer="null"
        @cancel="selected = null"
      >
        <TemplatePreviewCard v-if="selected" class="modal-preview" :template="selected" />
        <RouterLink
          v-if="selected"
          class="modal-use"
          :to="`/resumes?create=1&template=${selected.versionId}`"
        >
          使用此模板创建简历 →
        </RouterLink>
      </a-modal>
    </main>
  </div>
</template>

<style scoped>
.template-shell {
  display: flex;
  min-height: 100vh;
  background: #f7f5ef;
  color: #19364d;
}
.template-shell > main {
  min-width: 0;
  flex: 1;
}
.template-hero {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  padding: 4.5rem 6vw 3.5rem;
  overflow: hidden;
  border-bottom: 1px solid #dad8d0;
  background: #fffdf8;
}
.template-hero span,
.template-meta small {
  color: #173fbd;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.template-hero h1 {
  margin: 0.8rem 0 1rem;
  font: 3.2rem/1.12 var(--serif);
}
.template-hero p {
  color: #737984;
}
.template-hero > b {
  color: #ff6a4d;
  font: 9rem/0.75 var(--serif);
  opacity: 0.2;
}
.template-content {
  padding: 2.8rem 5vw 5rem;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 2.2rem 1.5rem;
}
.template-grid article {
  padding: 0.8rem;
  border: 1px solid #d9d8d3;
  background: #fff;
  box-shadow: 0 14px 30px rgb(30 45 70 / 7%);
}
.preview-button {
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
}
.template-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.9rem;
  padding: 1rem 0.4rem;
}
.template-meta > span {
  color: #ff6a4d;
  font: 2rem var(--serif);
}
.template-meta h2 {
  margin: 0.25rem 0;
  font: 1.35rem var(--serif);
}
.template-meta p {
  min-height: 2.5rem;
  margin: 0;
  color: #777e89;
  font-size: 0.78rem;
  line-height: 1.6;
}
.template-actions {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0.4rem 0.2rem;
  border-top: 1px solid #e1e2df;
}
.template-actions button,
.template-actions a,
.modal-use {
  border: 0;
  background: none;
  color: #173fbd;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
}
.modal-preview {
  height: 38rem;
}
.modal-use {
  display: block;
  margin-top: 1rem;
  padding: 0.8rem;
  background: #173fbd;
  color: #fff;
  text-align: center;
}
@media (max-width: 720px) {
  .template-hero {
    padding: 2.5rem 1.2rem;
  }
  .template-hero h1 {
    font-size: 2.2rem;
  }
  .template-hero > b {
    display: none;
  }
  .template-content {
    padding-inline: 1rem;
  }
}
</style>
