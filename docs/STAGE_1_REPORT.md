# 阶段 1：工程骨架报告

> 状态：待项目负责人审阅；未自动进入阶段 2  
> 日期：2026-09-06

## 已交付

- pnpm workspace：`apps/web`、`apps/api`、`apps/worker`、`packages/contracts`、`packages/config`。
- Node `22.19.0` 与 pnpm `11.19.0` 固定；根命令经 Corepack 执行。
- 严格 TypeScript、ESLint、Prettier、Stylelint、Vitest、Playwright 与共享包依赖方向检查。
- `/api/v1/health`、统一成功/错误契约、请求 ID、结构化脱敏日志与 OpenAPI。
- PostgreSQL + pgvector、Redis、MinIO、Mailpit Compose 配置；BullMQ 的基础 `system` 队列与 Worker 框架。
- Vue Router、Pinia、统一 Axios、全局错误入口与基础服务状态页面。
- Drizzle 连接工厂、迁移/种子边界，以及对象存储、邮件、模型的最小适配器接口。

## 验证结果

| 项目 | 结果 |
|---|---|
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 4 个测试文件、6 项测试通过 |
| `pnpm build` | Web、API、Worker 与共享包均通过 |
| Playwright E2E | 1 项健康页冒烟测试通过 |
| API/OpenAPI/Web | `GET /api/v1/health`、`/api/docs-json`、`/` 均返回 200 |
| 本地基础设施 | PostgreSQL、Redis、MinIO、Mailpit 均已启动；数据库/Redis/MinIO/Mailpit 探测成功 |

## 有意未实现

- 不预建 `resume-schema`、`template-engine`、`ai-core` 空包；在对应阶段随实际用例创建。
- 不创建业务表、迁移或种子数据；阶段 2 明确用户与资料边界后再通过 Drizzle migration 新增。
- 未配置真实模型密钥；仍按 ADR 0001 约定，阶段 6 才执行真实 Provider 验证。
- 未实现账户、资料、简历、文件、AI 或管理后台业务功能。

## 本地状态

- 用于验证的 API、Worker、Web 进程已关闭。
- Docker 基础设施保留运行，可通过 `pnpm dev:infra:down` 停止（不会删除卷）。
- 本地 `.env`、日志、依赖、构建输出与测试产物均在 `.gitignore` 中。
