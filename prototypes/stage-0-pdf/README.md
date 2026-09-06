# 阶段 0：A4 / PDF 技术验证

此目录仅用于验证同一份 HTML/CSS 是否能被浏览器预览与 Playwright/Chromium 正确打印为 A4 PDF。

它不是正式模板引擎，不得复制到业务代码。正式实现必须在 `packages/template-engine` 中提供确定性渲染函数，并以相同输入供浏览器与 Worker 调用。

验证覆盖：A4 页面尺寸、两页分页、中文/英文混排、Noto Sans SC 字体加载、背景色、链接和文本型 PDF。

运行时需提供 `PLAYWRIGHT_NODE_MODULES`，指向包含 `playwright` 的 `node_modules` 目录：

```text
node render.cjs <absolute-output-pdf-path>
```
