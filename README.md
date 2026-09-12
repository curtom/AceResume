# AceResume

AceResume 是面向大学生与应届毕业生的 AI 辅助在线简历制作平台。本仓库当前完成阶段 2 的账户与个人资料库；多简历编辑、文件、AI 与正式 PDF 功能将在后续阶段实现。

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

当前 E2E 需在 API、Worker 与 Web 开发服务运行时执行，验证邮件可在 Mailpit 查看。真实模型密钥未在本阶段配置，阶段 6 前请仅在本机 `.env` 写入 `DASHSCOPE_API_KEY`，不要提交或通过聊天发送。

本地 `.env` 默认设置 `AUTH_REQUIRE_EMAIL_VERIFICATION=false`，注册后可直接登录；生产环境应删除该覆盖项或设为 `true`，恢复邮箱验证和 Mailpit/正式邮件 Provider 流程。

## 本地基础设施

`docker-compose.yml` 仅启动 PostgreSQL + pgvector、Redis、MinIO 与 Mailpit；应用仍在宿主机运行。停止基础设施使用 `pnpm dev:infra:down`。该命令不会删除 Docker 数据卷。

## 架构边界

- `apps/*` 可依赖 `packages/*`；`pnpm check:boundaries` 阻止共享包反向依赖应用。
- API 使用 `/api/v1`、统一响应包装、请求 ID、稳定错误码和 OpenAPI。
- Worker 注册基础 `system` 队列和阶段 2 的 `email.send` 队列；邮件正文不会写入日志。
- 账户、会话、验证/重置令牌、个人资料和资料条目只通过 Drizzle migration 建表。
- Access Token 仅保存在前端内存，Refresh Token 使用 HttpOnly Cookie 并在每次刷新时轮换。
- 阶段 2 继续只使用已需要的 `contracts` 与 `config` 包；简历 Schema、模板引擎和 AI 核心会在对应阶段随实际用例创建。
