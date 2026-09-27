import { expect, test } from '@playwright/test';

test('uploads, parses, previews and confirms an old resume', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${suffix.slice(-4)}::5` });
  await page.goto('/register');
  await page.getByLabel('邮箱').fill(`stage5-e2e-${suffix}@example.test`);
  await page.getByLabel('密码').fill('Stage5Secure123');
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByRole('link', { name: '返回登录' }).click();
  await page.getByLabel('邮箱').fill(`stage5-e2e-${suffix}@example.test`);
  await page.getByLabel('密码').fill('Stage5Secure123');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('link', { name: /材料库/ }).click();
  await expect(page.getByRole('heading', { name: '材料库' })).toBeVisible();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入旧简历' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: '虚构旧简历.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '张小满\n邮箱：student@example.test\n求职意向：前端开发实习\n技能：Vue 3、TypeScript',
    ),
  });
  await expect(page.getByText('解析完成')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('heading', { name: '虚构旧简历.md' }).click();
  await expect(page.getByText('逐项确认候选字段')).toBeVisible();
  await expect(page.getByText('解析原文')).toBeVisible();
  await page.getByRole('button', { name: '确认并写入' }).click();
  await expect(page).toHaveURL(/\/resumes\/.+\/edit/, { timeout: 15_000 });
  await expect(page.locator('.editor-title strong')).toHaveText('虚构旧简历');
});
