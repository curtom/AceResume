import { expect, test } from '@playwright/test';

test('generates a cited suggestion and writes it only after user approval', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `stage6-e2e-${suffix}@example.test`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${suffix.slice(-4)}::6` });
  await page.goto('/register');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('Stage6Secure123');
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByRole('link', { name: '返回登录' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('Stage6Secure123');
  await page.getByRole('button', { name: '登录' }).click();

  await page.getByRole('link', { name: /材料库/ }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /上传第一份材料|上传材料/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: '项目事实.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('基于 Vue 3 和 TypeScript 完成交易模块，拆分 8 个复用组件。'),
  });
  await expect(page.getByText('解析完成')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: /我的简历/ }).click();
  await page.getByRole('button', { name: '新建简历' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('简历名称').fill('AI 安全测试简历');
  await dialog.getByRole('button', { name: '创建并编辑' }).click();
  await page.getByRole('button', { name: /项目经历/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await page.getByLabel('项目名称').fill('校园交易平台');
  await page.getByLabel('技术栈（用逗号分隔）').fill('Vue 3, TypeScript');
  await page.locator('.tiptap').fill('负责交易页面开发。');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });

  await page.getByRole('button', { name: /AI 辅助/ }).click();
  await expect(page.getByText('Ace AI 写作助手')).toBeVisible();
  await page.locator('.source-option', { hasText: '项目事实.txt' }).click();
  await page.locator('.consent-row').click();
  await page.getByRole('button', { name: /生成优化建议/ }).click();
  await expect(page.getByText('03 · 建议已生成')).toBeVisible({ timeout: 60_000 });
  const firstSuggestion = page.locator('.suggestion-card').first();
  await expect(firstSuggestion.getByText('依据充分')).toBeVisible();
  await firstSuggestion.getByText(/查看 1 项事实来源/).click();
  await expect(firstSuggestion.getByText('项目事实.txt')).toBeVisible();
  await expect(firstSuggestion).toContainText('8 个复用组件');

  await firstSuggestion.getByRole('button', { name: '✓ 接受并写入' }).click();
  await expect(page.getByText('已接受并写入').first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /项目经历/ }).click();
  await expect(page.locator('.tiptap')).toContainText('8 个复用组件');
});
