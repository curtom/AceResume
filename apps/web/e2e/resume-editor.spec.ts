import { expect, test } from '@playwright/test';

test('creates, edits and automatically saves the latest resume', async ({ page }) => {
  test.setTimeout(90_000);
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
  const drawerHandle = page.getByRole('button', { name: '收起编辑' });
  await expect(drawerHandle).toHaveCSS('position', 'static');
  await drawerHandle.click();
  await expect(page.getByRole('button', { name: '展开编辑' })).toBeVisible();
  await page.getByRole('button', { name: '展开编辑' }).click();
  await expect(page.getByRole('button', { name: /^求职意向/ })).toHaveCount(0);
  await expect(page.getByLabel('求职意向')).toHaveValue('前端开发工程师');
  await expect(page.getByLabel('个人网站')).toHaveCount(0);
  await page.getByLabel('姓名').fill('林知远');
  await page.getByRole('button', { name: '＋ 添加字段' }).click();
  await page.getByLabel('字段名').fill('作品集');
  await page.getByLabel('字段内容').fill('example.test');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });
  const preview = page.frameLocator('iframe[title="简历实时预览"]');
  await expect(preview.getByRole('heading', { name: '林知远' })).toBeVisible();
  await expect(preview.getByText('作品集: example.test')).toBeVisible();
  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByText('头像已更新。')).toBeVisible();
  await expect(preview.locator('.resume-avatar')).toHaveCount(1);
  await page.getByRole('button', { name: '移除头像' }).click();
  await expect(page.getByText('头像已移除。')).toBeVisible();
  await expect(preview.locator('.resume-avatar')).toHaveCount(0);

  const educationCard = page.locator('.module-card').filter({
    has: page.getByRole('button', { name: '教育经历', exact: true }),
  });
  await educationCard.hover();
  const educationVisibility = educationCard.getByRole('switch');
  await educationVisibility.click();
  await expect(educationVisibility).toHaveAttribute('aria-checked', 'false');
  await expect(preview.getByRole('heading', { name: '教育经历' })).toHaveCount(0);
  await educationVisibility.click();
  await expect(educationVisibility).toHaveAttribute('aria-checked', 'true');
  await educationCard.getByRole('button', { name: '后移模块' }).click();
  await expect(page.locator('.module-card .module-select').nth(2)).toHaveText('教育经历');
  await educationCard.getByRole('button', { name: '前移模块' }).click();

  await page.getByRole('button', { name: /教育经历/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  const startMonth = page.getByPlaceholder('选择开始月份');
  const endMonth = page.getByPlaceholder('选择结束月份');
  await expect(startMonth).toHaveAttribute('readonly', '');
  await expect(startMonth).toHaveValue('');
  await expect(endMonth).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: '至今' })).not.toBeChecked();
  await startMonth.click();
  await expect(page.locator('.ant-picker-month-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });

  await page.getByRole('button', { name: /实习 \/ 工作经历/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await expect(page.getByText('地点', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /项目经历/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await expect(page.getByText(/技术栈/)).toHaveCount(0);
  const projectStartPicker = page.locator('.start-date-field .month-picker');
  const projectEndPicker = page.locator('.end-date-control .month-picker');
  const currentCheckbox = page.locator('.end-date-control .ant-checkbox-wrapper');
  const [startBox, endBox, currentBox] = await Promise.all([
    projectStartPicker.boundingBox(),
    projectEndPicker.boundingBox(),
    currentCheckbox.boundingBox(),
  ]);
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();
  expect(currentBox).not.toBeNull();
  expect(Math.abs(startBox!.width - endBox!.width)).toBeLessThan(1);
  expect(startBox!.width).toBeLessThanOrEqual(320);
  expect(Math.abs(startBox!.y - endBox!.y)).toBeLessThan(1);
  await expect(currentCheckbox).toHaveCSS('display', 'inline-flex');
  expect(currentBox!.height).toBeLessThanOrEqual(endBox!.height);
  expect(
    Math.abs(endBox!.y + endBox!.height / 2 - (currentBox!.y + currentBox!.height / 2)),
  ).toBeLessThan(2);

  await page.getByRole('button', { name: /专业技能/ }).click();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await expect(page.getByText('内容描述', { exact: true })).toBeVisible();
  await expect(page.getByText('技能名称', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });

  await page.reload();
  await expect(page.getByLabel('姓名')).toHaveValue('林知远');
  await page.getByRole('button', { name: /自我评价/ }).click();
  const richText = page.locator('.tiptap');
  await richText.fill('注重可验证的成果与清晰表达。');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });
  await expect(preview.getByText('注重可验证的成果与清晰表达。')).toBeVisible();
  const summaryIndex = (
    await page.locator('.module-card .module-select').allTextContents()
  ).indexOf('自我评价');
  expect(summaryIndex).toBeGreaterThanOrEqual(0);
  const summaryCard = page.locator('.module-card').nth(summaryIndex);
  await summaryCard.hover();
  await summaryCard.getByRole('button', { name: '编辑模块名称' }).click();
  await summaryCard.getByLabel('模块名称').fill('个人总结');
  await summaryCard.getByLabel('模块名称').press('Enter');
  await expect(page.getByRole('button', { name: '个人总结', exact: true })).toBeVisible();
  await expect(preview.getByRole('heading', { name: '个人总结' })).toBeVisible();
});
