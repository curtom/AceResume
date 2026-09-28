import { expect, test } from '@playwright/test';

test('creates an account on first login and maintains profile data', async ({ page }) => {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': '2001:db8:' + Date.now().toString(16).slice(-4) + '::2',
  });
  const email = `stage2-e2e-${Date.now()}@example.test`;
  const password = 'AceResume2026';
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();
  await expect(page.getByRole('heading', { name: /下一份机会/ })).toBeVisible();
  await page
    .getByRole('complementary', { name: '主导航' })
    .getByRole('link', { name: /个人资料/ })
    .click();
  await expect(page.getByRole('heading', { name: '个人资料' })).toBeVisible();
  await page.getByLabel('姓名').fill('林知远');
  await page.getByLabel('求职意向').fill('前端开发工程师');
  await page.getByRole('button', { name: '保存基本信息' }).click();
  await expect(page.getByText('基本信息已保存。')).toBeVisible();
  await page.getByRole('button', { name: /教育经历/ }).click();
  await page.getByRole('button', { name: /添加教育经历/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('学校').fill('示例大学');
  await dialog.getByLabel('专业').fill('计算机科学');
  await dialog.getByLabel('学历').fill('本科');
  await dialog.getByLabel('开始时间').fill('2022-09');
  await dialog.getByLabel('结束时间').fill('2026-06');
  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByRole('heading', { name: '示例大学' })).toBeVisible();
});
