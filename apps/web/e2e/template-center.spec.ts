import { expect, test } from '@playwright/test';

test('shows a readable near-full-width resume in the template preview dialog', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': '2001:db8:' + Date.now().toString(16).slice(-4) + '::7',
  });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(`template-e2e-${Date.now()}@example.test`);
  await page.getByLabel('密码').fill('AceResume2026');
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();
  await expect(page.getByRole('heading', { name: /下一份机会/ })).toBeVisible();
  await page.goto('/templates');
  await page.getByRole('button', { name: '完整预览' }).first().click();

  const dialog = page.getByRole('dialog');
  const preview = dialog.locator('.modal-preview');
  const resume = preview.locator('iframe');
  await expect(resume).toHaveCSS('width', '794px');
  await expect(resume).toHaveCSS('height', '1123px');
  await expect(resume).toHaveCSS('transform', 'none');
  await expect(resume).toHaveAttribute('scrolling', 'no');
  const frameSize = await dialog
    .frameLocator('iframe')
    .locator('html')
    .evaluate((element) => ({
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
    }));
  expect(frameSize.scrollHeight).toBeLessThanOrEqual(frameSize.clientHeight + 1);
  expect(frameSize.scrollWidth).toBeLessThanOrEqual(frameSize.clientWidth + 1);
  const previewBox = await preview.boundingBox();
  const resumeBox = await resume.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(resumeBox).not.toBeNull();
  if (!previewBox || !resumeBox) throw new Error('Template preview should be visible.');
  expect(previewBox.width - resumeBox.width).toBeLessThan(60);
  expect(resumeBox.width / resumeBox.height).toBeCloseTo(210 / 297, 2);
});
