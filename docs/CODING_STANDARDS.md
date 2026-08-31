# AceResume API、Vue 与 TypeScript 编码规范

> 文档状态：已确认，可用于工程初始化、开发和代码审查  
> 对应版本：V1.0 MVP  
> 编写日期：2026-08-30

## 1. 文档目的

本文档对 AceResume 的 API 数据格式、字段命名、Vue 组件设计、TypeScript 使用方式和整体代码编写规则作出统一约定。

规范的优先级为：

1. 明确的当前任务需求。
2. `docs/PRD.md`。
3. `docs/TECHNICAL_ARCHITECTURE.md`。
4. 本文档。
5. 已有代码中的稳定模式。

如果已有代码与本文档不一致，不应在无关功能中一次性重构整个项目；应在当前改动范围内保持一致，并为系统性迁移单独建立任务。

## 2. 通用命名规范

| 场景 | 规则 | 示例 |
|---|---|---|
| TypeScript 变量、函数 | `camelCase` | `resumeId`、`loadResume` |
| TypeScript 类型、类 | `PascalCase` | `ResumeDocument`、`AuthService` |
| 常量 | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE` |
| Vue 组件文件 | `PascalCase.vue` | `ResumeSectionForm.vue` |
| 其他源码文件 | `kebab-case.ts` | `resume-service.ts` |
| Composable | `use` + PascalCase 语义 | `useResumeAutosave` |
| Pinia Store | `use` + 领域名 + `Store` | `useResumeEditorStore` |
| REST 路径 | 复数名词、`kebab-case` | `/api/v1/resume-versions` |
| 路由参数 | `camelCase` | `:resumeId` |
| JSON 字段 | `camelCase` | `createdAt`、`pageSize` |
| Query 参数 | `camelCase` | `sortBy`、`documentId` |
| 数据库表、列 | `snake_case` | `resume_versions`、`user_id` |
| 环境变量 | `UPPER_SNAKE_CASE` | `DATABASE_URL` |
| 错误码 | `UPPER_SNAKE_CASE` | `RESUME_VERSION_CONFLICT` |
| 枚举传输值 | 小写 `snake_case` | `in_progress`、`needs_confirmation` |
| SSE 事件名 | `domain.action` | `task.progress`、`ai.delta` |
| CSS 自定义属性 | `--kebab-case` | `--resume-font-size` |

### 2.1 命名语义

- 集合使用复数：`resumes`、`selectedDocumentIds`。
- 单个对象使用单数：`resume`、`selectedDocument`。
- 布尔值使用 `is`、`has`、`can`、`should`：`isVisible`、`hasNextPage`。
- 事件处理函数使用 `handle`：`handleSubmit`、`handleTemplateChange`。
- 传给组件的事件回调 Prop 使用 `on`：`onConfirm`，但优先使用 Vue Emit。
- 异步读取函数使用 `get`、`list`、`find`、`load`；写操作使用 `create`、`update`、`delete`、`restore`。
- 不使用 `data1`、`temp2`、`obj`、`info` 等缺乏领域含义的名称。
- 缩写保持一致：`id`、`api`、`url` 在变量中写作 `resumeId`、`apiClient`、`avatarUrl`。

## 3. API 总体规范

### 3.1 基础约定

- API 前缀统一为 `/api/v1`。
- 使用 REST 表达资源，动作型接口仅用于无法自然表达为资源操作的场景。
- 请求和响应使用 `application/json; charset=utf-8`，文件上传使用 `multipart/form-data`。
- JSON、Path 参数和 Query 参数使用 `camelCase`。
- 服务端字段映射到数据库时转换为 `snake_case`。
- 日期时间统一返回 UTC ISO 8601，例如 `2026-08-30T08:30:00.000Z`。
- ID 在 API 中统一为字符串。
- 不在响应中返回数据库内部列名或 ORM 对象。
- 不返回 `success: true`、HTTP 状态码副本等可由协议本身确定的冗余字段。
- 每个请求都生成 `requestId`，响应头返回 `X-Request-Id`；有响应体时也包含 `requestId`。

### 3.2 资源路径示例

```text
GET    /api/v1/resumes
POST   /api/v1/resumes
GET    /api/v1/resumes/:resumeId
PATCH  /api/v1/resumes/:resumeId
DELETE /api/v1/resumes/:resumeId

GET    /api/v1/resumes/:resumeId/versions
POST   /api/v1/resumes/:resumeId/versions
POST   /api/v1/resumes/:resumeId/restorations

POST   /api/v1/documents
GET    /api/v1/documents/:documentId
DELETE /api/v1/documents/:documentId

POST   /api/v1/ai-generation-tasks
GET    /api/v1/ai-generation-tasks/:taskId
POST   /api/v1/ai-suggestions/:suggestionId/approvals
```

不推荐：

```text
POST /api/v1/getResume
POST /api/v1/deleteResume
POST /api/v1/resume/doUpdate
```

## 4. API 成功响应

### 4.1 单个资源

```json
{
  "data": {
    "id": "7b35b2f4-3000-4fb1-85b2-67dbb9cbf817",
    "name": "前端开发校招简历",
    "status": "active",
    "version": 12,
    "createdAt": "2026-08-30T08:30:00.000Z",
    "updatedAt": "2026-08-30T09:10:00.000Z"
  },
  "requestId": "8bef8f16-2566-4f41-a651-a34e66c8d39d"
}
```

适用于 GET、POST 创建成功和 PATCH 更新成功。

### 4.2 普通数组

仅在数组规模确定且不需要分页时使用：

```json
{
  "data": [
    { "value": "zh-CN", "label": "中文" },
    { "value": "en-US", "label": "English" }
  ],
  "requestId": "uuid"
}
```

业务列表默认分页，不使用无边界数组。

### 4.3 页码分页

适用于管理后台、模板中心和需要跳页的列表：

```json
{
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 125,
      "totalPages": 7
    }
  },
  "requestId": "uuid"
}
```

请求参数：

```text
?page=1&pageSize=20&sortBy=updatedAt&sortOrder=desc
```

规则：

- `page` 从 1 开始。
- `pageSize` 由服务端限制最大值。
- `sortBy` 只能使用服务端白名单字段。
- `sortOrder` 只能为 `asc` 或 `desc`。
- `totalPages` 由服务端计算。

### 4.4 游标分页

适用于日志、AI 对话、活动流等持续增长的数据：

```json
{
  "data": {
    "items": [],
    "pageInfo": {
      "nextCursor": "opaque-cursor-or-null",
      "hasNextPage": false
    }
  },
  "requestId": "uuid"
}
```

一个接口只能采用一种分页方式，不在同一接口中混用页码与游标。

### 4.5 异步任务

创建文档解析、AI 生成或 PDF 导出任务时返回 HTTP 202：

```json
{
  "data": {
    "taskId": "uuid",
    "taskType": "pdf_export",
    "status": "queued",
    "resourceId": "uuid",
    "createdAt": "2026-08-30T09:10:00.000Z"
  },
  "requestId": "uuid"
}
```

任务状态统一为：

```text
pending
queued
running
succeeded
failed
cancelled
```

### 4.6 无响应体

删除成功且无需返回资源时使用 HTTP 204，不返回 JSON。`requestId` 仍通过 `X-Request-Id` 响应头返回。

## 5. API 错误响应

### 5.1 通用格式

```json
{
  "code": "RESUME_VERSION_CONFLICT",
  "message": "简历已在其他位置更新，请确认后重试",
  "details": {
    "expectedVersion": 11,
    "currentVersion": 12
  },
  "requestId": "uuid"
}
```

规则：

- `code` 是前端判断逻辑的稳定依据。
- `message` 是可展示给用户的中文信息，但前端可以根据场景替换更友好的文案。
- `details` 为可选对象，只包含安全、结构化的补充信息。
- `requestId` 用于日志关联和问题反馈。
- 不返回调用栈、SQL、文件系统路径、供应商密钥或第三方原始响应。

### 5.2 字段校验错误

使用 HTTP 422：

```json
{
  "code": "VALIDATION_FAILED",
  "message": "提交的数据不符合要求",
  "details": {
    "fields": [
      {
        "path": "sections.0.content.projectName",
        "code": "required",
        "message": "项目名称不能为空"
      },
      {
        "path": "pageSize",
        "code": "too_large",
        "message": "pageSize 不能大于 100"
      }
    ]
  },
  "requestId": "uuid"
}
```

`path` 使用 API JSON 字段路径，不使用数据库列名。

### 5.3 HTTP 状态码

| 状态码 | 用途 |
|---|---|
| 200 | 查询或更新成功 |
| 201 | 资源创建成功 |
| 202 | 异步任务已接受 |
| 204 | 删除成功且无响应体 |
| 400 | 请求格式损坏、JSON 无法解析等 |
| 401 | 未登录、凭证无效或过期 |
| 403 | 已登录但无权操作 |
| 404 | 资源不存在，或为防止泄露而表现为不存在 |
| 409 | 版本冲突、重复资源或状态冲突 |
| 413 | 文件或请求体过大 |
| 415 | 不支持的文件或媒体类型 |
| 422 | 字段或业务输入校验失败 |
| 429 | 请求过于频繁或超出 AI 配额 |
| 500 | 未预期的服务端错误 |
| 502 | 上游模型或外部服务返回无效结果 |
| 503 | 依赖服务暂不可用 |

### 5.4 错误码分类

```text
VALIDATION_*
AUTH_*
USER_*
PROFILE_*
RESUME_*
TEMPLATE_*
DOCUMENT_*
AI_*
EXPORT_*
ADMIN_*
INFRA_*
```

错误码一旦被前端使用，不随意重命名。新增错误码时同步加入共享契约和 API 文档。

## 6. API 字段约定

### 6.1 空值、缺失与清空

这是 PATCH 接口的重要约定：

- 字段缺失：不修改该字段。
- 字段值为 `null`：明确清空该字段，前提是 Schema 允许为空。
- 空字符串：仅表示真实允许的空文本，不用于代替 `null`。
- 空数组：明确设置为空集合。

示例：

```json
{
  "targetRole": null
}
```

表示清空求职目标；未提供 `targetRole` 表示保持原值。

### 6.2 时间

- API 传输时间使用 ISO 8601 UTC 字符串。
- 只有纯日期语义使用 `YYYY-MM-DD`，例如毕业日期可根据产品 Schema 决定是否只保存年月。
- 不向前端传输数据库时区相关对象。
- 前端只在展示层转换为本地时区。

### 6.3 ID 与数字

- 所有资源 ID 使用字符串。
- 版本号、页码、排序值和 Token 数使用整数。
- 不使用浮点数存储金额；未来如有金额，使用最小货币单位整数。
- AI 生成的百分比和量化结果在成为正式简历内容前必须通过来源校验。

### 6.4 枚举和状态

API 枚举值使用小写 `snake_case`：

```text
active
archived
parse_failed
needs_confirmation
```

前端显示文案通过映射表生成，不直接把枚举值展示给用户。

### 6.5 布尔字段

使用明确的正向语义：

```text
isVisible
isArchived
hasNextPage
canRestore
shouldCreateVersion
```

避免双重否定，例如 `isNotDisabled`。

### 6.6 富文本

- API 传输 Tiptap JSON 文档，不以未清理 HTML 作为源数据。
- 富文本 Schema 必须限制允许的 Node、Mark 和属性。
- 链接需要协议白名单。
- 服务端写入前再次验证，渲染前再次清理。

## 7. 并发与幂等约定

### 7.1 乐观锁

简历更新请求：

```json
{
  "baseVersion": 11,
  "patch": {
    "name": "前端开发校招简历"
  }
}
```

更新成功响应返回新 `version`。版本不一致时返回 HTTP 409 和 `RESUME_VERSION_CONFLICT`。

### 7.2 幂等键

创建 AI、PDF、导入等可能重复提交的任务时使用：

```text
Idempotency-Key: client-generated-uuid
```

相同用户、相同接口、相同幂等键在有效期内不应重复创建任务。

## 8. SSE 事件规范

### 8.1 事件名称

```text
task.started
task.progress
ai.delta
ai.suggestion
task.completed
task.failed
heartbeat
```

### 8.2 事件数据

```json
{
  "taskId": "uuid",
  "sequence": 12,
  "status": "running",
  "progress": 65,
  "message": "正在验证生成内容",
  "timestamp": "2026-08-30T09:12:00.000Z"
}
```

规则：

- `sequence` 单任务递增，前端用于去重和恢复。
- `progress` 为 0～100 的整数；无法量化时可以省略。
- SSE 是状态通知渠道，不是唯一可信数据源。
- 重连后前端应通过任务查询接口获取最新状态。
- SSE 断开不能中止后台任务。

## 9. 共享契约规范

`packages/contracts` 保存：

- 请求 Schema。
- 响应 Schema。
- 通用错误 Schema。
- 分页 Schema。
- SSE 事件 Schema。
- 稳定错误码。

命名示例：

```ts
CreateResumeRequestSchema
CreateResumeResponseSchema
ResumeSummarySchema
PaginatedResumeResponseSchema
ApiErrorSchema
AiSuggestionSchema
```

类型由 Schema 推导：

```ts
export type CreateResumeRequest = z.infer<
  typeof CreateResumeRequestSchema
>
```

禁止同时维护内容相同但互不关联的 Zod Schema、TypeScript interface 和后端 DTO。

## 10. Vue 组件分类

### 10.1 Page 组件

示例：

```text
ResumeListPage.vue
ResumeEditorPage.vue
ProfilePage.vue
AdminUserListPage.vue
```

职责：

- 连接路由参数和页面布局。
- 组合业务模块。
- 处理页面级加载、空状态和错误状态。
- 不实现大量可复用业务细节。
- 不直接调用 Axios。

### 10.2 Feature 组件

示例：

```text
ResumeSectionForm.vue
ResumeModuleSorter.vue
AiSuggestionPanel.vue
DocumentImportReview.vue
TemplateSelector.vue
```

职责：

- 完成一个明确业务能力。
- 可以调用所属模块的 composable、Store 或 service。
- 不直接依赖其他模块内部实现。

### 10.3 UI 组件

示例：

```text
AppEmptyState.vue
AppErrorState.vue
AppConfirmDialog.vue
```

职责：

- 不包含具体简历业务。
- 只通过 Props、Slots 和 Emits 通信。
- 不访问 Router、Pinia、Axios 和业务 Service。
- 优先复用 Ant Design Vue，只有确有统一封装价值时才创建。

### 10.4 Template 组件

- 只负责简历内容渲染。
- 不发起 API 请求。
- 不访问用户 Store。
- 不依赖 Ant Design Vue。
- 输入来自 `resume-schema` 和模板定义。
- 必须可用于浏览器预览和 PDF 渲染。

## 11. Vue 组件命名与接口

### 11.1 组件命名

- Page 组件以 `Page` 结尾。
- Layout 组件以 `Layout` 结尾。
- Dialog、Drawer、Form、List、Card 等后缀表达角色。
- 与业务强相关的组件带领域前缀，如 `Resume`、`Document`、`Ai`。
- 避免 `CommonComponent.vue`、`DataBox.vue` 等含义模糊名称。

### 11.2 Props

```ts
type Props = {
  section: ResumeSection
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})
```

规则：

- Props 视为只读。
- 必填和可选语义明确。
- 不传递整个 Store 给子组件。
- 不为减少几个 Prop 而传入超大业务对象。
- 默认值只用于真正可选的输入。

### 11.3 Emits

```ts
const emit = defineEmits<{
  save: [section: ResumeSection]
  cancel: []
  'update:modelValue': [value: string]
}>()
```

规则：

- Emit 表达已经发生的用户意图或状态变化。
- 事件负载具有明确类型。
- 模板中监听使用 `@update:model-value` 等 kebab-case 写法。
- 不用 Event Bus 代替清晰的组件关系或 Store。

### 11.4 Slots

- 通用布局和容器优先通过具名 Slot 扩展。
- 业务数据流不通过难以追踪的深层 Slot 隐式传递。
- Slot Props 必须有稳定语义。

## 12. Vue 组件实现规则

- 使用 Composition API 和 `<script setup lang="ts">`。
- 推荐顺序：imports、类型、Props/Emits、依赖、状态、计算属性、方法、生命周期。
- Computed 必须无副作用。
- Watcher 只用于响应式副作用，不用于替代 computed。
- 使用 `watch` 时明确源、触发时机和清理逻辑。
- 定时器、订阅、SSE 和事件监听在组件卸载时清理。
- `v-for` 使用稳定业务 ID，不使用数组索引作为可重排列表的 Key。
- 不在模板中调用具有副作用的方法。
- 不在组件初始化时隐式修改其他领域的 Store。
- 大型编辑器组件按状态、命令、渲染和面板拆分，避免形成单个巨型 `.vue` 文件。
- 不设僵化的代码行数上限，但组件出现多项独立职责时必须拆分。

## 13. Composable 规范

- 文件和函数以 `use` 开头，例如 `useResumeAutosave.ts`。
- 一个 composable 解决一个明确问题。
- 输入、输出和副作用必须可识别。
- 必须暴露停止、取消或清理能力的资源不能隐藏清理过程。
- 不将任意工具函数包装成 composable。
- 不在 composable 内直接使用全局单例，除非该依赖本身是明确的应用级服务。

示例：

```ts
type UseAutosaveOptions = {
  resumeId: Ref<string>
  baseVersion: Ref<number>
  save: (input: SaveResumeInput) => Promise<SaveResumeResult>
}

export function useResumeAutosave(options: UseAutosaveOptions) {
  // ...
  return {
    saveStatus,
    flush,
    retry,
    stop,
  }
}
```

## 14. Pinia Store 规范

- Store 使用 `useXxxStore` 命名。
- 优先使用 Setup Store，使状态、计算属性和动作职责明确。
- Store 不返回 Axios 原始响应。
- Store 调用模块 Service，Service 调用统一 API Client。
- Store 中保存业务需要的最小状态，不复制可计算数据。
- 派生状态使用 computed/getter。
- 异步动作明确设置 loading/error 状态或返回结果给调用者处理。
- 不让一个全局 Store 管理所有领域。
- 当前编辑器可有专用 Store，列表和管理后台状态不得混入。

推荐链路：

```text
Page / Feature Component
        ↓
Composable / Pinia Store
        ↓
Module Service
        ↓
Generated API Client / Axios Instance
```

## 15. TypeScript 编译规范

共享配置建议启用：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true
  }
}
```

若第三方库导致某项规则无法立即启用，应记录原因和局部解决方案，不直接关闭全部严格检查。

## 16. TypeScript 类型规则

### 16.1 `type` 与 `interface`

- 领域数据、联合类型和由 Zod 推导的类型优先使用 `type`。
- 需要被实现或扩展的服务契约可使用 `interface`。
- 不为个人偏好反复在两者之间转换已有稳定代码。

```ts
type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<StoredObject>
}
```

### 16.2 禁止随意使用 `any`

- 外部输入使用 `unknown`。
- 使用 Zod、类型守卫或明确判断缩小类型。
- 第三方库缺少类型时，在局部适配层补充类型，不把 `any` 扩散到业务代码。
- 必须使用 `any` 时添加原因注释并限制在最小作用域。

### 16.3 联合类型

任务和业务状态使用判别联合：

```ts
type AiTaskState =
  | { status: 'queued'; taskId: string }
  | { status: 'running'; taskId: string; progress?: number }
  | { status: 'succeeded'; taskId: string; suggestionIds: string[] }
  | { status: 'failed'; taskId: string; errorCode: string }
```

避免使用一组彼此可能矛盾的可选字段表达状态。

### 16.4 枚举

共享契约不优先使用 TypeScript `enum`。使用 `as const` 对象或 Zod Enum：

```ts
export const ResumeStatus = {
  Active: 'active',
  Archived: 'archived',
} as const

export type ResumeStatus =
  (typeof ResumeStatus)[keyof typeof ResumeStatus]
```

### 16.5 可选、`undefined` 与 `null`

- `undefined`：字段未提供或内部尚未计算。
- `null`：字段已知为空，并允许通过 API 明确清空。
- 不混用空字符串、`undefined` 和 `null` 表达同一语义。
- PATCH Schema 必须区分“未传”和“清空”。

### 16.6 类型断言

- 避免 `as SomeType` 和非空断言 `!`。
- 优先使用 Schema 校验、类型守卫或控制流缩小。
- `as const` 和 `satisfies` 可用于保持字面量类型并验证结构。
- 不使用双重断言 `as unknown as T` 绕过类型系统。

### 16.7 导入

- 类型使用 `import type`。
- 导入顺序统一为：第三方、Monorepo 包、应用绝对路径、相对路径、样式。
- 同模块导入合并，不保留未使用导入。
- 业务代码使用路径别名，单个模块内部短距离引用可以使用相对路径。

## 17. 函数编写规范

- 函数只承担一个清晰职责。
- 公共函数、异步函数和复杂回调显式声明返回类型。
- 优先使用对象参数处理多个同类参数。
- 不通过布尔位置参数控制多个行为，使用具名配置对象。
- 纯函数不得读取或修改隐藏全局状态。
- 对外部副作用使用明确命名，如 `saveResume`、`deleteDocument`。
- 提前返回处理错误和边界，避免过深嵌套。
- 不捕获错误后静默忽略。

不推荐：

```ts
updateResume(id, data, true, false)
```

推荐：

```ts
updateResume({
  resumeId,
  patch,
  createVersion: true,
  notify: false,
})
```

## 18. 异步与错误处理

- 所有 Promise 必须被 `await`、返回或明确处理。
- 网络请求支持超时和取消。
- 组件卸载后不继续更新已失效页面状态。
- 业务错误使用稳定错误码处理，不根据错误文案分支。
- `catch` 中的错误视为 `unknown`。
- 前端将基础设施错误转为统一用户反馈。
- 后端只在能够增加上下文、映射错误或执行补偿时捕获错误。
- 不重复记录同一错误多次，入口层统一记录最终失败。

## 19. 常量与配置

- 业务常量放在所属模块，不放入全局 `constants.ts` 大杂烩。
- 文件限制、分页上限、AI Top K、超时等可调参数进入配置。
- 不在多个位置重复硬编码状态值、错误码和字段名。
- 前端公开配置与后端密钥配置严格分离。
- 模型名称和 Provider 地址不能写死在业务逻辑中。

## 20. 注释与 TODO

- 注释解释“为什么”和“不明显的约束”，不复述代码。
- AI 防捏造、分页、并发和兼容性逻辑应说明原因。
- 复杂正则、算法和第三方限制应链接相应测试或文档。
- TODO 必须说明原因和完成条件，避免只写 `TODO: fix later`。

示例：

```ts
// TODO: OCR 上线后，将 image_only 状态接入人工确认流程。
```

## 21. 样式规范

- 应用界面优先使用 UnoCSS 和 Ant Design Vue Token。
- 简历模板使用明确的 CSS Variables 和受控 Less/CSS。
- 不在业务组件中大量使用内联 style。
- 动态样式值通过 CSS Variables 传递，避免生成不可追踪的类名。
- 选择器嵌套保持浅层，避免依赖 DOM 偶然结构。
- 不全局覆盖 Ant Design Vue 内部类，必须覆盖时限定到明确作用域并说明原因。
- 打印样式集中维护，不与普通页面样式混杂。

## 22. 可访问性与交互

- 表单字段具有可关联 Label 和错误提示。
- 图标按钮提供可访问名称。
- 弹窗打开后管理焦点，关闭后恢复焦点。
- 可拖拽排序同时提供键盘或按钮替代操作。
- 颜色不能作为唯一状态表达方式。
- AI、保存和导出进度提供文字状态。
- 破坏性操作要求明确确认，不通过模糊按钮文案诱导用户。

## 23. 测试相关代码规范

- 测试名称描述行为和结果，而不是函数实现。
- 优先通过可见文本、Role 和 Label 查询 DOM。
- `data-testid` 只用于缺少稳定语义选择器的元素。
- 不通过大量 Mock 掩盖模块集成问题。
- 时间、UUID、模型和外部服务在测试中使用可控依赖。
- AI 测试必须同时检查文本、来源、支持状态和风险标记。
- 模板测试使用固定数据，避免随机内容导致快照不稳定。

## 24. 代码审查清单

### API

- [ ] 路径、方法和状态码符合 REST 语义。
- [ ] 请求和响应经过共享 Schema 校验。
- [ ] JSON 字段为 `camelCase`，数据库字段未泄露。
- [ ] 错误码稳定，错误响应不含敏感信息。
- [ ] 列表具有边界和分页。
- [ ] 用户所有权在服务端校验。
- [ ] 并发写入有版本或幂等处理。

### Vue

- [ ] 组件职责清晰，未直接调用 Axios。
- [ ] Props、Emits 和 Slots 类型明确。
- [ ] 加载、空、错误和成功状态齐全。
- [ ] Watcher、定时器、SSE 和监听器正确清理。
- [ ] 可重排列表使用稳定 Key。
- [ ] 简历模板未依赖 Ant Design Vue。

### TypeScript

- [ ] 未新增无理由 `any`。
- [ ] 外部输入经过运行时校验。
- [ ] 空值语义一致。
- [ ] 状态使用判别联合或明确 Schema。
- [ ] 无双重断言和不安全非空断言。
- [ ] 公共接口和异步函数返回类型清晰。

### AI 与安全

- [ ] 模型输出经过 Schema 校验。
- [ ] 引用属于当前用户和本次材料范围。
- [ ] 数字和关键实体有来源。
- [ ] AI 不能直接写正式简历。
- [ ] 日志和错误中没有用户正文、Token 或 API Key。

## 25. Definition of Done

一项功能只有在以下条件满足后才视为完成：

1. 实现符合 PRD 的当前范围。
2. API 契约和字段命名符合本文档。
3. 核心外部输入具有运行时 Schema 校验。
4. 加载、空、错误、权限和并发边界已处理。
5. 相关单元、组件或集成测试已补充。
6. 通过 `pnpm lint`。
7. 通过 `pnpm typecheck`。
8. 通过 `pnpm test`。
9. 通过 `pnpm build`。
10. 主流程、模板、权限或 AI 改动完成对应专项验证。
11. Git diff 不包含无关改动、敏感数据和临时文件。
12. 文档、OpenAPI 或架构决策在需要时同步更新。

如果项目当前尚未建立某项脚本或运行环境，应明确报告未验证项，不能默认视为通过。
