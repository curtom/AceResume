import { expect, test } from '@playwright/test';

test('creates, edits and automatically saves the latest resume', async ({ page }) => {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': '2001:db8:' + Date.now().toString(16).slice(-4) + '::1',
  });
  const email = 'stage3-e2e-' + Date.now() + '@example.test';
  const password = 'AceResume2026';
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();
  await expect(page.getByRole('heading', { name: /下一份机会/ })).toBeVisible();
  await page.getByRole('link', { name: /我的简历/ }).click();

  await page.getByRole('button', { name: '新建简历' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('简历名称').fill('校招前端简历');
  await dialog.getByLabel('求职意向（可选）').fill('前端开发工程师');
  await dialog.getByRole('button', { name: '创建并编辑' }).click();

  await expect(page.getByRole('button', { name: /基本信息/ })).toBeVisible();
  await page.getByLabel('姓名').fill('林知远');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });
  const preview = page.frameLocator('iframe[title="简历实时预览"]');
  await expect(preview.getByRole('heading', { name: '林知远' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('姓名')).toHaveValue('林知远');
  await page.getByRole('button', { name: /自我评价/ }).click();
  const richText = page.locator('.tiptap');
  await richText.fill('注重可验证的成果与清晰表达。');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });
  await expect(preview.getByText('注重可验证的成果与清晰表达。')).toBeVisible();
});
