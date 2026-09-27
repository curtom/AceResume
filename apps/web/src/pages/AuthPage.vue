<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from '@aceresume/contracts';
import * as authApi from '@/api/auth';
import { getApiErrorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
const props = defineProps<{ mode: AuthMode }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const form = reactive({ email: '', password: '' });
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const copy = computed(
  () =>
    ({
      login: {
        kicker: 'WELCOME BACK',
        title: '继续打磨你的故事',
        subtitle: '登录后进入个人资料库。',
        action: '登录',
      },
      register: {
        kicker: 'START HERE',
        title: '先建立可信的资料底稿',
        subtitle: '完成账户设置后即可管理你的经历。',
        action: '创建账户',
      },
      forgot: {
        kicker: 'ACCOUNT RECOVERY',
        title: '找回你的账户',
        subtitle: '我们会发送一封限时重置邮件。',
        action: '发送重置邮件',
      },
      reset: {
        kicker: 'NEW PASSWORD',
        title: '设置新密码',
        subtitle: '新密码保存后，其他会话将全部失效。',
        action: '更新密码',
      },
    })[props.mode],
);
const showsEmail = computed(() => props.mode !== 'reset');
const showsPassword = computed(() => props.mode !== 'forgot');

async function submit(): Promise<void> {
  errorMessage.value = null;
  successMessage.value = null;
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  const schema =
    props.mode === 'register'
      ? RegisterRequestSchema
      : props.mode === 'login'
        ? LoginRequestSchema
        : props.mode === 'forgot'
          ? ForgotPasswordRequestSchema
          : ResetPasswordRequestSchema;
  const payload =
    props.mode === 'reset'
      ? { token, password: form.password }
      : props.mode === 'forgot'
        ? { email: form.email }
        : { email: form.email, password: form.password };
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? '请检查输入内容。';
    return;
  }
  isSubmitting.value = true;
  try {
    if (props.mode === 'login') {
      await auth.login({ email: form.email.trim().toLowerCase(), password: form.password });
      await router.replace(
        typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard',
      );
    } else if (props.mode === 'register') {
      successMessage.value = await authApi.register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
    } else if (props.mode === 'forgot') {
      successMessage.value = await authApi.forgotPassword(form.email.trim().toLowerCase());
    } else {
      successMessage.value = await authApi.resetPassword(token, form.password);
    }
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <aside class="auth-story" aria-hidden="true">
      <div class="brand-mark">A</div>
      <div class="story-copy">
        <span>ACE RESUME · 01</span>
        <blockquote>“简历不是经历的堆叠，而是把真实的成长编排成清晰的方向。”</blockquote>
        <p>资料只保存一次，之后按岗位需要组合。</p>
      </div>
      <div class="paper-lines"><i /><i /><i /><i /></div>
    </aside>
    <section class="auth-panel">
      <div class="auth-card">
        <p class="kicker">{{ copy.kicker }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="subtitle">{{ copy.subtitle }}</p>
        <a-alert v-if="errorMessage" :message="errorMessage" type="error" show-icon />
        <a-alert v-if="successMessage" :message="successMessage" type="success" show-icon />
        <form @submit.prevent="submit">
          <label v-if="showsEmail">
            <span>邮箱</span>
            <a-input
              v-model:value="form.email"
              type="email"
              autocomplete="email"
              placeholder="name@example.com"
              size="large"
            />
          </label>
          <label v-if="showsPassword">
            <span>{{ mode === 'reset' ? '新密码' : '密码' }}</span>
            <a-input-password
              v-model:value="form.password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              placeholder="10～72 位，包含字母和数字"
              size="large"
            />
          </label>
          <button class="submit-button" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? '处理中…' : copy.action }} <span>→</span>
          </button>
        </form>
        <nav class="auth-links" aria-label="账户操作">
          <RouterLink v-if="mode !== 'login'" to="/login">返回登录</RouterLink>
          <RouterLink v-if="mode === 'login'" to="/register">创建账户</RouterLink>
          <RouterLink v-if="mode === 'login'" to="/forgot-password">忘记密码</RouterLink>
        </nav>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(24rem, 0.95fr) minmax(32rem, 1.05fr);
  background: #f8f6ef;
}
.auth-story {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 3rem;
  background: #173fbd;
  color: white;
}
.auth-story::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgb(255 255 255 / 8%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 8%) 1px, transparent 1px);
  background-size: 32px 32px;
  content: '';
}
.brand-mark {
  position: relative;
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  background: #f6d86b;
  color: #172033;
  font:
    800 1.6rem Georgia,
    serif;
  box-shadow: 6px 6px 0 #ff6a4d;
  transform: rotate(-2deg);
}
.story-copy {
  position: relative;
  z-index: 1;
  max-width: 32rem;
  margin-top: 24vh;
}
.story-copy span,
.kicker {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.2em;
}
blockquote {
  margin: 1.5rem 0;
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: clamp(2rem, 3.4vw, 3.8rem);
  line-height: 1.2;
}
.story-copy p {
  color: rgb(255 255 255 / 68%);
}
.paper-lines {
  position: absolute;
  right: -3rem;
  bottom: 4rem;
  width: 17rem;
  padding: 3rem 2rem;
  background: #fffdf8;
  box-shadow: 0 2rem 4rem rgb(5 17 65 / 35%);
  transform: rotate(-7deg);
}
.paper-lines i {
  display: block;
  width: 100%;
  height: 5px;
  margin: 1rem 0;
  background: #c9cfdc;
}
.paper-lines i:first-child {
  width: 45%;
  height: 10px;
  background: #ff6a4d;
}
.auth-panel {
  display: grid;
  place-items: center;
  padding: 4rem;
}
.auth-card {
  width: min(100%, 29rem);
}
.kicker {
  color: #173fbd;
}
.auth-card h1 {
  margin: 0.8rem 0;
  color: #172033;
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: 2.35rem;
}
.subtitle {
  margin: 0 0 2rem;
  color: #737887;
}
form {
  display: grid;
  gap: 1.25rem;
  margin-top: 1.2rem;
}
label > span {
  display: block;
  margin-bottom: 0.55rem;
  color: #4d5667;
  font-size: 0.78rem;
  font-weight: 700;
}
.submit-button {
  display: flex;
  height: 3.2rem;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.2rem;
  border: 0;
  background: #172033;
  color: white;
  font-weight: 700;
  box-shadow: 5px 5px 0 #ff6a4d;
}
.submit-button:disabled {
  opacity: 0.55;
}
.auth-links {
  display: flex;
  gap: 1.2rem;
  margin-top: 1.6rem;
}
.auth-links a {
  color: #173fbd;
  font-size: 0.8rem;
}
@media (max-width: 800px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
  .auth-story {
    display: none;
  }
  .auth-panel {
    padding: 2rem;
  }
}
</style>
