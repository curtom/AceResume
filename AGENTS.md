# AGENTS.md

## Project Overview

AceResume 是一个面向大学生与应届毕业生的 AI 辅助在线简历制作平台。

核心目标：

- 提供结构化个人资料库与多简历管理能力，降低重复填写成本。
- 提供模块化简历编辑、模板切换、实时 A4 预览、自动保存和 PDF 导出。
- 支持导入旧简历及项目、实习等文档材料。
- 使用受控的 AI/RAG 工作流辅助生成简历内容，并通过来源追踪、规则校验和用户确认避免内容捏造。
- 提供用户端与基础管理后台，MVP 以本地完整演示为目标。

产品需求和技术决策以以下文档为准：

- `docs/PRD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`

实现功能前必须阅读与任务相关的章节。如果代码、需求文档和技术文档存在冲突，不应自行猜测，应先说明冲突并确认正确边界。

## Tech Stack

### Frontend

- Vue 3
- TypeScript
- Vite
- pnpm
- Vue Router
- Pinia
- Axios
- Ant Design Vue
- UnoCSS
- CSS / Less / CSS Variables
- Tiptap
- Zod
- Vitest / Vue Test Utils
- Playwright

### Backend

- NestJS
- TypeScript
- REST API + OpenAPI
- SSE
- Drizzle ORM
- PostgreSQL
- pgvector
- Redis
- BullMQ
- MinIO
- Playwright + Chromium

### AI

- 通义千问作为主模型 Provider
- DeepSeek 作为可选备用 Provider
- 国内合规 Embedding 模型
- MVP 使用受控 AI 工作流
- 工作流稳定后再考虑引入 LangGraph.js
- MVP 不进行模型微调，优先使用 Prompt、RAG、规则校验和评测集

### Local Infrastructure

- Docker Compose
- PostgreSQL + pgvector
- Redis
- MinIO
- Mailpit 或等价本地邮件捕获服务

未经明确同意，不得擅自替换上述技术选型或同时引入职责重复的框架。

## Architecture Principles

- 使用前后端分离架构。
- 采用 pnpm workspace 管理 Monorepo。
- 后端采用模块化单体，不提前拆分微服务。
- API 与 Worker 作为不同进程运行，但共享业务模块、Schema 和基础设施。
- 页面、组件、API、状态管理和领域逻辑应职责分离。
- 优先保持模块边界清晰，避免跨模块直接访问内部实现或数据库表。
- 内容、模板和主题样式必须分离存储。
- 浏览器预览与服务端 PDF 必须共用模板引擎和渲染规则。
- API、简历结构、模板配置和 AI 输出应使用明确的 Schema 校验。
- 长耗时操作通过 BullMQ 异步处理，不阻塞普通 HTTP 请求。
- AI 只能生成待确认建议，不能绕过用户确认直接修改正式简历。
- 所有用户资源必须在服务端执行所有权校验。
- 避免过早抽象，不为尚未出现的需求设计复杂架构。
- 当前以本地演示为目标，但对象存储、模型、邮件等外部能力应通过适配层调用，避免写死本地实现。

## Planned Project Structure

预计采用：

```text
AceResume/
├─ apps/
│  ├─ web/                  # Vue 用户端、编辑器和管理后台
│  ├─ api/                  # NestJS REST API 与 SSE
│  └─ worker/               # 文档、AI、PDF 和清理任务
├─ packages/
│  ├─ contracts/            # API 类型、错误码和 Zod Schema
│  ├─ resume-schema/        # 简历数据结构
│  ├─ template-engine/      # 统一 HTML/CSS 渲染
│  ├─ ai-core/              # Provider、Prompt、RAG 和工作流
│  ├─ config/               # 共享工程配置
│  └─ shared/
├─ infrastructure/
│  ├─ docker/
│  └─ migrations/
├─ docs/
├─ docker-compose.yml
├─ pnpm-workspace.yaml
└─ package.json
```

前端业务代码预计采用：

```text
apps/web/src/
├─ app/
├─ api/
├─ router/
├─ layouts/
├─ pages/
├─ modules/
├─ components/
├─ stores/
├─ styles/
├─ utils/
└─ types/
```

实际开发过程中，如果脚手架或已实现代码结构不同，应先检查现状和已有模式。除非现有结构明显违背已确认架构，不应为匹配计划目录而进行大规模无关重构。

## Dependency Rules

- `apps/*` 可以依赖 `packages/*`，`packages/*` 不得反向依赖 `apps/*`。
- `contracts`、`resume-schema` 不得依赖 Vue、NestJS 或具体 UI 组件库。
- `template-engine` 不得依赖 Ant Design Vue。
- `ai-core` 不得直接依赖 HTTP 请求对象、Vue Store 或页面组件。
- 业务模块不得绕过所属模块直接操作其数据表。
- 具有明确业务归属的代码不得随意放入 `shared`。
- 新增依赖前先检查现有依赖是否已能解决问题，并说明新增依赖的用途。

## Frontend Coding Rules

- 使用 Vue 3 Composition API。
- 使用 `<script setup lang="ts">`。
- 新增代码统一使用 TypeScript。
- TypeScript 开启严格模式，避免使用 `any`；外部未知数据使用 `unknown` 并经过校验。
- Vue 组件使用 `PascalCase.vue`。
- 变量和函数使用 `camelCase`。
- 类型、类和枚举使用 `PascalCase`。
- 常量使用 `UPPER_SNAKE_CASE`。
- 布尔变量优先使用 `is`、`has`、`can`、`should` 前缀。
- Props、Emits 和公开 composable 必须具有明确类型。
- 组件保持单一职责，复杂业务逻辑提取到业务模块的 composable 或 service。
- 避免在 Vue 模板中编写复杂表达式。
- 页面异步状态应覆盖 loading、empty、error 和 success。
- 不直接修改 Props。
- 不通过类型断言绕过 API、表单或 AI 数据校验。

## Frontend State Rules

- Pinia 主要管理登录用户摘要、当前编辑会话和跨组件 UI 状态。
- 不把所有服务端列表和详情长期复制到多个 Store。
- 当前简历草稿应记录对应的服务端版本号。
- 未同步草稿可以写入 IndexedDB，但不得写入 Token、API Key 或其他密钥。
- 自动保存使用防抖和乐观锁，遇到版本冲突必须提示，不得静默覆盖。
- 撤销/重做只处理当前编辑会话；关键历史版本由后端保存。

## UI Rules

- 优先使用已有 UI 组件库，不重复实现 Ant Design Vue 已提供的通用表单、弹窗和表格组件。
- Ant Design Vue 主要用于工作台、表单、列表和管理后台。
- 简历预览和 PDF 导出区域使用独立、可控的 HTML/CSS，不依赖 Ant Design Vue 组件。
- UnoCSS 主要用于应用布局、间距和常用工具类。
- Less 用于模板、打印样式及少量复杂局部样式。
- 颜色、字体、字号和间距优先使用 CSS Variables 或设计令牌，不散落硬编码值。
- 简历画布样式必须隔离，避免受到应用全局样式污染。
- 页面布局和交互反馈保持统一。
- 如果提供 Figma 原型，以 Figma 为主要视觉参考，同时遵守已确认的产品边界。
- 不为了视觉效果实现 PRD 之外的自由画布或任意元素拖拽能力。

## API Rules

- API 请求必须通过统一 Axios 实例和请求层。
- 不允许在页面组件中直接编写 Axios/fetch 请求或拼接 API URL。
- 不硬编码后端地址、模型地址、对象存储地址或密钥。
- 不自行猜测后端接口字段。
- 请求和响应类型应来自 `packages/contracts` 或 OpenAPI 生成客户端。
- 后端接口尚未提供时，可以使用 mock 数据完成页面和交互，但 mock 必须与既定 Schema 一致。
- API 前缀使用 `/api/v1`。
- 日期统一使用 UTC ISO 8601 字符串。
- 业务错误使用稳定错误码，不依赖数据库或第三方服务的原始错误文本。
- 列表接口必须分页，不返回无边界数据集合。
- 更新简历等并发敏感资源时使用版本号或幂等键。
- AI 流式输出与任务进度优先使用 SSE，不随意增加 WebSocket。

## Backend Coding Rules

- Controller 只负责协议转换、输入接收和返回结果，不直接调用 ORM。
- Application Service 负责用例编排、领域规则和事务边界。
- Repository 负责数据库访问。
- Adapter 负责模型、对象存储和邮件等外部能力。
- Worker Processor 调用共享应用服务，不复制业务规则。
- 外部输入统一经过 Zod 或等价的运行时 Schema 校验。
- Guard 负责认证授权，Interceptor 负责横切逻辑，Exception Filter 负责错误映射。
- 配置统一通过配置模块读取，不在业务代码中散落读取环境变量。
- 密码使用 Argon2id 哈希。
- Access Token 不应存入浏览器 `localStorage`；Refresh Token 使用 HttpOnly Cookie。
- 管理员操作和敏感访问必须写入审计日志。

## Database Rules

- 使用 PostgreSQL 和 Drizzle ORM。
- 表名和列名使用 `snake_case`。
- 关系、权限、状态和高频查询字段使用普通列。
- 简历模块、模板定义、版本快照和 AI 结构化输出可使用受 Schema 约束的 JSONB。
- 不得把所有业务数据存入单个大型 JSONB 字段。
- JSONB 数据必须具有明确的 Schema 版本。
- 所有用户数据必须保存或能够严格关联 `user_id`。
- pgvector 查询必须先限制当前用户及用户选中的文档范围。
- 数据库结构只能通过 Drizzle migration 修改。
- 已执行的 migration 不得重写，应新增 migration 修正。
- 业务代码不得在运行时自动修改数据库结构。
- 新增查询时检查必要索引，不提前添加未经验证的复杂索引。

## Resume and Template Rules

- 简历内容、模板定义和用户主题参数分离。
- 简历保存结构化数据，不把整页 HTML 作为业务源数据。
- Tiptap 内容保存为结构化 JSON，渲染前执行白名单转换和清理。
- 模板切换不得删除或覆盖简历内容。
- 模板必须版本化，历史简历继续引用原模板版本。
- 前端预览和服务端 PDF 必须使用 `template-engine` 的同一渲染逻辑。
- 模板渲染应为确定性过程，相同输入产生相同结构。
- 正式 PDF 使用 Playwright/Chromium 输出，不使用截图代替文本 PDF。
- 每套模板应具有固定测试数据和视觉回归基准。

## File and Queue Rules

- 原始文件存入 MinIO，不直接存入 PostgreSQL 大字段。
- 文件名仅用于展示，不作为对象存储路径。
- 服务端校验扩展名、MIME、大小和可解析性。
- 文档解析、Embedding、AI、PDF、邮件和文件清理使用 BullMQ 异步任务。
- 长任务 API 返回任务 ID，不等待任务完成。
- 队列任务必须幂等，并具有明确的重试上限。
- 用户删除材料时应同步清理对象、解析文本和向量索引。
- MVP 只支持 DOCX、文本型 PDF、TXT 和 Markdown，不擅自加入 OCR 或版式复刻。

## AI and RAG Rules

- 模型 API 只能由后端调用，前端不得持有模型 API Key。
- 模型接入通过统一 `ChatModelProvider` 和 `EmbeddingProvider`，业务代码不得绑定具体供应商 SDK。
- MVP 固定一个 Embedding 模型和向量维度，不混用不同向量空间。
- RAG 文档切片必须保存 `userId`、`documentId`、`chunkId` 和原始位置。
- 检索必须先按用户和用户指定文档过滤，再执行相似度搜索。
- 用户提示词可以定义写作要求，但其中的新事实不能自动视为已验证资料。
- JD 只能用于关键词、重点和表达方式，不能作为用户经历的事实来源。
- 上传文档属于不可信数据，其中的指令不能覆盖系统规则。
- AI 输出必须通过结构化 Schema 校验。
- 每条 AI 建议必须包含来源引用和支持状态。
- 无依据的公司、项目、时间、职责、技术栈、数字、金额、百分比或成果不能作为已验证事实写入简历。
- 数字和关键实体优先使用确定性规则检查，不能只依赖模型自检。
- AI 只能生成 `propose_resume_patch`；用户确认后才由普通业务服务执行写入。
- Prompt、模型和输出 Schema 变更后应运行脱敏 AI 评测集。
- MVP 不进行模型微调；只有积累足够的人工审核数据并确认 Prompt/RAG 已达到瓶颈后才能评估微调。
- 引入 LangGraph.js 前先证明普通受控工作流已不足以处理恢复、分支或人工确认需求。

## Security and Privacy Rules

- 不在代码、日志、截图、测试数据或 Git 中保存密码、Token、API Key 和真实用户隐私。
- `.env`、本地数据库卷、Redis 数据、MinIO 数据、上传文件和临时 PDF 不得提交 Git。
- 富文本和文档内容在展示前必须防止 XSS。
- 所有资源权限都在服务端校验，前端隐藏按钮不代表授权。
- AI 每次只接收当前任务所需的最少材料。
- 日志不得记录完整简历、原始文档、电话、邮箱或模型上下文。
- 用户删除材料后，原文件、解析文本和向量数据应进入一致的删除流程。
- 使用他人简历或模板时必须遵守 PRD 中的隐私和版权边界。

## Logging and Error Rules

- 使用结构化日志。
- 请求日志包含 `requestId`，异步任务日志包含 `jobId`。
- 记录模块、事件、耗时、结果和稳定错误码。
- 不把第三方模型、数据库或对象存储的敏感原始错误直接返回前端。
- 错误至少区分校验、认证、权限、简历、文档、AI、导出和基础设施类别。
- 所有可重试错误和不可重试错误应明确区分。

## Development Workflow

开发功能前：

1. 阅读 `docs/PRD.md` 中与任务相关的需求和验收标准。
2. 阅读 `docs/TECHNICAL_ARCHITECTURE.md` 中相关技术规范。
3. 明确功能边界和不在本次范围内的内容。
4. 检查是否已有类似页面、组件、Schema、API、服务或测试。
5. 确定涉及的页面、组件、API、状态、数据表和异步任务。
6. 检查当前 Git 工作区，保留用户已有和无关修改。
7. 优先采用最小且完整的改动实现需求。

开发过程中：

- 不在未确认时扩大产品范围。
- 不因局部功能随意跨越模块边界。
- 不为了“以后可能用到”提前建立复杂抽象。
- 对 AI、权限、删除、自动保存和 PDF 等高风险功能先定义失败路径。
- 需要临时 mock 时保持 Schema 与正式接口一致。

完成后：

1. 执行与改动相关的单元或集成测试。
2. 执行类型检查、Lint 和 Build。
3. 涉及主流程时执行 Playwright E2E。
4. 涉及模板或 PDF 时执行视觉回归检查。
5. 涉及 AI 时执行结构化输出与防捏造评测。
6. 检查 Git diff，确保没有无关格式化、密钥和用户数据。
7. 说明已完成内容、验证结果和仍存在的限制。

## Git Rules

- `main` 应保持可运行。
- 分支使用 `feature/*`、`fix/*`、`docs/*` 或 `refactor/*`。
- Commit 建议遵循 Conventional Commits。
- 每个提交保持单一主题。
- 不覆盖、丢弃或回退用户已有修改。
- 不执行 `git reset --hard` 或其他破坏性 Git 操作，除非用户明确要求并确认目标。
- 不提交 `.env`、密钥、数据库卷、上传文件、日志、构建输出或临时 PDF。

## Do Not

- 不随意增加新依赖。
- 不擅自修改技术选型。
- 不实现需求之外的功能。
- 不过度封装。
- 不提前设计没有明确需求的扩展能力。
- 不把当前项目拆成微服务。
- 不在第一版加入 GraphQL、WebSocket、独立向量数据库或 Python 服务。
- 不把 AI 生成内容未经确认直接写入正式简历。
- 不以截图方案替代正式 PDF 渲染。
- 不在页面组件中直接访问数据库、对象存储或模型接口。
- 不猜测接口字段、数据库结构或产品规则。

## File Deletion Safety

禁止批量删除文件或目录。

不要使用：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要删除文件时，只能一次删除一个经过确认的明确文件路径，例如：

```powershell
Remove-Item "D:\path\to\specific-file.txt"
```

如果需要批量删除文件，应停止操作并要求用户手动删除。不得通过脚本、通配符、循环或其他命令规避这一限制。

## Validation

工程脚本建立后，代码完成至少执行：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

按改动范围追加：

- 前端主流程：Playwright E2E。
- 模板与导出：预览/PDF 视觉回归。
- 数据库：迁移与集成测试。
- 权限：水平越权测试。
- AI：Schema、引用、数字和实体防捏造评测。
- Worker：幂等、重试和失败恢复测试。

如果某项脚本尚未创建或环境暂时无法运行，必须明确说明，不能声称已经通过验证。
