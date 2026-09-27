# AceResume

AceResume 是面向大学生与应届毕业生的 AI 辅助在线简历制作平台。本仓库当前完成阶段 6：除账户、个人资料库、多简历编辑、8 套模板、PDF 导出和材料库外，已提供用户隔离的 pgvector 检索、受控 AI 建议、来源引用、事实风险校验、人工确认写入与异步任务进度。

## 前置条件

- Node.js `22.19.0`（见 `.nvmrc`）
- pnpm `11.19.0`
- Docker Desktop（Linux Engine 已运行）

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env
pnpm build
```

分别在两个 PowerShell 窗口运行：

```powershell
pnpm start:backend   # Docker 基础服务 + API + Worker
pnpm start:frontend  # Vite Web
```

后端脚本会在首次运行时创建 `.env`，启动 Docker 基础设施并执行 Drizzle migration；API 端口被占用时会停止并提示处理方式。退出 API 后，它启动的 Worker 也会一并退出。

- Web：`http://localhost:5173`
- API health：`http://localhost:3000/api/v1/health`
- OpenAPI：`http://localhost:3000/api/docs`
- MinIO Console：`http://127.0.0.1:9001`
- Mailpit：`http://127.0.0.1:8025`

`apps/web`、`apps/api` 与 `apps/worker` 可分别用根目录的 `dev:web`、`dev:api`、`dev:worker` 启动。启动前 API/Worker 会校验其必需环境变量；缺失时会列出变量名并停止。

## 验证

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm e2e
```

配置 `AI_PROVIDER=qwen` 与本机 `DASHSCOPE_API_KEY` 后，可执行以下命令验证真实对话模型和 1024 维 Embedding；该命令会产生一次实际模型调用：

```powershell
pnpm --filter @aceresume/ai-core verify:qwen
```

当前 E2E 需在 API、Worker 与 Web 开发服务运行时执行。编辑简历时会在停止输入 2 秒后自动保存；每个用户最多保留 6 份简历，归档仍计入上限。PDF 导出需要 API、Worker、Redis、MinIO 和 Playwright Chromium 同时可用，生成结果通过受控接口下载，临时文件不进入 Git。

本地默认使用确定性的 `AI_PROVIDER=mock`，无需模型密钥即可演示完整 RAG、引用和审批流程。接入通义千问时，仅在本机 `.env` 设置 `AI_PROVIDER=qwen` 与 `DASHSCOPE_API_KEY`；模型、Embedding 维度、超时、Top K 和最终上下文数量均由 `AI_*` 环境变量配置。模型密钥不得提交或通过前端传递。

材料库支持 DOCX、文本型 PDF、UTF-8 TXT 和 Markdown。默认单文件上限 20 MB、每用户 50 个文件、总容量 200 MB；解析超时、PDF 页数、文本长度和 DOCX 解压大小均可在环境变量中调整。扫描 PDF 与 OCR 不在 MVP 范围内。

本地 `.env` 默认设置 `AUTH_REQUIRE_EMAIL_VERIFICATION=false`，注册后可直接登录；生产环境应删除该覆盖项或设为 `true`，恢复邮箱验证和 Mailpit/正式邮件 Provider 流程。

## 本地基础设施

`docker-compose.yml` 仅启动 PostgreSQL + pgvector、Redis、MinIO 与 Mailpit；应用仍在宿主机运行。停止基础设施使用 `pnpm dev:infra:down`。该命令不会删除 Docker 数据卷。

## 架构边界

- `apps/*` 可依赖 `packages/*`；`pnpm check:boundaries` 阻止共享包反向依赖应用。
- API 使用 `/api/v1`、统一响应包装、请求 ID、稳定错误码和 OpenAPI。
- Worker 注册基础 `system`、`email.send`、`pdf.export`、`document.parse`、`document.embed`、`ai.generate` 与 `storage.cleanup` 队列；邮件正文、完整简历、原始材料和模型上下文不会写入日志。
- 账户、会话、验证/重置令牌、个人资料和资料条目只通过 Drizzle migration 建表。
- Access Token 仅保存在前端内存，Refresh Token 使用 HttpOnly Cookie 并在每次刷新时轮换。
- `resume-schema` 统一校验结构化简历；浏览器预览与 Worker PDF 共用 `template-engine` 的确定性渲染和分页规则，不依赖 UI 组件库。
- 简历仅保留最新内容；IndexedDB 临时草稿、幂等键、乐观锁和冲突选择共同避免静默覆盖。
- 模板定义按版本保存，简历引用明确的模板版本；PDF 任务保存创建时的不可变简历快照，不引入简历历史版本功能。
- 原始文件只存入 MinIO；数据库保存材料元数据、可定位文本片段和导入确认记录。Embedding 固定维度入库，检索先在数据库按当前用户和本次所选材料过滤，再进行 pgvector 相似度检索、关键词重排与去重。
- AI 只能生成带引用、支持状态、缺失事实、风险标记和前后差异的候选 Patch；无依据数字、关键实体或来源冲突会阻止接受，只有用户逐条确认后才调用普通简历服务写入。
