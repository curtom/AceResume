# AceResume 技术架构与项目规范

> 文档状态：已确认，可用于工程初始化与研发实施  
> 对应产品版本：V1.0 MVP  
> 编写日期：2026-08-30  
> 当前运行目标：本地开发与本地演示  
> 后续目标：在不大规模重构的前提下迁移到公网部署

## 1. 文档目的

本文档统一定义 AceResume 的技术选型、系统架构、工程目录、模块边界、数据存储、接口约定、AI/RAG 工作流、模板和 PDF 方案、安全要求、编码规范、测试规范与本地运行方式。

产品需求以 [PRD.md](./PRD.md) 为准；本文档负责说明这些需求如何实现。若两份文档出现冲突，应先确认产品需求，再通过架构决策记录更新本文档，不应在代码中隐式改变产品规则。

## 2. 架构目标与原则

### 2.1 架构目标

1. 适合以一名前端开发者为主逐步完成，不引入不必要的分布式复杂度。
2. 前后端统一使用 TypeScript，降低上下文切换和重复类型定义。
3. 支持结构化简历、模板切换、实时预览、自动保存和稳定 PDF 导出。
4. 支持文档解析、向量检索、AI 生成和来源追踪。
5. AI 生成必须可验证、可追踪、可回退，并由用户最终确认。
6. 本地环境能够完整演示数据库、对象存储、队列、AI 和 PDF 主流程。
7. 未来部署时可替换基础设施实现，而不重写核心业务。

### 2.2 核心原则

- **模块化单体优先**：第一版不拆微服务。
- **业务 API 与异步 Worker 分离**：共享代码和数据库，但作为不同进程运行。
- **内容与表现分离**：简历内容、模板布局和用户样式参数分别存储。
- **统一渲染链路**：浏览器预览和服务端 PDF 共用模板引擎。
- **Schema 驱动**：API、简历内容、模板配置和 AI 输出均有明确 Schema。
- **服务端可信**：所有权限、校验和最终写入在服务端执行。
- **AI 非破坏性**：模型只能提出建议，不能绕过用户确认直接改写简历。
- **异步处理长任务**：解析、Embedding、AI、PDF 和清理任务进入队列。
- **本地优先但不写死本地实现**：文件、模型和邮件均通过适配层调用。
- **先验证再扩展**：先完成单栏模板和最小 AI 工作流，再扩展模板和 Agent 能力。

## 3. 已确认技术栈

### 3.1 前端

| 分类 | 技术 | 用途 |
|---|---|---|
| 框架 | Vue 3 | 用户端、编辑器和管理后台 |
| 语言 | TypeScript | 类型安全和共享数据契约 |
| 构建 | Vite | 本地开发、构建和环境变量管理 |
| 路由 | Vue Router | 页面路由、登录保护和后台权限路由 |
| 状态 | Pinia | 登录态、编辑会话和跨组件 UI 状态 |
| 请求 | Axios | API 请求、错误处理和 Token 刷新 |
| UI | Ant Design Vue | 工作台、表单、表格、弹窗和管理后台 |
| 原子样式 | UnoCSS | 布局、间距和常用工具类 |
| 样式 | CSS、Less、CSS Variables | 模板样式、打印样式和设计令牌 |
| 富文本 | Tiptap | 受控的段落、列表、加粗和链接编辑 |
| 校验 | Zod | 前端表单、共享 Schema 和 AI 输出校验 |
| 单元测试 | Vitest、Vue Test Utils | 逻辑与组件测试 |
| 端到端测试 | Playwright | 主流程、导出和视觉回归测试 |

### 3.2 后端

| 分类 | 技术 | 用途 |
|---|---|---|
| 框架 | NestJS | REST API、认证、模块组织和依赖注入 |
| 语言 | TypeScript | 与前端共享类型和 Schema |
| API | REST + OpenAPI | 普通业务接口和接口文档 |
| 流式通信 | SSE | AI 输出、任务状态和进度通知 |
| ORM | Drizzle ORM | PostgreSQL 访问、迁移和类型安全查询 |
| 数据库 | PostgreSQL | 关系数据、JSONB、版本和事务 |
| 向量扩展 | pgvector | 文档 Embedding 和相似度检索 |
| 缓存/队列 | Redis + BullMQ | 异步任务、限流、锁和短期状态 |
| 文件存储 | MinIO | 本地 S3 兼容对象存储 |
| PDF | Playwright + Chromium | 基于统一 HTML/CSS 的 PDF 导出 |
| 密码哈希 | Argon2id | 用户密码安全存储 |
| 日志 | 结构化日志库 | 请求、任务和错误日志 |

### 3.3 AI

| 分类 | 方案 |
|---|---|
| 主模型 | 阿里云百炼中的通义千问，具体模型名由配置决定 |
| 备用模型 | DeepSeek，可在 Provider 层接入 |
| Embedding | 国内合规文本向量模型，MVP 固定一个模型与向量维度 |
| 接入方式 | 后端通过 OpenAI 兼容接口或供应商适配器调用 |
| 输出方式 | JSON Schema 或 JSON Object，并由 Zod 再校验 |
| Agent 方式 | MVP 使用受控工作流；稳定后引入 LangGraph.js |
| 模型训练 | MVP 不微调，优先使用 Prompt、RAG、规则校验和评测集 |

### 3.4 本地基础设施

- PostgreSQL + pgvector
- Redis
- MinIO
- Mailpit 或等价本地邮件捕获服务
- Chromium 运行环境
- Docker Compose

应用开发期间可直接在宿主机运行 `web`、`api` 和 `worker`，基础设施通过 Docker Compose 运行，以获得更快的热更新体验。

## 4. 系统总体架构

```text
┌─────────────────────────────────────────────────────────┐
│                    Vue 3 Web Application                │
│ 用户端 / 简历编辑器 / 模板中心 / 材料库 / 管理后台      │
└──────────────────────┬──────────────────────────────────┘
                       │ REST / SSE
┌──────────────────────▼──────────────────────────────────┐
│                      NestJS API                         │
│ Auth / Profile / Resume / Template / Document / Admin  │
│ 权限校验 / 数据校验 / 任务投递 / OpenAPI                │
└───────┬──────────────────┬──────────────────┬───────────┘
        │                  │                  │
        ▼                  ▼                  ▼
 PostgreSQL + pgvector   Redis/BullMQ       MinIO
 业务/版本/向量数据       队列/限流/状态      原始文件
                           │
                ┌──────────▼──────────┐
                │    NestJS Worker    │
                │ 文档解析 / Embedding│
                │ AI 工作流 / PDF     │
                │ 文件清理 / 邮件     │
                └──────┬────────┬─────┘
                       │        │
                       ▼        ▼
                 国内模型 API  Chromium
```

### 4.1 架构形态

系统采用模块化单体，而不是微服务：

- `api` 与 `worker` 使用同一代码仓库、数据模型和公共模块。
- `api` 负责短请求、权限校验、业务写入和任务投递。
- `worker` 负责长耗时和可重试任务。
- 两者通过 PostgreSQL、Redis/BullMQ 和对象存储协作。
- 任一模块未来确有独立扩容需求时，再从清晰模块边界拆出服务。

### 4.2 暂不采用的方案

- 暂不使用 GraphQL。
- 暂不使用 WebSocket，流式与进度优先使用 SSE。
- 暂不增加 Python 微服务。
- 暂不增加独立向量数据库。
- 暂不使用 Kubernetes。
- 暂不引入 DDD、CQRS、事件溯源等重型架构。
- 暂不使用低代码 Agent 平台作为核心运行时。

## 5. Monorepo 与目录规范

项目使用 pnpm workspace：

```text
AceResume/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/               # 应用初始化、Provider、全局配置
│  │  │  ├─ router/            # 路由和守卫
│  │  │  ├─ layouts/           # 用户端、编辑器、管理后台布局
│  │  │  ├─ pages/             # 路由页面
│  │  │  ├─ modules/           # 按业务领域组织的功能代码
│  │  │  ├─ components/        # 跨业务通用组件
│  │  │  ├─ stores/            # 全局 Pinia Store
│  │  │  ├─ api/               # Axios 实例和生成的 API Client
│  │  │  ├─ styles/            # 全局令牌、基础样式和打印样式
│  │  │  └─ utils/
│  │  └─ tests/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ bootstrap/
│  │  │  ├─ modules/
│  │  │  ├─ common/
│  │  │  └─ main.ts
│  │  └─ tests/
│  └─ worker/
│     ├─ src/
│     │  ├─ processors/
│     │  ├─ bootstrap/
│     │  └─ main.ts
│     └─ tests/
├─ packages/
│  ├─ contracts/               # API 请求、响应、错误和 Zod Schema
│  ├─ resume-schema/           # 简历模块和版本 Schema
│  ├─ template-engine/         # 确定性 HTML/CSS 渲染
│  ├─ ai-core/                 # Provider、Prompt、检索和工作流
│  ├─ config/                  # ESLint、TSConfig 等共享配置
│  └─ shared/
├─ infrastructure/
│  ├─ docker/
│  └─ migrations/
├─ docs/
│  ├─ PRD.md
│  ├─ TECHNICAL_ARCHITECTURE.md
│  └─ adr/                     # 架构决策记录
├─ pnpm-workspace.yaml
├─ docker-compose.yml
└─ package.json
```

### 5.1 模块依赖规则

- `apps/*` 可以依赖 `packages/*`。
- `packages/*` 不得反向依赖 `apps/*`。
- `contracts` 不依赖浏览器或 NestJS 运行时。
- `resume-schema` 不依赖 UI 组件库。
- `template-engine` 不依赖 Ant Design Vue。
- `ai-core` 不直接访问 HTTP 请求对象或前端 Store。
- 业务模块不能绕过所属模块直接操作其数据库表。
- 禁止在 `shared` 中堆放具有明确业务归属的代码。

## 6. 前端架构规范

### 6.1 模块划分

`apps/web/src/modules` 建议包括：

```text
auth/
dashboard/
profile/
resume/
resume-editor/
template/
document/
ai-assistant/
settings/
admin/
```

每个业务模块可以包含：

```text
components/
composables/
stores/
services/
schemas/
types/
utils/
```

只在实际需要时创建目录，不预先生成大量空层级。

### 6.2 状态职责

Pinia 主要保存：

- 当前登录用户的轻量信息。
- 当前简历编辑会话。
- 未保存变更和保存状态。
- 撤销/重做栈。
- 编辑器面板、选中模块等 UI 状态。

普通服务端列表和详情优先由请求缓存层管理，不长期复制进多个 Store。当前简历服务端版本号必须与本地草稿一起保存。

### 6.3 简历编辑状态

编辑状态必须是结构化对象，而不是整页 HTML：

```ts
type ResumeDocument = {
  schemaVersion: number
  resumeId: string
  templateVersionId: string
  locale: 'zh-CN' | 'en-US'
  sections: ResumeSection[]
  theme: ResumeTheme
}
```

富文本字段使用 Tiptap JSON 文档格式存储，不直接信任或永久保存未经处理的 HTML。渲染前通过白名单转换为安全 HTML。

### 6.4 CSS 职责

- UnoCSS：应用界面的布局、间距和常用工具类。
- Ant Design Vue：业务表单、表格、弹窗及后台组件。
- CSS Variables：颜色、字体、字号、间距、圆角等令牌。
- Less：简历模板、打印规则和复杂局部样式。
- 简历画布使用独立样式作用域，避免被应用全局样式污染。
- 不在简历导出 DOM 内使用 Ant Design Vue 组件。
- 禁止在组件中大量散落不可追踪的硬编码颜色和间距。

### 6.5 API 调用

- 统一使用封装后的 Axios 实例。
- 组件不得直接拼接 API URL。
- 请求和响应类型来自 `packages/contracts` 或 OpenAPI 生成客户端。
- 全局处理认证过期、网络异常和通用错误。
- 业务错误由页面或模块根据错误码处理。
- 取消已失效的搜索、预览和 AI 流式请求。

### 6.6 自动保存

1. 用户修改后先更新内存状态。
2. 同步写入 IndexedDB 临时草稿。
3. 停止编辑 2 秒后向后端发送防抖保存请求。
4. 请求携带 `baseVersion` 和幂等标识。
5. 服务端事务保存并递增 `version`。
6. 版本冲突返回 HTTP 409，前端不得静默覆盖。
7. 成功后更新本地服务端版本号和保存状态。

### 6.7 管理后台

第一版管理后台与用户端共用 `apps/web`，使用 `/admin` 路由和独立布局。前端路由守卫只负责用户体验，真正权限必须由后端 Guard 校验。

## 7. 后端架构规范

### 7.1 NestJS 模块

| 模块 | 职责 |
|---|---|
| AuthModule | 注册、登录、刷新、退出、邮箱验证和找回密码 |
| UsersModule | 用户状态、账号设置和注销 |
| ProfilesModule | 个人资料和结构化经历条目 |
| ResumesModule | 简历、模块、复制、版本和恢复 |
| TemplatesModule | 模板定义、模板版本、发布和下架 |
| DocumentsModule | 上传、材料元数据、解析状态和删除 |
| AiModule | AI 任务创建、建议、引用和用户确认 |
| ExportsModule | PDF 任务创建、状态和下载授权 |
| JobsModule | BullMQ 队列定义和任务投递 |
| AdminModule | 后台聚合接口和管理操作 |
| AuditModule | 管理操作和敏感访问审计 |
| HealthModule | API、数据库、Redis 和对象存储健康检查 |

### 7.2 分层约定

每个业务模块遵循简化分层：

```text
controller  →  application service  →  repository / adapter
                     │
                     └→ domain rules
```

- Controller 只负责协议转换、认证信息提取和返回结果。
- Application Service 负责用例编排和事务边界。
- Repository 负责数据库读写。
- Adapter 负责对象存储、模型、邮件等外部系统。
- 领域规则不得散落在 Controller 或队列处理器中。
- Worker Processor 调用应用服务，不复制业务逻辑。

### 7.3 API 规范

- API 前缀：`/api/v1`。
- 路径使用复数名词和短横线，例如 `/resume-versions`。
- 使用标准 HTTP 方法和状态码。
- 日期统一使用 UTC ISO 8601 字符串。
- ID 使用 UUID。
- 列表接口统一使用游标或页码分页，不返回无限数组。
- 修改接口支持幂等键或乐观锁。
- OpenAPI 文档必须随接口同步更新。

成功响应建议为：

```json
{
  "data": {},
  "requestId": "uuid"
}
```

错误响应建议为：

```json
{
  "code": "RESUME_VERSION_CONFLICT",
  "message": "简历已在其他位置更新",
  "details": {},
  "requestId": "uuid"
}
```

禁止让前端依赖数据库异常文本或第三方模型原始错误文本。

### 7.4 认证方案

- 邮箱和密码注册。
- 密码使用 Argon2id 哈希，不保存或记录明文密码。
- Access Token 为短期凭证，仅保存在前端内存。
- Refresh Token 使用 `HttpOnly` Cookie，并实施轮换。
- 数据库仅保存 Refresh Token 哈希、设备信息和过期时间。
- 页面刷新时通过 Refresh Cookie 获取新 Access Token。
- 本地开发可使用 Mailpit 接收验证和重置邮件。
- 管理员接口增加角色 Guard 和审计拦截器。
- 正式部署时启用 Secure Cookie、HTTPS 和明确的 CORS/CSRF 策略。

### 7.5 权限规范

- 每次读取和修改用户资源都必须包含所有权条件。
- 不允许先通过 ID 查出资源，再只在前端判断归属。
- 管理员默认不能查看用户原始材料和完整简历。
- 敏感排障访问必须记录操作者、理由、目标、时间和结果。
- 对象存储下载通过后端授权或短期签名地址完成。

## 8. 数据库设计规范

### 8.1 核心表

```text
users
user_sessions
email_verification_tokens
password_reset_tokens

profiles
profile_entries

resumes
resume_sections
resume_versions

templates
template_versions

documents
document_chunks
document_imports

ai_tasks
ai_generations
ai_citations

export_jobs
admin_audit_logs
```

### 8.2 关系数据与 JSONB

使用普通字段保存：

- ID、用户归属、状态、名称、类型和时间。
- 外键、排序、版本号、任务状态和权限信息。
- 需要筛选、连接、聚合或建立索引的字段。

使用 JSONB 保存：

- 经过 Schema 校验的简历模块内容。
- 完整简历历史快照。
- 模板布局和样式变量。
- AI 原始结构化输出。
- 不同任务类型的可变配置。

禁止把所有业务数据放入一个大型 JSONB 字段。所有 JSONB 对象必须包含或关联明确的 `schema_version`。

### 8.3 推荐关键字段

`resumes`：

```text
id
user_id
name
target_role
locale
template_version_id
status
version
created_at
updated_at
deleted_at
```

`resume_sections`：

```text
id
resume_id
section_type
title
content jsonb
sort_order
is_visible
schema_version
created_at
updated_at
```

`document_chunks`：

```text
id
user_id
document_id
content
page_number
section_path
chunk_index
token_count
embedding_model
embedding_dimension
embedding vector
created_at
```

### 8.4 数据隔离

- 所有用户业务表均保存 `user_id` 或可通过强外键链路确定用户。
- 文档向量检索必须先限制 `user_id` 和选中的 `document_id`。
- 任何相似度搜索都不得跨用户召回结果。
- 集成测试必须覆盖水平越权。

### 8.5 删除策略

- 简历和普通业务条目优先软删除，保留短期恢复能力。
- 用户明确删除原始材料后，创建清理任务删除对象、文本和向量。
- 清理任务必须幂等，并记录成功或失败状态。
- 已经由用户确认写入简历的文字不自动删除，只把引用状态标记为来源已删除。
- 管理员日志不能随普通用户数据删除操作直接移除。

### 8.6 迁移规范

- 数据库结构只通过 Drizzle migration 修改。
- 已在其他环境执行的迁移不得重写，应新增迁移修正。
- 迁移文件进入 Git。
- 破坏性结构变更必须先提供兼容迁移和数据验证步骤。
- 开发环境种子数据与生产业务数据脚本分离。
- 模板种子数据必须使用虚构人物和脱敏内容。

### 8.7 索引建议

- 外键和高频过滤字段建立普通索引。
- 用户列表查询常用 `(user_id, updated_at)` 组合索引。
- 简历名称可按需求增加模糊查询索引。
- pgvector 初期数据量小可使用精确检索。
- 达到实际性能瓶颈并完成召回率评估后再增加 HNSW。
- 不因“使用了向量数据库能力”而提前创建无意义索引。

## 9. 对象存储与文件处理

### 9.1 存储抽象

定义统一接口：

```ts
interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<StoredObject>
  getObject(key: string): Promise<ReadableStream>
  deleteObject(key: string): Promise<void>
  createSignedUrl(key: string, expiresInSeconds: number): Promise<string>
}
```

当前实现使用 MinIO；未来部署时替换为云对象存储适配器。业务代码不得依赖 MinIO 专有 URL。

### 9.2 上传流程

1. API 验证登录态、文件大小、扩展名和 MIME。
2. 生成服务端对象 Key，不使用用户原始路径。
3. 保存文件到 MinIO。
4. 创建 `documents` 记录，状态为 `uploaded`。
5. 投递 `document.parse` 任务。
6. Worker 提取文本并更新状态。
7. 成功后投递切片和 Embedding 任务。
8. 前端通过轮询或 SSE 获取状态。

### 9.3 支持范围

MVP 支持：

- DOCX
- 文本型 PDF
- TXT
- Markdown

MVP 不支持：

- 扫描 PDF
- 图片 OCR
- 受密码保护文件
- 复杂版式自动复刻
- 宏、脚本或可执行附件

### 9.4 安全要求

- 文件名只用于展示，不作为对象路径。
- 服务端重新判断 MIME，不只相信浏览器上报。
- 解析在 Worker 中进行，失败不能导致 API 进程退出。
- 限制解析时间、解压大小、页数和文本长度。
- 富文本和提取文本在展示前转义。

## 10. 队列与异步任务规范

### 10.1 队列划分

建议队列名称：

```text
document.parse
document.embed
ai.generate
pdf.export
storage.cleanup
email.send
```

### 10.2 通用任务状态

```text
pending → queued → running → succeeded
                         └→ failed
                         └→ cancelled
```

### 10.3 任务规范

- 每个任务携带 `jobId`、`userId`、业务对象 ID 和幂等键。
- Processor 执行前重新校验业务对象是否仍然存在。
- 默认最多重试 3 次，采用指数退避；不可重试错误直接失败。
- 外部模型限流和参数错误不得无限重试。
- 任务失败保存稳定错误码和脱敏信息。
- 用户删除文件后，尚未开始的解析和 Embedding 任务应停止。
- API 不等待长任务完成，只返回任务 ID。
- SSE 中断不影响后台任务继续运行。

## 11. 简历 Schema 与模板引擎

### 11.1 内容、模板与主题分离

```text
ResumeDocument：用户内容与模块顺序
TemplateDefinition：布局、区域、支持模块和分页策略
ResumeTheme：用户允许调整的字体、颜色和间距
```

切换模板只改变 `templateVersionId` 和可用主题参数，不改变或删除简历内容。

### 11.2 模板定义

模板至少声明：

- 模板 ID 和版本。
- 支持的语言。
- 单栏、双栏等布局区域。
- 支持的模块类型。
- 默认模块位置和顺序。
- 可调整的字体、字号、颜色和间距范围。
- 页边距、分页和条目跨页规则。
- 字体依赖和授权信息。
- Schema 版本。

### 11.3 统一渲染

`packages/template-engine` 接收确定性输入并输出 HTML/CSS：

```ts
renderResume({
  resume,
  template,
  theme,
  mode: 'screen' | 'print'
})
```

要求：

- 相同输入必须产生相同结构。
- 不在渲染期间请求业务 API。
- 不依赖 Ant Design Vue。
- 富文本经过白名单转换和清理。
- 每个模板拥有截图或 PDF 基准测试样例。

### 11.4 浏览器预览

- 推荐使用 iframe 或严格隔离容器承载简历预览。
- A4 使用明确尺寸和页面间隔。
- 预览更新采用节流，避免每个键入都进行昂贵的全量测量。
- 分页计算结果不得反向修改用户原始内容。
- 溢出、孤行和高风险跨页通过提示反馈用户。

### 11.5 PDF 导出

1. 用户提交指定 `resumeVersionId` 的导出任务。
2. Worker 加载该版本对应的简历和模板版本。
3. 模板引擎生成独立 HTML/CSS。
4. Playwright/Chromium 加载内容并等待字体完成。
5. 执行分页与溢出检查。
6. 使用打印 CSS 生成文本可选择的 PDF。
7. 保存到临时对象或直接返回受控下载结果。
8. 记录模板版本、简历版本、耗时和错误。

禁止使用截图作为正式 PDF 主方案。

## 12. AI Provider 架构

### 12.1 Provider 接口

```ts
interface ChatModelProvider {
  generateText(input: ChatInput): Promise<ChatResult>
  generateStructured<T>(input: StructuredInput<T>): Promise<T>
  streamText(input: ChatInput): AsyncIterable<ModelEvent>
}

interface EmbeddingProvider {
  embed(input: string[]): Promise<EmbeddingResult>
}
```

首个实现为 `QwenProvider`，备用实现为 `DeepSeekProvider`。模型 API Key 只能存在于后端环境变量或加密配置中，不能发送给浏览器。

### 12.2 模型配置

模型配置至少包含：

- Provider 类型。
- Base URL。
- 模型名称。
- 是否支持 JSON Schema。
- 是否支持 Function Calling。
- 超时和重试策略。
- 最大输出长度。
- 温度等生成参数。
- Embedding 维度。
- 是否启用。

本地演示阶段配置主要来自 `.env`；管理后台可维护非敏感配置。任何 API Key 都不得通过后台接口完整回显。

### 12.3 模型职责分离

| 任务 | 推荐策略 |
|---|---|
| 文档分类与字段提取 | 快速模型 + 严格结构化输出 |
| 项目/实习描述生成 | 质量较高的生成模型 |
| JD 关键词提取 | 快速模型 |
| 事实支持度判断 | 规则校验 + 独立模型步骤 |
| 中英文转换 | 生成模型或专用翻译模型 |
| 文档向量化 | 固定的 Embedding 模型 |

MVP 只使用一个 Embedding 模型和固定维度。更换 Embedding 模型时必须创建重新向量化任务，不能混用不同维度或空间的向量。

## 13. RAG 检索设计

### 13.1 入库流程

```text
原始文件
  → 文本提取
  → 章节与页码识别
  → 语义切片
  → 文本清理
  → Embedding
  → PostgreSQL + pgvector
```

切片初始参数建议：

- 以标题、段落和列表为优先边界。
- 目标长度约 500 Token。
- 相邻切片重叠约 80 Token。
- 保留文件、页码、章节路径和切片序号。
- 参数必须可配置，并通过真实材料评测后调整。

### 13.2 检索流程

```text
用户要求
  → 解析目标模块与写作重点
  → 限制 user_id 和用户选中的 document_id
  → 向量召回 Top K
  → 关键词与结构化资料补充
  → 去重和重排序
  → 选择最终上下文
```

初始可使用 `Top K = 8`，重排序或去重后向生成模型提供约 4 个高相关片段。该数值属于可调参数，不是业务常量。

### 13.3 检索安全

- 权限过滤必须在数据库查询中生效。
- 文档内容视为不可信数据，不能覆盖系统指令。
- 检索结果必须保留 `chunkId`，用于后续引用和事实验证。
- JD 只作为写作目标，不进入用户事实来源集合。

## 14. AI 工作流与 Agent 规范

### 14.1 MVP 工作流

```text
validateInput
    ↓
selectAndRetrieveSources
    ↓
detectSourceConflicts
    ├─ 缺少或冲突 → createClarificationQuestions
    └─ 资料充分
            ↓
        extractFacts
            ↓
        draftResumeContent
            ↓
        validateNumbersAndEntities
            ↓
        verifyClaimSupport
            ↓
        createSuggestion
            ↓
        waitForUserApproval
            ↓
        applyApprovedPatch
```

### 14.2 工具边界

Agent 或工作流可以使用：

```text
get_profile_entries
search_documents
get_document_chunk
get_resume_section
analyze_job_description
validate_claims
create_clarification_questions
propose_resume_patch
```

禁止提供可绕过确认的直接写入工具。`applyApprovedPatch` 只能由普通业务服务在验证用户批准记录后执行。

### 14.3 LangGraph.js 引入策略

- MVP 前期使用普通 TypeScript 服务和明确状态机实现。
- 当流程出现恢复、分支、等待用户确认和多轮上下文需求时，引入 LangGraph.js。
- LangGraph.js 只负责 `ai-core` 内部编排，不承担用户、文件或简历的基础业务。
- Graph State 保存 ID、事实和结构化中间结果，不保存不必要的重复全文。
- Checkpoint 必须与用户和 AI 任务绑定，恢复时重新检查权限。

### 14.4 不进行模型微调的原因

MVP 阶段用户材料少且动态变化，核心问题是事实检索、引用和流程约束，不是模型缺少固定领域知识。因此优先顺序为：

1. Prompt 和结构化输出。
2. RAG 和引用。
3. 确定性规则校验。
4. 人工确认。
5. 评测集与错误分析。
6. 模型路由和 Prompt 优化。
7. 积累足够高质量标注数据后再评估微调。

## 15. AI 防捏造实现规范

### 15.1 生成结果结构

每条 AI 建议至少包含：

```ts
type ResumeSuggestion = {
  id: string
  text: string
  citations: Array<{
    sourceType: 'profile' | 'document'
    sourceId: string
    chunkId?: string
    quoteRange?: { start: number; end: number }
  }>
  supportStatus: 'supported' | 'conflict' | 'unsupported'
  missingFacts: string[]
  riskFlags: string[]
}
```

### 15.2 校验层级

1. **Schema 校验**：模型输出必须通过 JSON/Zod Schema。
2. **权限校验**：引用必须属于当前用户和本次选择的材料。
3. **数字校验**：生成文本中的数字、百分比、金额和排名必须能在来源中找到或由用户确认。
4. **实体校验**：学校、公司、项目、职位、技术栈和证书等关键实体需有来源。
5. **冲突校验**：不同来源存在矛盾时不能自动选择。
6. **语义校验**：单独步骤判断引用是否真正支持陈述。
7. **用户确认**：只有用户批准后才创建正式简历变更。

不能只依赖“再让模型检查一次”。数字和关键实体应优先由确定性程序规则检查，模型校验作为补充。

### 15.3 提示注入防护

- 系统提示明确声明文档仅为资料，不是指令。
- 不向模型暴露与当前任务无关的工具。
- 工具参数必须经过 Schema 和权限校验。
- 文档中出现“忽略之前要求”等内容时作为普通文本处理。
- 模型输出不能包含可直接执行的代码、SQL 或对象存储操作。
- Prompt 模板必须版本化。

### 15.4 AI 评测

建立脱敏评测集，覆盖：

- 中文项目经历。
- 实习经历。
- 缺少量化数据的材料。
- 多份材料相互冲突。
- JD 要求包含用户没有的技能。
- 文档提示注入文本。
- 中英文转换。
- 无关或低质量材料。

核心指标：

- 结构化输出成功率。
- 来源引用正确率。
- 关键事实支持率。
- 数字捏造率。
- 无依据内容拦截率。
- 用户接受率和编辑后接受率。
- 延迟、Token 使用和失败率。

AI Prompt 或模型变更必须先运行评测集，不能只凭少量人工对话判断效果。

## 16. 自动保存与版本规范

### 16.1 乐观锁

`resumes.version` 为递增整数。保存请求携带 `baseVersion`：

- 相同：事务保存并递增版本。
- 不同：返回 `409 RESUME_VERSION_CONFLICT`。
- 前端展示服务端版本、本地草稿和可选恢复操作。
- 禁止使用无条件最后写入覆盖。

### 16.2 历史版本点

以下事件创建关键版本：

- 用户手动创建版本。
- 接受 AI 建议。
- 切换模板。
- 批量导入旧简历。
- 恢复历史版本。
- 达到约定编辑间隔。

每份简历保留最近 20 个关键版本。恢复历史版本时创建一个新版本，不修改旧版本记录。

### 16.3 本地草稿

- IndexedDB 保存尚未同步的草稿、简历 ID 和基础版本号。
- 成功同步后更新或清除临时记录。
- 草稿不得保存 Access Token 或模型 API Key。
- 发现过期草稿时让用户选择恢复或丢弃，不自动覆盖服务端版本。

## 17. 安全与隐私规范

即使当前仅本地演示，也按照未来部署要求设计核心边界：

- 密码使用 Argon2id。
- Token 不写入日志或 Git。
- 前端不保存长期凭证到 `localStorage`。
- API 对用户资源执行服务端所有权校验。
- 富文本输出经过白名单清理，防止 XSS。
- 文件采用类型、大小和解析限制。
- AI 每次只发送任务所需的最少材料。
- 日志不得记录完整简历、电话、邮箱、密码或模型密钥。
- 管理员敏感操作写入审计日志。
- 用户删除文件后同步清理向量和文本。
- `.env`、本地文件、数据库卷和 MinIO 数据目录不得提交 Git。

## 18. 日志与错误处理

### 18.1 日志规范

统一使用结构化日志，至少包含：

```text
timestamp
level
service
requestId / jobId
module
event
durationMs
result
errorCode
```

禁止记录：

- 密码和 Token。
- API Key。
- 用户完整文档和简历正文。
- 未脱敏联系方式。
- 模型完整上下文。

### 18.2 错误分类

- `VALIDATION_*`：输入校验。
- `AUTH_*`：认证。
- `FORBIDDEN_*`：权限。
- `RESUME_*`：简历业务。
- `DOCUMENT_*`：文件和解析。
- `AI_*`：模型和生成工作流。
- `EXPORT_*`：PDF 导出。
- `INFRA_*`：数据库、Redis、对象存储等基础设施。

第三方错误必须映射为稳定业务错误，不把调用栈和供应商敏感信息返回给前端。

## 19. 编码规范

### 19.1 TypeScript

- 启用 `strict`。
- 建议启用 `noUncheckedIndexedAccess`。
- 禁止无理由使用 `any`；未知外部数据先使用 `unknown` 并校验。
- 公共函数和复杂对象显式声明输入输出类型。
- 类型从 Schema 推导时不重复手写相同接口。
- 使用判别联合表达任务状态和业务状态。
- 不用 TypeScript 类型断言绕过外部数据校验。

### 19.2 命名

- 文件名使用 `kebab-case`。
- Vue 组件使用 `PascalCase.vue`。
- 变量和函数使用 `camelCase`。
- 类型、类和枚举使用 `PascalCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- 数据库表和列使用 `snake_case`。
- API 路径使用 `kebab-case`。
- 布尔值以 `is`、`has`、`can`、`should` 开头。

### 19.3 Vue

- 使用 Composition API 和 `<script setup lang="ts">`。
- 组件保持单一职责，复杂业务提取为 composable 或 service。
- Props 和 Emits 必须有类型。
- 避免在模板中编写复杂表达式。
- 页面级异步状态必须覆盖 loading、empty、error 和 success。
- 不直接修改 Props。
- 简历编辑器中的高频状态避免无边界深层响应式监听。

### 19.4 NestJS

- Controller 不直接调用 ORM。
- 数据库事务由应用服务控制。
- 外部输入统一经过 Zod/Pipe 校验。
- Guard 负责认证授权，Interceptor 负责横切逻辑，Filter 负责错误映射。
- 队列 Processor 不复制 Controller 逻辑。
- 配置通过配置模块读取，业务代码禁止直接散落读取环境变量。

### 19.5 注释与文档

- 注释解释设计原因、边界和风险，不复述代码。
- 公共 Schema、复杂分页算法和 AI 规则需要说明。
- API 变更同步更新 OpenAPI。
- 架构级决策写入 `docs/adr`。
- README 保持本地启动步骤可复现。

## 20. 格式化、静态检查与提交前检查

统一配置：

- ESLint
- Prettier
- Stylelint
- TypeScript 类型检查
- lint-staged
- 可选 Husky Git Hooks

提交前至少通过：

```text
pnpm lint
pnpm typecheck
pnpm test
```

涉及数据库、模板或主流程时，还应执行相应集成测试、视觉回归或 E2E 测试。

## 21. 测试规范

### 21.1 测试层级

| 层级 | 重点 |
|---|---|
| 单元测试 | Schema、规则函数、权限判断、数字校验和模板工具 |
| 组件测试 | 表单、编辑器操作、AI 建议卡片和保存状态 |
| 集成测试 | 数据库事务、认证、队列投递、对象存储和 pgvector 过滤 |
| E2E | 注册、创建简历、编辑、AI 建议确认、导出 PDF |
| 视觉回归 | A4 模板、分页、字体、切换模板和 PDF 截图 |
| AI 评测 | 来源支持、捏造、结构化输出和提示注入 |

### 21.2 必测风险

- 不同用户之间的水平越权。
- 自动保存版本冲突。
- AI 建议未经确认直接写入。
- AI 引用其他用户材料。
- 数字和实体缺少依据。
- 模板切换后内容丢失。
- PDF 与预览结构不一致。
- 删除材料后向量仍可召回。
- 任务重试产生重复数据。

### 21.3 测试数据

- 使用虚构或脱敏用户数据。
- 不把真实简历、电话、邮箱和模型密钥提交仓库。
- 模板视觉测试使用固定的中英文样例数据。
- AI 评测样本记录期望来源和允许事实集合。

## 22. Git 与协作规范

### 22.1 分支

个人开发阶段采用简单分支策略：

- `main`：始终保持可运行。
- `feature/<name>`：新功能。
- `fix/<name>`：缺陷修复。
- `docs/<name>`：文档调整。
- `refactor/<name>`：不改变行为的重构。

不额外维护长期 `develop` 分支。

### 22.2 Commit

使用 Conventional Commits：

```text
feat(resume): add section reorder
fix(export): wait for fonts before pdf generation
docs(architecture): define ai workflow
test(ai): add unsupported-number cases
refactor(auth): extract token service
```

每个提交应保持单一主题。禁止把格式化全仓库、功能实现和无关重构混在同一个提交中。

### 22.3 禁止提交

- `.env` 和任何密钥。
- 数据库、Redis、MinIO 本地数据卷。
- 用户上传文件。
- 真实简历和个人信息。
- 构建输出、临时 PDF 和日志。
- 编辑器或操作系统生成的无关文件。

## 23. 环境变量规范

仓库提供 `.env.example`，实际 `.env` 不进入 Git。

建议变量分类：

```text
APP_*
WEB_*
API_*
DATABASE_*
REDIS_*
STORAGE_*
MAIL_*
AUTH_*
AI_*
QWEN_*
DEEPSEEK_*
PDF_*
```

要求：

- 应用启动时校验必需变量，缺失时立即失败并给出变量名。
- 不在代码中提供生产密钥默认值。
- 前端只允许暴露明确白名单中的公开变量。
- API Key、JWT 密钥和数据库密码只能在服务端读取。

## 24. 本地开发环境

### 24.1 Docker Compose 服务

```text
postgres    PostgreSQL + pgvector
redis       BullMQ 和缓存
minio       S3 兼容对象存储
mailpit     本地邮件查看
```

### 24.2 推荐启动顺序

1. 安装固定版本的 Node.js Active LTS 和 pnpm。
2. 复制 `.env.example` 为本地 `.env`。
3. 启动 Docker Compose 基础设施。
4. 执行数据库迁移。
5. 执行开发种子数据。
6. 启动 API。
7. 启动 Worker。
8. 启动 Web。

具体命令在工程初始化后写入根目录 README，并通过一次全新环境验证。

### 24.3 本地 AI

当前“本地演示”指应用和基础设施在本地运行，AI 仍调用国内模型云 API。若没有模型 Key：

- 提供 `MockModelProvider` 返回固定结构化结果。
- Mock 数据必须明确标记为开发模式。
- Mock 模式也要走完整 Schema、引用、确认和写入流程。
- 不在前端直接伪造最终 AI 建议。

## 25. 未来部署预留

当前不实施公网部署，但保留以下可替换边界：

| 本地 | 未来部署 |
|---|---|
| MinIO | 国内对象存储 |
| 本地 PostgreSQL | 托管或独立 PostgreSQL |
| 本地 Redis | 托管或独立 Redis |
| Mailpit | 邮件服务商 |
| HTTP localhost | HTTPS 域名 |
| 单机 Worker | 可独立扩容 Worker |
| `.env` | 密钥管理服务或部署平台 Secret |

部署前必须补充：

- 域名、HTTPS 和安全响应头。
- 数据备份与恢复。
- 对象存储生命周期和跨域配置。
- AI 调用额度、限流和成本告警。
- 用户协议、隐私说明和第三方模型数据说明。
- 错误监控、健康检查和运行告警。
- 数据库迁移发布流程。

## 26. 开发阶段建议

### 阶段一：工程骨架

- 初始化 pnpm Monorepo。
- 创建 Web、API、Worker。
- Docker Compose 启动 PostgreSQL、Redis、MinIO、Mailpit。
- 建立共享 TypeScript、ESLint、Prettier 和测试配置。
- 建立健康检查和最小 CI。

### 阶段二：用户与资料

- 认证、邮箱验证和会话。
- 个人资料 CRUD。
- 数据库迁移、权限测试和 OpenAPI。

### 阶段三：简历编辑核心

- Resume Schema。
- 模块化编辑器。
- 自动保存、IndexedDB 草稿和版本。
- 第一套单栏模板。

### 阶段四：预览与导出

- 共享模板引擎。
- A4 分页和溢出检测。
- Worker + Playwright PDF。
- 模板视觉回归。

### 阶段五：材料库

- MinIO 上传。
- DOCX、PDF、TXT、Markdown 解析。
- 旧简历结构化识别和用户确认。

### 阶段六：AI 与 RAG

- Qwen Provider 和 Mock Provider。
- 文档切片、Embedding 和 pgvector。
- 来源引用和受控生成工作流。
- 数字、实体、冲突和提示注入校验。
- AI 评测集。

### 阶段七：管理与完善

- 模板和模型配置后台。
- 审计日志、用量统计和限流。
- 备用 Provider。
- LangGraph.js 可行性评估。

## 27. 架构验收清单

进入功能开发前：

- [ ] Monorepo 依赖方向符合规范。
- [ ] Web、API、Worker 可独立启动。
- [ ] 本地基础设施可通过一条 Compose 命令启动。
- [ ] 配置缺失时应用能快速失败。
- [ ] OpenAPI 和共享 Schema 路径明确。

简历核心完成时：

- [ ] 内容、模板、主题完全分离。
- [ ] 预览和 PDF 共用模板引擎。
- [ ] 自动保存使用乐观锁。
- [ ] 模板切换不丢失数据。
- [ ] 富文本可安全渲染。

AI 核心完成时：

- [ ] 每条建议包含来源。
- [ ] 向量查询限制用户和文档。
- [ ] 无依据数字不能通过校验。
- [ ] AI 不能直接写入简历。
- [ ] 模型或 Prompt 变更可运行评测集。
- [ ] AI 服务不可用时不影响手动编辑和导出。

## 28. 官方参考资料

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [NestJS BullMQ 队列](https://docs.nestjs.com/techniques/queues)
- [Drizzle PostgreSQL 扩展与 pgvector](https://orm.drizzle.team/docs/extensions)
- [pgvector 官方仓库](https://github.com/pgvector/pgvector)
- [Tiptap Vue 3 集成](https://tiptap.dev/docs/editor/getting-started/install/vue3)
- [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf)
- [阿里云百炼文本向量](https://help.aliyun.com/zh/model-studio/embedding)
- [千问结构化输出](https://help.aliyun.com/en/model-studio/qwen-structured-output)
- [千问 Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling)
- [LangGraph.js 工作流与 Agent](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
- [LangGraph.js Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)

---

本项目当前以本地完整演示为目标。架构上的重点不是堆叠技术，而是证明以下能力：可靠的简历编辑与版本管理、统一的预览和 PDF 渲染、用户隔离的 RAG 检索、可追踪且不直接写入的 AI 建议，以及能够通过测试和评测持续验证的工程流程。
