import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import postgres from '../../api/node_modules/postgres/src/index.js';

test('admin enters the independent control room and sees privacy-safe operations', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `stage7-e2e-${suffix}@example.test`;
  const password = 'Stage7Secure123';
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${suffix.slice(-4)}::7` });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();
  await expect(page.getByRole('heading', { name: /下一份机会/ })).toBeVisible();

  loadEnvFile(resolve(process.cwd(), '../../.env'));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for admin E2E setup.');
  const database = postgres(process.env.DATABASE_URL);
  try {
    const promoted = await database<Array<{ id: string }>>`
      update users set role = 'admin', updated_at = now() where email = ${email} returning id
    `;
    expect(promoted).toHaveLength(1);
  } finally {
    await database.end({ timeout: 3 });
  }

  await page.reload();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '运行总览' })).toBeVisible();
  await expect(page.getByText('所有敏感操作均审计')).toBeVisible();
  await page.getByRole('link', { name: /用户与权限/ }).click();
  await expect(page.getByRole('heading', { name: '用户账号' })).toBeVisible();
  await expect(page.getByText('不读取简历正文、原始材料或模型上下文')).toBeVisible();
  await page.getByRole('link', { name: /模型与提示词/ }).click();
  await expect(page.getByRole('heading', { name: '模型服务配置' })).toBeVisible();
  await expect(page.getByText(/密钥已配置|未配置密钥/)).toBeVisible();
  await page.getByRole('link', { name: /审计日志/ }).click();
  await expect(page.getByRole('heading', { name: '管理员操作审计' })).toBeVisible();
});
