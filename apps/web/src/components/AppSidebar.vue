<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

defineProps<{ resumeCount?: number }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const activeRoute = computed(() => {
  if (route.path.startsWith('/resumes')) return 'resumes';
  if (route.path.startsWith('/profile')) return 'profile';
  if (route.path.startsWith('/templates')) return 'templates';
  if (route.path.startsWith('/documents')) return 'documents';
  return 'dashboard';
});
async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace('/login');
}
</script>

<template>
  <aside class="app-sidebar" aria-label="主导航">
    <RouterLink class="app-brand" to="/dashboard" aria-label="AceResume 工作台">
      <span class="brand-mark">A</span><span>AceResume</span>
    </RouterLink>
    <div class="side-label">创作空间</div>
    <nav class="side-nav">
      <RouterLink :class="{ active: activeRoute === 'dashboard' }" to="/dashboard">
        <span class="nav-icon">▦</span><span>工作台</span>
      </RouterLink>
      <RouterLink :class="{ active: activeRoute === 'resumes' }" to="/resumes">
        <span class="nav-icon">▤</span><span>我的简历</span
        ><small v-if="resumeCount !== undefined">{{ resumeCount }}</small>
      </RouterLink>
      <RouterLink :class="{ active: activeRoute === 'profile' }" to="/profile">
        <span class="nav-icon">♙</span><span>个人资料</span>
      </RouterLink>
      <RouterLink :class="{ active: activeRoute === 'documents' }" to="/documents">
        <span class="nav-icon">□</span><span>材料库</span>
      </RouterLink>
      <RouterLink :class="{ active: activeRoute === 'templates' }" to="/templates">
        <span class="nav-icon">▥</span><span>模板中心</span>
      </RouterLink>
    </nav>
    <div class="sidebar-bottom">
      <button type="button" disabled title="后续阶段开放">
        <span class="nav-icon">⚙</span><span>账号设置</span>
      </button>
      <div class="user-card">
        <span class="avatar">{{ auth.user?.email.slice(0, 1).toUpperCase() }}</span>
        <div>
          <strong>{{ auth.user?.email }}</strong
          ><span>应届生账户</span>
        </div>
      </div>
      <button class="sign-out" type="button" @click="signOut">安全退出</button>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  width: 15rem;
  height: 100vh;
  flex-direction: column;
  flex-shrink: 0;
  padding: 2rem 1.1rem 1rem;
  border-right: 1px solid #d8d6cf;
  background: #f0eee6;
  color: #18334b;
}
.app-brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0 0.5rem;
  color: #19364d;
  font-family: var(--serif);
  font-size: 1.15rem;
  text-decoration: none;
}
.brand-mark {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  place-items: center;
  background: #173fbd;
  box-shadow: 5px 5px 0 #f6d86b;
  color: #fff;
  font: 700 1.2rem var(--serif);
}
.side-label {
  margin: 3.2rem 0.75rem 0.8rem;
  color: #9a8f77;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}
.side-nav {
  display: grid;
  gap: 0.3rem;
}
.side-nav a,
.side-nav button,
.sidebar-bottom > button {
  display: grid;
  min-height: 3rem;
  grid-template-columns: 1.5rem 1fr auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.8rem;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: #536270;
  font-size: 0.9rem;
  text-align: left;
  text-decoration: none;
}
.side-nav a:hover {
  color: #173fbd;
  background: #e7e8e5;
}
.side-nav a.active {
  border-left-color: #ff6a4d;
  background: #193b55;
  box-shadow: 4px 4px 0 #ff6a4d;
  color: #fff;
}
.side-nav button:disabled,
.sidebar-bottom > button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.nav-icon {
  font-size: 1.15rem;
  text-align: center;
}
.side-nav small {
  min-width: 1.4rem;
  padding: 0.15rem 0.35rem;
  border-radius: 1rem;
  background: rgba(23, 63, 189, 0.1);
  color: inherit;
  font-size: 0.62rem;
  text-align: center;
}
.sidebar-bottom {
  display: grid;
  gap: 0.6rem;
  margin-top: auto;
  border-top: 1px solid #d7d4ca;
  padding-top: 0.8rem;
}
.user-card {
  display: grid;
  min-width: 0;
  grid-template-columns: 2.2rem 1fr;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.45rem;
}
.avatar {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border-radius: 50%;
  background: #f6d86b;
  color: #19364d;
  font-weight: 800;
}
.user-card div {
  display: grid;
  min-width: 0;
}
.user-card strong {
  overflow: hidden;
  font-size: 0.72rem;
  text-overflow: ellipsis;
}
.user-card div span {
  color: #8b8c87;
  font-size: 0.65rem;
}
.sidebar-bottom .sign-out {
  min-height: 2rem;
  display: block;
  padding-left: 0.45rem;
  color: #173fbd;
  font-size: 0.72rem;
}
@media (max-width: 850px) {
  .app-sidebar {
    width: 4.8rem;
    padding-inline: 0.65rem;
  }
  .app-brand > span:last-child,
  .side-label,
  .side-nav span:not(.nav-icon),
  .side-nav small,
  .sidebar-bottom {
    display: none;
  }
  .side-nav {
    margin-top: 3rem;
  }
  .side-nav a,
  .side-nav button {
    grid-template-columns: 1fr;
    padding: 0;
  }
}
</style>
