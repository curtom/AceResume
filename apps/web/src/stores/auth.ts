import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LoginRequest, UserSummary } from '@aceresume/contracts';
import * as authApi from '@/api/auth';
import { setAccessToken } from '@/api/http';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSummary | null>(null);
  const isInitialized = ref(false);
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    try {
      const session = await authApi.refresh();
      setAccessToken(session.accessToken);
      user.value = session.user;
    } catch {
      setAccessToken(null);
      user.value = null;
    } finally {
      isInitialized.value = true;
    }
  }
  async function login(input: LoginRequest): Promise<void> {
    const session = await authApi.login(input);
    setAccessToken(session.accessToken);
    user.value = session.user;
    isInitialized.value = true;
  }
  async function logout(): Promise<void> {
    await authApi.logout();
    setAccessToken(null);
    user.value = null;
  }
  return { user, isInitialized, initialize, login, logout };
});
