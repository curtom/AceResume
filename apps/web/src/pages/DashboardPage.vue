<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ResumeSummary } from '@aceresume/contracts';
import { getApiErrorMessage } from '@/api/http';
import AppSidebar from '@/components/AppSidebar.vue';
import * as resumeApi from '@/api/resume';

const router = useRouter();
const recent = ref<ResumeSummary | null>(null);
const total = ref(0);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
onMounted(async () => {
  try {
    const [active, archived] = await Promise.all([
      resumeApi.listResumes('active'),
      resumeApi.listResumes('archived'),
    ]);
    recent.value = active.items[0] ?? null;
    total.value = active.total + archived.total;
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="dashboard-shell">
    <AppSidebar :resume-count="total" />
    <main class="dashboard">
      <header class="topbar">
        <span>{{ new Date().toLocaleDateString('zh-CN', { weekday: 'long' }) }}</span>
        <b>{{ new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) }}</b>
      </header>
      <div class="dashboard-content">
        <a-alert
          v-if="errorMessage"
          class="load-alert"
          type="error"
          show-icon
          closable
          :message="errorMessage"
          @close="errorMessage = null"
        />
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow">START YOUR STORY</span>
            <h1>下一份机会，<br /><em>从好好讲述自己开始。</em></h1>
            <p v-if="recent">继续打磨“{{ recent.name }}”，让真实经历被清楚地看见。</p>
            <p v-else>从个人资料与第一份结构化简历开始，建立你的职业叙事。</p>
            <button
              v-if="recent"
              class="primary-btn"
              @click="router.push('/resumes/' + recent.id + '/edit')"
            >
              继续编辑简历 <span>›</span>
            </button>
            <button v-else class="primary-btn" @click="router.push('/resumes?create=1')">
              创建第一份简历 <span>›</span>
            </button>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="orbit one"></div>
            <div class="orbit two"></div>
            <div class="paper back"></div>
            <div class="paper front">
              <span>AR</span><i></i><b></b><b></b><small></small><small></small>
            </div>
            <em>事实有据</em><em>表达有力</em>
          </div>
        </section>
        <section class="recent-section">
          <div class="section-title">
            <div>
              <span>RECENT WORK</span>
              <h2>最近简历</h2>
            </div>
            <RouterLink to="/resumes">查看全部 ›</RouterLink>
          </div>
          <a-skeleton v-if="isLoading" active :paragraph="{ rows: 4 }" />
          <article
            v-else-if="recent"
            class="resume-row"
            @click="router.push('/resumes/' + recent.id + '/edit')"
          >
            <div class="resume-thumb">
              <div><b></b><span></span><span></span><i></i><i></i></div>
            </div>
            <div class="resume-meta">
              <span>● 编辑中</span>
              <h3>{{ recent.name }}</h3>
              <p>经典单栏 · 更新于 {{ new Date(recent.updatedAt).toLocaleString('zh-CN') }}</p>
            </div>
            <strong class="resume-no">01</strong><button aria-label="打开简历">›</button>
          </article>
          <button v-else class="empty-card" @click="router.push('/resumes?create=1')">
            <b>＋</b><strong>创建新简历</strong><span>空白 / 个人资料</span>
          </button>
          <div class="quick-grid">
            <RouterLink to="/profile"
              ><span>01</span>
              <h3>完善个人资料</h3>
              <p>维护一次，在不同简历中按需复用。</p>
              <b>打开资料库 ›</b></RouterLink
            >
            <RouterLink to="/resumes?create=1"
              ><span>02</span>
              <h3>创建新的简历</h3>
              <p>为不同岗位准备独立内容与样式。</p>
              <b>选择创建方式 ›</b></RouterLink
            >
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-shell {
  display: flex;
  min-height: 100vh;
  background: #f8f7f2;
  color: #19364d;
}
.dashboard {
  min-width: 0;
  flex: 1;
}
.topbar {
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0 3rem;
  border-bottom: 1px solid #deddd7;
  background: #fffdf9;
  font-size: 0.75rem;
}
.topbar span {
  color: #8a8b8d;
}
.dashboard-content {
  padding: 2.3rem 4vw 5rem;
}
.load-alert {
  margin-bottom: 1rem;
}
.hero {
  position: relative;
  display: grid;
  min-height: 22rem;
  grid-template-columns: 1.15fr 0.85fr;
  overflow: hidden;
  background: #e9edf7;
}
.hero::before {
  position: absolute;
  inset: 0;
  border-left: 8px solid #173fbd;
  content: '';
}
.hero-copy {
  z-index: 1;
  padding: 3.7rem 4rem;
}
.eyebrow,
.section-title span {
  color: #173fbd;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}
.hero h1 {
  margin: 0.8rem 0 1.2rem;
  font: 3rem/1.13 var(--serif);
}
.hero h1 em {
  color: #173fbd;
  font-style: normal;
}
.hero p {
  max-width: 34rem;
  color: #697386;
  line-height: 1.8;
}
.primary-btn {
  margin-top: 1.2rem;
  padding: 0.85rem 1.2rem;
  border: 0;
  background: #173fbd;
  box-shadow: 5px 5px 0 #19364d;
  color: #fff;
  font-weight: 700;
}
.primary-btn span {
  padding-left: 1.5rem;
}
.hero-art {
  position: relative;
  min-height: 22rem;
}
.orbit {
  position: absolute;
  border: 1px solid rgba(23, 63, 189, 0.2);
  border-radius: 50%;
}
.orbit.one {
  inset: 2rem 2rem 2rem 0;
}
.orbit.two {
  inset: 5rem 5rem 5rem 3rem;
}
.paper {
  position: absolute;
  width: 12rem;
  height: 16rem;
  background: #fff;
  box-shadow: 0 20px 50px rgba(30, 50, 80, 0.15);
}
.paper.back {
  top: 4rem;
  left: 26%;
  transform: rotate(-8deg);
  background: #ffdf77;
}
.paper.front {
  top: 3rem;
  left: 34%;
  padding: 1.4rem;
  transform: rotate(3deg);
}
.paper.front span {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  background: #173fbd;
  color: #fff;
}
.paper.front i {
  display: block;
  width: 3rem;
  height: 2px;
  margin: 1.2rem 0;
  background: #ff6a4d;
}
.paper.front b,
.paper.front small {
  display: block;
  height: 5px;
  margin: 0.65rem 0;
  background: #d9deea;
}
.paper.front small {
  width: 70%;
}
.hero-art em {
  position: absolute;
  padding: 0.45rem 0.7rem;
  background: #fff;
  color: #173fbd;
  font-size: 0.7rem;
  font-style: normal;
  box-shadow: 3px 3px 0 #ff6a4d;
}
.hero-art em:nth-of-type(1) {
  top: 4rem;
  right: 2rem;
}
.hero-art em:nth-of-type(2) {
  right: 4rem;
  bottom: 4rem;
}
.recent-section {
  max-width: 62rem;
  margin-top: 2.7rem;
}
.section-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-title h2 {
  margin: 0.35rem 0 0;
  font: 1.8rem var(--serif);
}
.section-title a {
  color: #173fbd;
  text-decoration: none;
}
.resume-row {
  display: grid;
  grid-template-columns: 8rem 1fr auto 2.5rem;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
  border: 1px solid #dedede;
  background: #fff;
  box-shadow: 0 10px 25px rgba(30, 45, 70, 0.06);
  cursor: pointer;
}
.resume-thumb {
  display: grid;
  height: 6.5rem;
  place-items: center;
  background: #e9edf7;
}
.resume-thumb > div {
  width: 3.7rem;
  height: 5rem;
  padding: 0.55rem;
  background: #fff;
}
.resume-thumb b,
.resume-thumb span,
.resume-thumb i {
  display: block;
  height: 3px;
  margin: 0.35rem 0;
  background: #173fbd;
}
.resume-thumb span {
  background: #cbd2de;
}
.resume-thumb i {
  width: 75%;
  background: #e3e6eb;
}
.resume-meta > span {
  color: #3c9860;
  font-size: 0.7rem;
}
.resume-meta h3 {
  margin: 0.5rem 0;
  font: 1.3rem var(--serif);
}
.resume-meta p {
  color: #858b95;
  font-size: 0.75rem;
}
.resume-no {
  color: #ff6a4d;
  font: 2.5rem var(--serif);
}
.resume-row button {
  border: 0;
  background: none;
  color: #173fbd;
  font-size: 2rem;
}
.empty-card {
  display: grid;
  width: 15rem;
  height: 11rem;
  place-items: center;
  border: 1px dashed #aab3c2;
  background: #fff;
  color: #173fbd;
}
.empty-card b {
  font-size: 2rem;
}
.empty-card span {
  color: #89909b;
  font-size: 0.7rem;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}
.quick-grid a {
  position: relative;
  padding: 1.4rem;
  border: 1px solid #dcddd9;
  background: #fffdf9;
  color: #19364d;
  text-decoration: none;
}
.quick-grid span {
  position: absolute;
  right: 1rem;
  top: 0.8rem;
  color: #ff6a4d;
  font: 2rem var(--serif);
}
.quick-grid h3 {
  font: 1.2rem var(--serif);
}
.quick-grid p {
  color: #7b818a;
}
.quick-grid b {
  color: #173fbd;
  font-size: 0.75rem;
}
@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
  }
  .hero-art {
    display: none;
  }
  .hero-copy {
    padding: 2.5rem;
  }
  .hero h1 {
    font-size: 2.2rem;
  }
  .resume-row {
    grid-template-columns: 6rem 1fr;
  }
  .resume-no,
  .resume-row > button {
    display: none;
  }
  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
