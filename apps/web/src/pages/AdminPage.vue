<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  AdminAuditLog,
  AdminModelConfig,
  AdminMonitoring,
  AdminPromptTestResult,
  AdminPromptVersion,
  AdminTemplateVersion,
  AdminUser,
} from '@aceresume/contracts';
import { TemplateDefinitionSchema } from '@aceresume/resume-schema';
import * as adminApi from '@/api/admin';
import { getApiErrorMessage } from '@/api/http';
import TemplatePreviewCard from '@/components/TemplatePreviewCard.vue';
import { useAuthStore } from '@/stores/auth';

type Section = 'overview' | 'users' | 'templates' | 'ai' | 'audit';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const section = computed<Section>(() => {
  const value = String(route.params.section ?? 'overview');
  return ['users', 'templates', 'ai', 'audit'].includes(value) ? (value as Section) : 'overview';
});
const loading = ref(false);
const monitoring = ref<AdminMonitoring | null>(null);
const users = ref<AdminUser[]>([]);
const userTotal = ref(0);
const search = ref('');
const templates = ref<AdminTemplateVersion[]>([]);
const templateJson = ref('');
const editingVersionId = ref<string | undefined>();
const templatePreview = computed(() => {
  try {
    return TemplateDefinitionSchema.parse(JSON.parse(templateJson.value));
  } catch {
    return null;
  }
});
const prompts = ref<AdminPromptVersion[]>([]);
const promptContent = ref('');
const promptRolloutPercent = ref(100);
const promptTest = ref<AdminPromptTestResult | null>(null);
const auditLogs = ref<AdminAuditLog[]>([]);
const model = ref<AdminModelConfig | null>(null);
const modelForm = reactive({
  provider: 'mock' as 'mock' | 'qwen',
  baseUrl: '',
  chatModel: '',
  embeddingModel: '',
  embeddingDimension: 1024,
  timeoutMs: 60_000,
  maxOutputTokens: 2048,
  temperature: 0.2,
  supportsJson: true,
  supportsTools: false,
  isEnabled: true,
  secret: '',
});
const sensitiveOpen = ref(false);
const sensitiveTitle = ref('确认敏感操作');
const sensitive = reactive({ password: '', reason: '' });
let pendingAction: ((credentials: { password: string; reason: string }) => Promise<void>) | null =
  null;

const nav = [
  { key: 'overview', label: '运行总览', mark: '01' },
  { key: 'users', label: '用户与权限', mark: '02' },
  { key: 'templates', label: '模板版本', mark: '03' },
  { key: 'ai', label: '模型与提示词', mark: '04' },
  { key: 'audit', label: '审计日志', mark: '05' },
] as const;

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (section.value === 'overview') monitoring.value = await adminApi.getAdminMonitoring();
    if (section.value === 'users') {
      const page = await adminApi.listAdminUsers(search.value);
      users.value = page.items;
      userTotal.value = page.total;
    }
    if (section.value === 'templates') templates.value = await adminApi.listAdminTemplates();
    if (section.value === 'ai') {
      [model.value, prompts.value] = await Promise.all([
        adminApi.getAdminModelConfig(),
        adminApi.listAdminPrompts(),
      ]);
      Object.assign(modelForm, {
        ...model.value,
        secret: '',
      });
      promptContent.value ||= prompts.value[0]?.content ?? '';
    }
    if (section.value === 'audit') auditLogs.value = (await adminApi.listAdminAudit()).items;
  } catch (error) {
    message.error(getApiErrorMessage(error));
  } finally {
    loading.value = false;
  }
}
function requestSensitive(
  title: string,
  action: (credentials: { password: string; reason: string }) => Promise<void>,
): void {
  sensitiveTitle.value = title;
  sensitive.password = '';
  sensitive.reason = '';
  pendingAction = action;
  sensitiveOpen.value = true;
}
async function confirmSensitive(): Promise<void> {
  if (!pendingAction || !sensitive.password || sensitive.reason.trim().length < 8) {
    message.warning('请输入管理员密码，并填写至少 8 个字的操作原因。');
    return;
  }
  loading.value = true;
  try {
    await pendingAction({ password: sensitive.password, reason: sensitive.reason.trim() });
    sensitiveOpen.value = false;
    message.success('操作已完成并写入审计日志。');
    await load();
  } catch (error) {
    message.error(getApiErrorMessage(error));
  } finally {
    loading.value = false;
  }
}
function changeUser(user: AdminUser): void {
  const status = user.status === 'active' ? 'disabled' : 'active';
  requestSensitive(status === 'disabled' ? '禁用用户' : '恢复用户', async (credentials) => {
    await adminApi.updateAdminUserStatus(user.id, { status, ...credentials });
  });
}
function editTemplate(item?: AdminTemplateVersion): void {
  editingVersionId.value = item?.status === 'draft' ? item.definition.versionId : undefined;
  const definition = item
    ? {
        ...globalThis.structuredClone(item.definition),
        ...(item.status === 'draft'
          ? {}
          : {
              version: item.definition.version + 1,
              versionId: `${item.definition.id}-v${item.definition.version + 1}`,
            }),
      }
    : null;
  templateJson.value = definition ? JSON.stringify(definition, null, 2) : '';
}
async function testTemplate(): Promise<void> {
  try {
    const definition = TemplateDefinitionSchema.parse(JSON.parse(templateJson.value));
    const result = await adminApi.testAdminTemplate(definition);
    message.success(`模板校验通过，测试渲染 ${result.htmlBytes} bytes。`);
  } catch (error) {
    message.error(getApiErrorMessage(error));
  }
}
function saveTemplate(): void {
  let definition;
  try {
    definition = TemplateDefinitionSchema.parse(JSON.parse(templateJson.value));
  } catch (error) {
    message.error(getApiErrorMessage(error));
    return;
  }
  requestSensitive(
    editingVersionId.value ? '更新模板草稿' : '创建模板版本',
    async (credentials) => {
      await adminApi.saveAdminTemplate({ definition, ...credentials }, editingVersionId.value);
    },
  );
}
function changeTemplate(item: AdminTemplateVersion, action: 'publish' | 'retire'): void {
  requestSensitive(action === 'publish' ? '发布模板版本' : '下架模板版本', async (credentials) => {
    await adminApi.changeAdminTemplateStatus(item.definition.versionId, action, credentials);
  });
}
function saveModel(): void {
  requestSensitive('更新生产模型配置', async (credentials) => {
    model.value = await adminApi.updateAdminModelConfig({
      provider: modelForm.provider,
      baseUrl: modelForm.baseUrl,
      chatModel: modelForm.chatModel,
      embeddingModel: modelForm.embeddingModel,
      embeddingDimension: modelForm.embeddingDimension,
      timeoutMs: modelForm.timeoutMs,
      maxOutputTokens: modelForm.maxOutputTokens,
      temperature: modelForm.temperature,
      supportsJson: modelForm.supportsJson,
      supportsTools: modelForm.supportsTools,
      isEnabled: modelForm.isEnabled,
      ...(modelForm.secret ? { secret: modelForm.secret } : {}),
      ...credentials,
    });
  });
}
async function testPromptContent(): Promise<void> {
  try {
    promptTest.value = await adminApi.testAdminPrompt(promptContent.value);
  } catch (error) {
    message.error(getApiErrorMessage(error));
  }
}
function createPrompt(): void {
  requestSensitive('创建提示词版本', async (credentials) => {
    await adminApi.createAdminPrompt({
      key: 'resume-writing',
      content: promptContent.value,
      rolloutPercent: 0,
      ...credentials,
    });
  });
}
function activatePrompt(item: AdminPromptVersion): void {
  requestSensitive(
    item.status === 'retired' ? '回滚至历史提示词' : '启用提示词版本',
    async (credentials) => {
      await adminApi.activateAdminPrompt(item.id, {
        rolloutPercent: promptRolloutPercent.value,
        ...credentials,
      });
    },
  );
}
async function signOut(): Promise<void> {
  await auth.logout();
  await router.replace('/login');
}
watch(section, () => void load());
onMounted(() => void load());
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-rail">
      <RouterLink class="admin-brand" to="/admin"
        ><b>A</b><span>AceResume<br /><small>CONTROL ROOM</small></span></RouterLink
      >
      <nav aria-label="管理后台导航">
        <RouterLink
          v-for="item in nav"
          :key="item.key"
          :to="`/admin/${item.key}`"
          :class="{ active: section === item.key }"
        >
          <small>{{ item.mark }}</small
          ><span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="rail-foot">
        <RouterLink to="/dashboard">← 返回用户端</RouterLink>
        <span>{{ auth.user?.email }}</span>
        <button type="button" @click="signOut">安全退出</button>
      </div>
    </aside>

    <main class="admin-main" :aria-busy="loading">
      <header class="admin-header">
        <div>
          <span>ADMINISTRATION / {{ section.toUpperCase() }}</span>
          <h1>{{ nav.find((item) => item.key === section)?.label }}</h1>
        </div>
        <div class="system-seal">
          <i></i><span>受控访问<br /><small>所有敏感操作均审计</small></span>
        </div>
      </header>
      <a-spin :spinning="loading">
        <section v-if="section === 'overview'" class="panel-stack">
          <div class="metric-grid">
            <article>
              <small>AI TASKS</small><strong>{{ monitoring?.ai.total ?? 0 }}</strong
              ><span>累计生成任务</span>
            </article>
            <article>
              <small>SUCCESS RATE</small
              ><strong>{{ Math.round((monitoring?.ai.successRate ?? 0) * 100) }}%</strong
              ><span>结构化输出成功率</span>
            </article>
            <article>
              <small>AVG LATENCY</small
              ><strong>{{ Math.round(monitoring?.ai.averageLatencyMs ?? 0) }}</strong
              ><span>毫秒</span>
            </article>
            <article>
              <small>HUMAN DECISIONS</small
              ><strong>{{ (monitoring?.ai.accepted ?? 0) + (monitoring?.ai.rejected ?? 0) }}</strong
              ><span>接受 / 忽略</span>
            </article>
            <article>
              <small>TOKEN USAGE · EST.</small
              ><strong>{{
                (monitoring?.ai.inputTokens ?? 0) + (monitoring?.ai.outputTokens ?? 0)
              }}</strong
              ><span>输入 + 输出估算</span>
            </article>
          </div>
          <div class="overview-grid">
            <article class="data-card">
              <h2>队列状态</h2>
              <div v-for="(value, key) in monitoring?.queues" :key="key" class="status-row">
                <b>{{ key }}</b
                ><span>等待 {{ value.waiting }}</span
                ><span>执行 {{ value.active }}</span
                ><em>失败 {{ value.failed }}</em>
              </div>
            </article>
            <article class="data-card">
              <h2>异步任务分布</h2>
              <h3>材料解析</h3>
              <div class="chips">
                <span v-for="item in monitoring?.documents" :key="item.status"
                  >{{ item.status }} · {{ item.count }}</span
                >
              </div>
              <h3>PDF 导出</h3>
              <div class="chips">
                <span v-for="item in monitoring?.exports" :key="item.status"
                  >{{ item.status }} · {{ item.count }}</span
                >
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="section === 'users'" class="data-card">
          <div class="card-head">
            <div>
              <small>IDENTITY DIRECTORY</small>
              <h2>用户账号</h2>
              <p>仅展示账号级摘要，不读取简历正文、原始材料或模型上下文。</p>
            </div>
            <a-input-search
              v-model:value="search"
              placeholder="按邮箱搜索"
              style="width: 280px"
              @search="load"
            />
          </div>
          <a-table :data-source="users" :pagination="false" row-key="id">
            <a-table-column title="邮箱" data-index="email" />
            <a-table-column title="角色" data-index="role" />
            <a-table-column title="状态"
              ><template #default="{ record }"
                ><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{
                  record.status
                }}</a-tag></template
              ></a-table-column
            >
            <a-table-column title="注册时间"
              ><template #default="{ record }">{{
                new Date(record.createdAt).toLocaleString()
              }}</template></a-table-column
            >
            <a-table-column title="操作"
              ><template #default="{ record }"
                ><a-button
                  size="small"
                  :danger="record.status === 'active'"
                  :disabled="record.id === auth.user?.id"
                  @click="changeUser(record)"
                  >{{ record.status === 'active' ? '禁用' : '恢复' }}</a-button
                ></template
              ></a-table-column
            >
          </a-table>
          <p class="table-foot">共 {{ userTotal }} 个账号</p>
        </section>

        <section v-else-if="section === 'templates'" class="template-grid">
          <article class="data-card">
            <div class="card-head">
              <div>
                <small>VERSION REGISTRY</small>
                <h2>模板版本</h2>
              </div>
            </div>
            <div v-for="item in templates" :key="item.definition.versionId" class="version-row">
              <div>
                <b>{{ item.definition.name }}</b
                ><span>{{ item.definition.versionId }} · {{ item.definition.layout }}</span>
              </div>
              <a-tag
                :color="
                  item.status === 'published'
                    ? 'blue'
                    : item.status === 'draft'
                      ? 'gold'
                      : 'default'
                "
                >{{ item.status }}</a-tag
              >
              <div class="row-actions">
                <button @click="editTemplate(item)">编辑 / 新版本</button
                ><button v-if="item.status === 'draft'" @click="changeTemplate(item, 'publish')">
                  发布</button
                ><button v-if="item.status === 'published'" @click="changeTemplate(item, 'retire')">
                  下架
                </button>
              </div>
            </div>
          </article>
          <article class="data-card editor-card">
            <small>TEMPLATE LAB</small>
            <h2>定义与测试</h2>
            <p>选择已有版本创建下一版本；草稿可原位编辑。内容和主题参数保持分离。</p>
            <a-textarea
              v-model:value="templateJson"
              :rows="19"
              placeholder="选择一个模板版本开始编辑 JSON 定义"
            />
            <TemplatePreviewCard
              v-if="templatePreview"
              class="admin-template-preview"
              :template="templatePreview"
            />
            <div class="editor-actions">
              <a-button @click="testTemplate">测试渲染</a-button
              ><a-button type="primary" :disabled="!templateJson" @click="saveTemplate"
                >保存草稿</a-button
              >
            </div>
          </article>
        </section>

        <section v-else-if="section === 'ai'" class="panel-stack">
          <article class="data-card">
            <div class="card-head">
              <div>
                <small>MODEL PROVIDER</small>
                <h2>模型服务配置</h2>
                <p>
                  密钥只写入服务端加密存储，页面永不回显完整值；实际请求目的地址由部署环境固定。
                </p>
              </div>
              <a-tag :color="model?.secretConfigured ? 'green' : 'orange'">{{
                model?.secretConfigured ? '密钥已配置' : '未配置密钥'
              }}</a-tag>
            </div>
            <div class="form-grid">
              <label
                >Provider<a-select v-model:value="modelForm.provider"
                  ><a-select-option value="mock">Mock</a-select-option
                  ><a-select-option value="qwen">通义千问</a-select-option></a-select
                ></label
              ><label>可信服务地址<a-input v-model:value="modelForm.baseUrl" disabled /></label
              ><label>Chat Model<a-input v-model:value="modelForm.chatModel" /></label
              ><label>Embedding Model<a-input v-model:value="modelForm.embeddingModel" /></label
              ><label
                >Embedding 维度<a-input-number
                  v-model:value="modelForm.embeddingDimension"
                  disabled /></label
              ><label
                >超时（ms）<a-input-number v-model:value="modelForm.timeoutMs" :min="1000" /></label
              ><label
                >最大输出 Token<a-input-number
                  v-model:value="modelForm.maxOutputTokens"
                  :min="128" /></label
              ><label
                >Temperature<a-input-number
                  v-model:value="modelForm.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1" /></label
              ><label
                >替换密钥（可留空）<a-input-password
                  v-model:value="modelForm.secret"
                  autocomplete="new-password"
              /></label>
            </div>
            <div class="editor-actions">
              <span class="capability-switch"
                >JSON 输出 <a-switch v-model:checked="modelForm.supportsJson"
              /></span>
              <span class="capability-switch"
                >工具调用 <a-switch v-model:checked="modelForm.supportsTools"
              /></span>
              <a-switch
                v-model:checked="modelForm.isEnabled"
                checked-children="启用"
                un-checked-children="停用"
              /><a-button type="primary" @click="saveModel">保存配置</a-button>
            </div>
          </article>
          <div class="prompt-grid">
            <article class="data-card">
              <small>PROMPT LAB</small>
              <h2>提示词测试</h2>
              <a-textarea v-model:value="promptContent" :rows="13" />
              <div v-if="promptTest" class="check-list">
                <span
                  v-for="item in promptTest.checks"
                  :key="item.key"
                  :class="{ pass: item.passed }"
                  >{{ item.passed ? '✓' : '×' }} {{ item.message }}</span
                >
              </div>
              <div class="editor-actions">
                <a-button @click="testPromptContent">运行防捏造检查</a-button
                ><a-button type="primary" @click="createPrompt">另存为新版本</a-button>
              </div>
            </article>
            <article class="data-card">
              <small>RELEASE HISTORY</small>
              <h2>版本与回滚</h2>
              <label class="rollout-field"
                >启用流量比例
                <a-input-number
                  v-model:value="promptRolloutPercent"
                  :min="1"
                  :max="100"
                  addon-after="%"
                />
              </label>
              <div v-for="item in prompts" :key="item.id" class="version-row">
                <div>
                  <b>{{ item.key }} · v{{ item.version }}</b
                  ><span>{{ item.status }} · 灰度 {{ item.rolloutPercent }}%</span>
                </div>
                <button
                  v-if="item.status !== 'active' || item.rolloutPercent < 100"
                  @click="activatePrompt(item)"
                >
                  {{
                    item.status === 'retired'
                      ? '回滚'
                      : item.status === 'active'
                        ? '更新比例'
                        : '启用'
                  }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="data-card">
          <div class="card-head">
            <div>
              <small>IMMUTABLE TRAIL</small>
              <h2>管理员操作审计</h2>
              <p>记录操作者、动作、对象、原因、结果与请求 ID；不记录简历或材料正文。</p>
            </div>
          </div>
          <a-table :data-source="auditLogs" :pagination="false" row-key="id" size="small"
            ><a-table-column title="时间"
              ><template #default="{ record }">{{
                new Date(record.createdAt).toLocaleString()
              }}</template></a-table-column
            ><a-table-column title="管理员" data-index="adminEmail" /><a-table-column
              title="动作"
              data-index="action"
            /><a-table-column title="对象"
              ><template #default="{ record }"
                >{{ record.targetType }} / {{ record.targetId }}</template
              ></a-table-column
            ><a-table-column title="原因" data-index="reason" /><a-table-column title="结果"
              ><template #default="{ record }"
                ><a-tag :color="record.result === 'success' ? 'green' : 'red'">{{
                  record.result
                }}</a-tag></template
              ></a-table-column
            ></a-table
          >
        </section>
      </a-spin>
    </main>

    <a-modal
      v-model:open="sensitiveOpen"
      :title="sensitiveTitle"
      ok-text="验证并执行"
      cancel-text="取消"
      :confirm-loading="loading"
      @ok="confirmSensitive"
    >
      <p class="reauth-note">此操作会影响系统状态，需要重新验证管理员身份，并记录操作原因。</p>
      <a-form layout="vertical"
        ><a-form-item label="当前管理员密码" required
          ><a-input-password
            v-model:value="sensitive.password"
            autocomplete="current-password" /></a-form-item
        ><a-form-item label="操作原因（至少 8 个字）" required
          ><a-textarea v-model:value="sensitive.reason" :rows="3" /></a-form-item
      ></a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: #f4f1e8;
  color: #102b43;
}
.admin-rail {
  position: fixed;
  inset: 0 auto 0 0;
  width: 17rem;
  display: flex;
  flex-direction: column;
  padding: 2rem 1.2rem;
  background: #0d283d;
  color: #fff;
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #fff;
  text-decoration: none;
  font: 1.1rem var(--serif);
}
.admin-brand b {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  background: #2148c8;
  box-shadow: 5px 5px 0 #ff6a4d;
  font: 700 1.4rem var(--serif);
}
.admin-brand small {
  color: #85a1b5;
  font: 700 0.58rem sans-serif;
  letter-spacing: 0.2em;
}
.admin-rail nav {
  display: grid;
  gap: 0.35rem;
  margin-top: 4rem;
}
.admin-rail nav a {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.7rem;
  padding: 1rem;
  color: #a9bac6;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.admin-rail nav a small {
  color: #577489;
}
.admin-rail nav a.active {
  border-left-color: #ff6a4d;
  background: #173c58;
  color: #fff;
  box-shadow: 4px 0 0 #ff6a4d;
}
.rail-foot {
  display: grid;
  gap: 0.65rem;
  margin-top: auto;
  padding: 0.9rem 0.4rem;
  border-top: 1px solid #315066;
  font-size: 0.72rem;
}
.rail-foot a,
.rail-foot button {
  color: #a9c6d9;
  background: none;
  border: 0;
  text-align: left;
}
.rail-foot span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.admin-main {
  margin-left: 17rem;
  padding: 2.5rem 3rem 5rem;
}
.admin-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding-bottom: 2rem;
  border-bottom: 1px solid #cfcbbf;
}
.admin-header > div > span,
.data-card > small,
.card-head small {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #2148c8;
}
.admin-header h1 {
  margin: 0.4rem 0 0;
  font: 400 3.4rem var(--serif);
}
.system-seal {
  display: flex;
  gap: 0.7rem;
  align-items: center;
}
.system-seal i {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  background: #31a66b;
  box-shadow: 0 0 0 5px #dcecdf;
}
.system-seal small {
  color: #7a817f;
}
.panel-stack {
  display: grid;
  gap: 1.2rem;
  margin-top: 2rem;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: #d1cec4;
  border: 1px solid #d1cec4;
}
.metric-grid article {
  display: grid;
  gap: 0.4rem;
  padding: 1.5rem;
  background: #fff;
}
.metric-grid small {
  color: #7a817f;
  letter-spacing: 0.12em;
}
.metric-grid strong {
  font: 400 2.6rem var(--serif);
}
.metric-grid span {
  color: #7a817f;
  font-size: 0.75rem;
}
.overview-grid,
.prompt-grid,
.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  margin-top: 1.2rem;
}
.data-card {
  padding: 1.6rem;
  border: 1px solid #d5d2c8;
  background: #fff;
  box-shadow: 0 12px 30px rgba(16, 43, 67, 0.06);
}
.data-card h2 {
  margin: 0.25rem 0 1rem;
  font: 400 1.8rem var(--serif);
}
.data-card h3 {
  margin: 1.2rem 0 0.55rem;
  font-size: 0.8rem;
}
.card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.card-head h2 {
  margin: 0.25rem 0;
}
.card-head p,
.editor-card p {
  margin: 0;
  color: #78828a;
  font-size: 0.78rem;
}
.status-row {
  display: grid;
  grid-template-columns: 1fr repeat(3, auto);
  gap: 1rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid #ece9e1;
  font-size: 0.78rem;
}
.status-row em {
  color: #c84834;
  font-style: normal;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chips span {
  padding: 0.4rem 0.65rem;
  background: #f2efe6;
  font-size: 0.72rem;
}
.table-foot {
  margin: 1rem 0 0;
  color: #7a817f;
}
.version-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 0;
  border-bottom: 1px solid #ece9e1;
}
.version-row > div:first-child {
  display: grid;
  flex: 1;
}
.version-row span {
  color: #7d878e;
  font-size: 0.7rem;
}
.row-actions {
  display: flex;
  gap: 0.65rem;
}
.version-row button {
  border: 0;
  background: none;
  color: #2148c8;
  font-size: 0.74rem;
  cursor: pointer;
}
.editor-card textarea,
.prompt-grid textarea {
  font:
    12px/1.55 ui-monospace,
    Consolas,
    monospace;
}
.admin-template-preview {
  margin-top: 1rem;
}
.capability-switch {
  color: #596a76;
  font-size: 0.72rem;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1rem;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.form-grid label {
  display: grid;
  gap: 0.4rem;
  color: #596a76;
  font-size: 0.72rem;
}
.check-list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.8rem;
}
.check-list span {
  color: #c84834;
  font-size: 0.75rem;
}
.check-list span.pass {
  color: #27855a;
}
.reauth-note {
  padding: 0.8rem;
  border-left: 3px solid #ff6a4d;
  background: #f5f1e7;
  color: #596a76;
  font-size: 0.8rem;
}
@media (max-width: 1050px) {
  .metric-grid,
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .overview-grid,
  .prompt-grid,
  .template-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 760px) {
  .admin-rail {
    position: static;
    width: auto;
    min-height: auto;
  }
  .admin-rail nav {
    grid-template-columns: repeat(2, 1fr);
    margin-top: 2rem;
  }
  .rail-foot {
    display: none;
  }
  .admin-main {
    margin-left: 0;
    padding: 1.5rem;
  }
  .admin-shell {
    display: block;
  }
  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }
  .admin-header h1 {
    font-size: 2.4rem;
  }
  .system-seal {
    display: none;
  }
}
</style>
