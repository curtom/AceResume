import { expect, test } from '@playwright/test';

test('imports personal profile fields into the selected resume content', async ({ page }) => {
  const suffix = Date.now();
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `2001:db8:${suffix.toString(16).slice(-4)}::4`,
  });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(`profile-import-${suffix}@example.test`);
  await page.getByLabel('密码').fill('AceResume2026');
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();

  const navigation = page.getByRole('complementary', { name: '主导航' });
  await navigation.getByRole('link', { name: /个人资料/ }).click();
  await page.getByLabel('姓名').fill('周宁');
  await page.getByLabel('求职意向').fill('产品设计师');
  await page.getByLabel('电话').fill('138 0000 0000');
  await page.getByRole('button', { name: '保存基本信息' }).click();
  await expect(page.getByText('基本信息已保存。')).toBeVisible();

  await navigation.getByRole('link', { name: /我的简历/ }).click();
  await page.getByRole('button', { name: '新建简历' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('简历名称').fill('个人资料导入测试');
  await createDialog.getByRole('button', { name: '创建并编辑' }).click();

  await page.getByRole('button', { name: '从个人资料导入', exact: true }).click();
  const importDialog = page.getByRole('dialog', { name: /从个人资料导入基本信息/ });
  await expect(importDialog.getByText('周宁')).toBeVisible();
  await expect(importDialog.getByText('产品设计师')).toBeVisible();
  await importDialog.getByRole('button', { name: '选择此信息' }).click();
  await importDialog.getByRole('button', { name: '确认导入' }).click();

  await expect(page.getByLabel('姓名')).toHaveValue('周宁');
  await expect(page.getByLabel('求职意向')).toHaveValue('产品设计师');
  await expect(page.getByText('已从个人资料导入并更新当前内容。')).toBeVisible();

  await page.getByRole('button', { name: /教育经历/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await page.getByRole('button', { name: '从个人资料导入', exact: true }).click();
  const entryImportDialog = page.getByRole('dialog', { name: /从个人资料导入教育经历/ });
  await expect(entryImportDialog.getByText('个人资料中暂无可导入的内容')).toBeVisible();
  await entryImportDialog.getByRole('button', { name: /取\s*消/ }).click();
});
