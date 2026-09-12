import { createRouter, createWebHistory } from 'vue-router';
import HealthPage from '@/pages/HealthPage.vue';
import AuthPage from '@/pages/AuthPage.vue';
import VerifyEmailPage from '@/pages/VerifyEmailPage.vue';
import ProfilePage from '@/pages/ProfilePage.vue';
import { useAuthStore } from '@/stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/profile' },
    {
      path: '/login',
      name: 'login',
      component: AuthPage,
      props: { mode: 'login' },
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: AuthPage,
      props: { mode: 'register' },
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: AuthPage,
      props: { mode: 'forgot' },
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: AuthPage,
      props: { mode: 'reset' },
      meta: { public: true },
    },
    { path: '/verify-email', component: VerifyEmailPage, meta: { public: true } },
    { path: '/profile', component: ProfilePage },
    { path: '/health', component: HealthPage, meta: { public: true } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (!to.meta.public && !auth.user) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.meta.public && auth.user && ['login', 'register'].includes(String(to.name)))
    return '/profile';
  return true;
});
