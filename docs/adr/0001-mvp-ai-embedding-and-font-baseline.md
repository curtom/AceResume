# ADR 0001：MVP 的 AI、向量与字体基线

- 状态：已接受
- 日期：2026-09-06
- 决策人：项目负责人已授权按研发建议选型
- 适用范围：AceResume V1.0 MVP

## 背景

PRD 要求接入国内合规模型，AI 输出必须可被结构化 Schema 校验；RAG 在 MVP 中只能使用一个 Embedding 模型和固定向量维度。PDF 需要稳定的中英文渲染与可确认的字体授权，但需求文档未固定模型 ID、向量维度和字体。

## 决策

1. 文本生成主模型使用阿里云百炼 `qwen3.7-plus`，默认采用非思考模式和 JSON Schema 输出。
2. Embedding 使用阿里云百炼 `qwen3.7-text-embedding` 的稠密 1024 维输出；MVP 不引入稀疏向量、混合检索或第二个向量空间。
3. 首发 PDF 与预览字体统一使用 Noto Sans SC 可变字体，默认字重为 400 和 700；许可证随字体以 SIL Open Font License 1.1 保存。
4. 未配置真实模型密钥时，仅使用 `MockModelProvider`；Mock 必须经过与真实 Provider 相同的 Schema、引用、支持状态、审批和写入边界，不得由前端伪造最终建议。
5. Playwright Chromium 仅作为渲染运行时；正式依赖版本在阶段 1 的 pnpm workspace 中锁定，阶段 0 下载的浏览器仅用于技术验证。

## 理由

- `qwen3.7-plus` 是百炼当前的明确模型 ID，支持长上下文和结构化 JSON Schema，适合简历条目、导入候选和事实约束输出。
- 官方向量文档将 1024 维列为通用语义检索的性能与成本平衡点；该维度也能直接映射至 PostgreSQL + pgvector 的单一 `vector(1024)` 列。
- `qwen3.7-text-embedding` 对检索指令与跨语言能力有额外支持，符合简历中中英文材料与岗位描述并存的场景。
- Noto Sans SC 覆盖简体中文和常用拉丁字符，可本地随 Worker/浏览器渲染链路分发；OFL 允许嵌入、再分发和随软件销售，避免把 Windows 系统字体的授权状态带入 PDF。
- 仅保留一种无衬线字体和一个向量空间，能先验证内容、布局和事实约束，不提前为模板风格或检索优化引入额外复杂度。

## 后果与约束

- `AI_CHAT_MODEL=qwen3.7-plus`、`AI_EMBEDDING_MODEL=qwen3.7-text-embedding`、`AI_EMBEDDING_DIMENSION=1024` 在阶段 1 写入 `.env.example`，真实 `DASHSCOPE_API_KEY` 只写入本地 `.env`。
- 所有 `document_chunks.embedding` 必须记录模型 ID 和维度；模型或维度变更时建立新的重新向量化任务，禁止混用向量空间。
- Provider 必须配置为北京或用户明确选择的百炼地域；地域、工作区 ID 和密钥不是前端配置，不能硬编码。
- 首发模板不得依赖 Arial、微软雅黑或其他未随项目提供授权依据的系统字体。后续增加 Noto Serif SC 或其他字体时，需新增 ADR 并补充 PDF 视觉基准。
- `qwen3.7-plus` 不替代确定性数字、实体、权限和冲突校验；模型只参与结构化候选与语义支持判断。

## 未决事项

- 阶段 0 未持有 API Key，因此尚未执行真实百炼调用；阶段 6 前必须由项目负责人将密钥写入本地 `.env`，并用脱敏评测集验证超时、限流和结构化失败映射。
- Docker Desktop 引擎当前未就绪，MinIO/pgvector/Redis 的真实集成验证留待引擎可用后完成。
- 8～12 套正式模板的字体样式暂统一收敛为 Noto Sans SC；如产品评审要求衬线学术模板，需先补充授权和视觉验证。

## 参考

- [百炼结构化输出](https://help.aliyun.com/zh/model-studio/qwen-structured-output)：Qwen3.7-Plus 系列支持 JSON Schema。
- [Qwen3.7-Plus 模型信息](https://help.aliyun.com/zh/model-studio/qwen3-7-plus)：模型 ID、上下文与计费信息。
- [百炼向量化](https://help.aliyun.com/zh/model-studio/embedding)：`qwen3.7-text-embedding`、可选维度以及 1024 维通用建议。
- [Noto Sans CJK 许可证](https://github.com/googlefonts/noto-cjk/blob/main/Sans/LICENSE)：SIL Open Font License 1.1。
