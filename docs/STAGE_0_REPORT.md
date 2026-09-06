# 阶段 0：需求冻结、原型确认与技术验证报告

> 状态：待项目负责人审阅；未自动进入阶段 1  
> 日期：2026-09-06  
> 范围：仅执行 `docs/DEVELOPMENT_PLAN.md` 的阶段 0  
> 本报告中的“已验证”仅表示当前环境已有可重复证据；不表示后续应用功能已实现。

## 1. 阶段结论

阶段 0 的产品边界、核心对象、状态机、资源清单、模型/字体基线和 PDF 验证样本已形成。正式 Monorepo、数据库迁移、应用依赖和业务功能尚未开始。

当前有三项不能由文档或本机状态替代的开放验证：

1. Docker Desktop 的 Linux Engine 未就绪，无法实际启动 PostgreSQL、Redis、MinIO 与 Mailpit。
2. 项目尚未提供 `DASHSCOPE_API_KEY`，无法对真实 Qwen 调用执行结构化输出和错误映射验证。
3. PDF 已完成自动结构检查；由于本机 Windows 沙箱的图像查看/Node 内核异常，最终肉眼版式确认需由项目负责人查看产物，或在该运行环境恢复后复验。

除以上三项外，没有发现 PRD 的 P0 范围与计划中的 V1.0 非目标冲突。

## 2. 环境与技术验证状态

| 验证项 | 结论 | 证据或限制 |
|---|---|---|
| Node / pnpm | 已验证 | Node 22.19.0、pnpm 11.19.0 可用。 |
| Docker CLI | 已验证 | Docker CLI 28.0.1 可用。 |
| Docker Engine | 待验证 | Docker Desktop 已启动，但 `docker version` 尚无法连接 `dockerDesktopLinuxEngine`。 |
| Playwright Chromium | 已验证 | Chromium 已下载安装，用于本阶段隔离 PDF 样本。 |
| Noto Sans SC | 已验证 | 已下载可变字体和 OFL 许可证；详见 ADR 0001。 |
| A4 PDF 生成 | 已验证 | 同一 HTML/CSS 经 Playwright/Chromium 生成两页 A4 PDF。 |
| PDF 页面结构 | 已验证 | `pypdf` 检查结果：2 页；`pdfinfo` 报告为 A4（594.96 × 841.92 pt）。 |
| 中文可选择文本 | 已验证 | `pypdf` 可提取 427 个 CJK 码位；字体映射通过可提取文本验证。 |
| 外部链接 | 已验证 | PDF 含 `https://example.test/` URI 注解。 |
| PDF 视觉复核 | 待人工确认 | Poppler 已产生页面渲染图；本机图像查看沙箱初始化失败，无法由当前代理肉眼读取。 |
| DOCX / PDF / TXT / MD 解析 | 待阶段 1 后验证 | 解析框架未安装，且仓库无可用于评测的脱敏样本；不在阶段 0 臆造解析成功率。 |
| 真实 Qwen 结构化输出 | 待阶段 6 前验证 | 模型与 Schema 模式已选定，但缺少 API Key；本阶段不发送真实材料。 |
| MinIO 删除与队列重试 | 待 Docker Engine 就绪 | 已确定幂等清理状态机，尚未做基础设施集成测试。 |

### 2.1 PDF 验证样本

- 源码：`prototypes/stage-0-pdf/`。
- 输出：`C:\Users\谨言\.codex\visualizations\2026\09\04\01a06cfb-c2ba-7a43-bf5f-07f7c9e31b4c\aceresume-stage-0-pdf-spike.pdf`。
- 渲染图：同目录下 `aceresume-stage-0-pdf-spike-render-1.png` 与 `aceresume-stage-0-pdf-spike-render-2.png`。
- 范围：验证固定 A4 尺寸、两页分页、中文/英文、局部字体加载、背景色、链接与可选择文本。
- 非结论：此样本不实现正式模板引擎、自动分页、孤行控制、模板版本或视觉回归，不得直接迁入业务代码。

## 3. 已冻结的产品边界

### 3.1 V1.0 正式导航

工作台、我的简历、个人资料、材料库、模板中心、账号设置、简历编辑器、AI 抽屉与 `/admin` 管理后台。

### 3.2 从静态原型保留的方向

- 温和的纸张感、深蓝/灰绿对比和简历优先的编辑氛围。
- 工作台的“继续编辑”和最近简历入口。
- 编辑器顶部保存状态、历史版本、模板、预览与导出动作。
- 模块导航、结构化表单、隔离 A4 预览和不遮挡主流程的 AI 抽屉。
- “空白创建 / 从资料创建 / 导入旧简历”三种创建入口。

### 3.3 必须重做或补齐的原型行为

| 原型行为 | 正式实现要求 |
|---|---|
| 直接操作 DOM 和本地假数据 | 改为 Vue 状态、模块服务、共享契约和服务端校验。 |
| 定时器模拟保存、解析、AI 与导出 | 改为版本号/幂等键、任务 ID、BullMQ 和 SSE/查询恢复。 |
| `window.print()` 导出 | 改为 Worker 中 Playwright/Chromium 的共享模板引擎渲染。 |
| 静态 AI 引用和直接写入建议 | 改为来源校验、支持状态、差异展示和用户批准记录。 |
| 占位的列表/设置/材料/模板页面 | 补齐分页、加载、空、错误、权限和成功状态。 |
| 图标式排序控件 | 提供可访问名称与键盘/按钮替代操作。 |

### 3.4 明确排除

静态原型中的“投递市场”不进入 V1.0 导航。PRD 已将自动投递、招聘网站账号连接和职位爬取定义为非目标；外链招聘信息也不在本次 MVP 开发范围内。

## 4. 主流程与页面状态

### 4.1 首次制作简历

```text
注册 → 邮箱验证 → 登录 → 工作台 → 创建简历
  → 空白 / 从资料创建 → 选择模板 → 填写名称与目标岗位
  → 编辑器 → 自动保存 → A4 预览 → PDF 导出任务 → 受控下载
```

### 4.2 旧简历导入

```text
创建简历 → 选择导入 → 上传文件 → 文件校验
  → 排队 / 解析中 → 原文与候选字段审核 → 逐项保留、修改或忽略
  → 写入资料库、当前简历或两者 → 创建关键版本
```

### 4.3 基于材料的 AI 建议

```text
编辑器模块 → AI 抽屉 → 首次 AI 同意说明 → 选择资料与材料
  → 展示最小必要上下文摘要 → AI 任务 → 建议、引用、风险与差异
  → 接受 / 编辑 / 重新生成 / 拒绝 → 批准记录 → 应用 Patch → 新版本
```

### 4.4 岗位定向与历史恢复

```text
编辑器 → 粘贴 JD（仅写作目标）→ AI 建议 → 用户批准

编辑器 → 历史版本 → 预览历史快照 → 恢复 → 新版本（不覆盖旧版本）
```

### 4.5 通用页面状态

所有列表和详情页至少具有 loading、empty、error、success；所有异步任务还具有 queued、running、succeeded、failed、可重试和离页后可查询状态。破坏性操作、权限不足、网络断开和版本冲突必须给出可理解的下一步。

## 5. 核心 Schema 草案

### 5.1 简历、模块和主题

```ts
type ResumeDocument = {
  schemaVersion: number
  resumeId: string
  templateVersionId: string
  locale: 'zh-CN' | 'en-US'
  sections: ResumeSection[]
  theme: ResumeTheme
}

type ResumeSection = {
  id: string
  type: ResumeSectionType
  title: string
  sortOrder: number
  isVisible: boolean
  schemaVersion: number
  content: ResumeSectionContent
  styleOverride?: Record<string, string | number>
}

type ResumeSectionType =
  | 'basic'
  | 'target'
  | 'education'
  | 'experience'
  | 'project'
  | 'campus'
  | 'skill'
  | 'award'
  | 'summary'
  | 'custom'

type ResumeTheme = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  sectionGap: number
  paragraphGap: number
  pageMargin: { top: number; right: number; bottom: number; left: number }
  accentColor: string
}
```

- `basic` 保存姓名、联系方式、所在地、网站和个人简介；`target` 保存求职意向。
- `education`、`experience`、`project`、`campus`、`award` 使用有稳定 ID 和排序值的条目数组。
- 项目/经历的描述、`summary` 和 `custom` 内容使用受控 `RichTextDocument`，不是 HTML 字符串。
- `skill` 保存分类、名称、可选熟练度与说明；熟练度不能由 AI 无依据补造。
- `styleOverride` 只能由模板白名单字段组成；无效值在前后端 Schema 层拒绝。

### 5.2 富文本白名单

允许 Node：`doc`、`paragraph`、`text`、`bullet_list`、`ordered_list`、`list_item`、`hard_break`。允许 Mark：`bold`、`italic`、`underline`、`link`。链接仅允许 `https:`、`http:`、`mailto:`；禁止图片、表格、内联样式、脚本、原始 HTML、任意属性和危险协议。

### 5.3 模板定义

```ts
type TemplateDefinition = {
  id: string
  version: string
  schemaVersion: number
  supportedLocales: Array<'zh-CN' | 'en-US'>
  layout: 'single-column' | 'two-column'
  regions: TemplateRegion[]
  supportedSectionTypes: ResumeSectionType[]
  themeConstraints: TemplateThemeConstraints
  print: { pageMargin: ResumeTheme['pageMargin']; breakPolicy: BreakPolicy }
  fonts: TemplateFont[]
}
```

模板只声明布局、区域、支持模块、合法主题范围、分页策略和字体；不能存入用户内容。模板切换只更新 `templateVersionId` 与合法主题参数，永不删除不受支持的模块数据。

### 5.4 AI 建议与引用

```ts
type ResumeSuggestion = {
  id: string
  text: string
  citations: Citation[]
  supportStatus: 'supported' | 'conflict' | 'unsupported'
  missingFacts: string[]
  riskFlags: string[]
  diff: { before: RichTextDocument | null; after: RichTextDocument }
}

type Citation = {
  sourceType: 'profile' | 'document'
  sourceId: string
  chunkId?: string
  quoteRange?: { start: number; end: number }
}
```

只有 `supported` 建议可进入直接接受状态；`conflict` 与 `unsupported` 必须先转为澄清问题或用户确认。审批前 AI 只能产生 `propose_resume_patch`，不能写入正式简历。

## 6. 状态机与数据归属

### 6.1 状态机

```text
异步任务：pending → queued → running → succeeded
                               ├→ failed
                               └→ cancelled

文档：uploaded → queued → parsing → parsed → embedding → ready
                       └→ parse_failed

导入：pending_review → partially_confirmed → confirmed | discarded

AI 建议：draft → validating → supported | conflict | unsupported
                               → pending_approval → approved | rejected
                               → applied

材料删除：delete_requested → cleanup_queued → cleanup_running → deleted
                                                └→ cleanup_failed
```

`approved` 到 `applied` 只能由普通简历应用服务在验证批准记录、用户归属和当前版本后执行。材料删除不会删除已确认写入简历的文本，只更新来源状态。

### 6.2 关系数据与 JSONB 边界

| 存储类型 | 内容 |
|---|---|
| 普通列/外键 | 用户归属、资源 ID、状态、名称、模板版本、排序、版本号、时间、任务/审批关联。 |
| JSONB（有 Schema 版本） | 简历模块内容、完整历史快照、模板布局/主题、AI 原始结构化输出、任务的可变配置。 |
| 对象存储 | 原始上传文件和受控临时 PDF。 |
| pgvector | `document_chunks` 的单一 1024 维向量，且同表保存 `user_id`、`document_id`、位置和模型元数据。 |

所有用户资源须保存 `user_id`，或通过强外键链路严格推导；任何文档检索均先按 `user_id` 和本次选择的 `document_id` 过滤。

## 7. API 与前端边界

- 所有接口使用 `/api/v1`、共享 Zod Schema、UTC ISO 时间、字符串 ID、分页和稳定错误码。
- 明确资源组：认证、个人资料、简历/版本、模板/版本、文档/导入、AI 任务/建议/审批、导出任务、管理与审计。
- 长任务仅创建任务并返回 202/任务 ID；前端通过 SSE 和任务查询恢复状态。
- 页面 → composable/Pinia（仅编辑会话与跨组件状态）→ 模块服务 → Axios/OpenAPI Client；页面组件不直接调用 Axios。
- Controller → Application Service → Repository/Adapter；Worker Processor 调用 Application Service，不能复制 Controller 或领域规则。

## 8. P0 工作项拆分

| 工作流 | 主要 P0 编号 | 依赖 | 专项测试 |
|---|---|---|---|
| 账户与资料 | AUTH-01～04、PROFILE-01～05、07～08 | 阶段 1 | 认证、令牌、所有权、资料快照 |
| 简历编辑与保存 | RESUME-01～04、EDIT-01～10、SAVE-01～07 | 阶段 2 | 排序/显隐/富文本、冲突、草稿、版本恢复 |
| 模板与导出 | TEMPLATE-01～05、EXPORT-01～06 | 阶段 3 | 模板版本、视觉回归、PDF 一致性、任务重试 |
| 材料与导入 | DOC-01～08 | 阶段 4 | 四格式解析、确认导入、删除后不可召回 |
| AI 与 RAG | AI-01～11 | 阶段 5 | 引用权限、数字/实体、冲突、提示注入、审批 |
| 管理与保障 | ADMIN-01～06、09 | 阶段 6 | 角色、重验证、审计、限流、脱敏指标 |

阶段编号与整体计划保持一致；“依赖”表示进入对应实施阶段前必须完成前一阶段门禁，不表示当前功能已存在。

## 9. 推荐的后续技术验证方法

### 9.1 文档解析

- DOCX：阶段 4 采用 `mammoth` 提取受控 HTML/文本并保留段落顺序；不承诺复刻 Word 版式。
- 文本型 PDF：阶段 4 采用 `pdfjs-dist` 按页提取文本项，保留页码与项目序号；无文本、加密或损坏文件进入明确失败状态。
- TXT / Markdown：使用 Node 标准库读取 UTF-8 文本，按行、标题与段落保留位置。
- 在加入以上依赖前，使用虚构/脱敏样本分别覆盖成功、空文件、损坏、加密和无文本场景。

### 9.2 AI 与向量

- 阶段 5 先实现不含密钥的 `MockModelProvider`，但不得跳过 Schema、引用、支持状态、审批或 Patch 服务。
- 取得本地 `DASHSCOPE_API_KEY` 后，用脱敏评测集验证 Qwen JSON Schema、超时、限流和非法结构的错误映射。
- 固定 `qwen3.7-text-embedding`/1024 维，初始以精确 pgvector 查询验证召回和用户隔离；不提前创建 HNSW、稀疏向量或混合检索。

## 10. 阶段 0 退出门禁

- [x] P0 范围、V1.0 非目标和静态原型差异已明确。
- [x] 简历、模板、主题、富文本、AI 建议、引用与任务状态已有 Schema 归属。
- [x] 模型、Embedding、字体与渲染运行时已有 ADR。
- [x] 单一 HTML/CSS 的两页 A4 PDF、中文提取与链接注解已自动验证。
- [ ] 项目负责人已查看 PDF 的两页视觉结果并确认无明显裁切、重叠或字体缺失。
- [ ] Docker Engine 就绪后，验证可启动本地基础设施；若仍失败，先解决本机 Docker 环境再进入阶段 1。
- [ ] 在阶段 6 前提供本地 `DASHSCOPE_API_KEY` 并完成真实结构化输出验证；密钥不得通过聊天、文档或 Git 提交。
- [ ] 项目负责人确认阶段 0 的剩余限制可接受，并批准进入阶段 1。
