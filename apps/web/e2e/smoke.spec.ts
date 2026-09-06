import { expect, test } from '@playwright/test';

test('shows the Stage 1 service status page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '基础服务状态' })).toBeVisible();
});
