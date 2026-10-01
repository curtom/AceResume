import { expect, test } from '@playwright/test';

test('new timeline entries start with every editable field empty', async ({ page }) => {
  const suffix = Date.now();
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `2001:db8:${suffix.toString(16).slice(-4)}::5`,
  });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(`blank-entry-${suffix}@example.test`);
  await page.getByLabel('密码').fill('AceResume2026');
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();
  await page.getByRole('link', { name: /我的简历/ }).click();
  await page.getByRole('button', { name: '新建简历' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('简历名称').fill('空白条目测试');
  await dialog.getByRole('button', { name: '创建并编辑' }).click();

  const cases = [
    { module: /教育经历/, fields: ['学校', '专业', '学历'] },
    { module: /实习 \/ 工作经历/, fields: ['组织 / 公司', '职位'] },
    { module: /项目经历/, fields: ['项目名称', '担任角色'] },
    { module: /校园经历/, fields: ['组织', '角色'] },
  ];
  for (const item of cases) {
    await page.getByRole('button', { name: item.module }).click();
    await page.getByRole('button', { name: '＋ 添加条目' }).click();
    for (const field of item.fields) {
      await expect(page.getByLabel(field, { exact: true })).toHaveValue('');
    }
    await expect(page.getByPlaceholder('选择开始月份')).toHaveValue('');
    await expect(page.getByPlaceholder('选择结束月份')).toHaveValue('');
    await expect(page.getByPlaceholder('选择结束月份')).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: '至今' })).not.toBeChecked();
    await expect(page.locator('.tiptap')).toHaveText('');
  }
});
