import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import('@/pages/DashboardPage.vue') },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/AuthPage.vue'),
      props: { mode: 'login' },
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/AuthPage.vue'),
      props: { mode: 'register' },
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/pages/AuthPage.vue'),
      props: { mode: 'forgot' },
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/pages/AuthPage.vue'),
      props: { mode: 'reset' },
      meta: { public: true },
    },
    {
      path: '/verify-email',
      component: () => import('@/pages/VerifyEmailPage.vue'),
      meta: { public: true },
    },
    { path: '/profile', component: () => import('@/pages/ProfilePage.vue') },
    { path: '/resumes', component: () => import('@/pages/ResumeListPage.vue') },
    { path: '/resumes/:id/edit', component: () => import('@/pages/ResumeEditorPage.vue') },
    { path: '/resumes/:id/preview', component: () => import('@/pages/ResumePreviewPage.vue') },
    { path: '/templates', component: () => import('@/pages/TemplateCenterPage.vue') },
    { path: '/documents', component: () => import('@/pages/DocumentLibraryPage.vue') },
    {
      path: '/admin/:section?',
      component: () => import('@/pages/AdminPage.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/health',
      component: () => import('@/pages/HealthPage.vue'),
      meta: { public: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (!to.meta.public && !auth.user) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.requiresAdmin && auth.user?.role !== 'admin') return '/dashboard';
  if (to.meta.public && auth.user && ['login', 'register'].includes(String(to.name)))
    return '/dashboard';
  return true;
});
