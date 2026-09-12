import { expect, test } from '@playwright/test';

test('shows the service status page', async ({ page }) => {
  await page.goto('/health');
  await expect(page.getByRole('heading', { name: '基础服务状态' })).toBeVisible();
});
