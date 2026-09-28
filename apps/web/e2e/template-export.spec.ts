import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('selects a template, previews it and downloads an asynchronous PDF', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `2001:db8:${Date.now().toString(16).slice(-4)}::4`,
  });
  const email = `stage4-e2e-${Date.now()}@example.test`;
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('AceResume2026');
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();

  await page
    .getByRole('complementary', { name: '主导航' })
    .getByRole('link', { name: /模板中心/ })
    .click();
  await expect(page.getByRole('heading', { name: /选择表达方式/ })).toBeVisible();
  await expect(page.locator('.template-grid article')).toHaveCount(8);
  await page.getByRole('link', { name: '使用模板' }).nth(5).click();

  const createDialog = page.getByRole('dialog');
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel('简历名称').fill('阶段四前端简历');
  await createDialog.getByRole('button', { name: '创建并编辑' }).click();
  await expect(page.getByRole('button', { name: '深蓝双栏' })).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="简历实时预览"]').locator('body.template-slate'),
  ).toBeVisible();

  await page.getByRole('button', { name: '全屏预览' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(
    page.frameLocator('iframe[title="简历实时预览"]').getByRole('heading').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /返回编辑/ }).click();

  await page.getByRole('button', { name: '深蓝双栏' }).click();
  await page.getByRole('button', { name: /现代线条/ }).click();
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });
  await expect(
    page.frameLocator('iframe[title="简历实时预览"]').locator('body.template-modern'),
  ).toBeVisible();

  await page.getByRole('button', { name: '导出 PDF' }).click();
  await expect(page.getByText('授权字体：已加载')).toBeVisible();
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: '确认并导出 PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('阶段四前端简历.pdf');
  const path = await download.path();
  expect(path).not.toBeNull();
  const pdf = await readFile(path!);
  expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  expect(pdf.length).toBeGreaterThan(1_000);
});
