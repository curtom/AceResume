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
  await expect(page.getByLabel('个人网站')).toHaveCount(0);
  await page.getByRole('button', { name: '＋ 添加字段' }).click();
  await page.getByLabel('字段名').fill('作品集');
  await page.getByLabel('字段内容').fill('https://example.test');
  await page.getByLabel('自我评价').fill('关注用户体验与工程质量。');
  await page.getByRole('button', { name: '保存基本信息' }).click();
  await expect(page.getByText('基本信息已保存。')).toBeVisible();
  await page.getByRole('button', { name: /教育经历/ }).click();
  await page.getByRole('button', { name: /添加教育经历/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('学校').fill('示例大学');
  await dialog.getByLabel('专业').fill('计算机科学');
  await dialog.getByLabel('学历').fill('本科');
  await expect(dialog.getByLabel('绩点')).toHaveCount(0);
  await expect(dialog.getByLabel('排名')).toHaveCount(0);
  const educationStart = dialog.getByPlaceholder('选择开始月份');
  await expect(educationStart).toHaveAttribute('readonly', '');
  await educationStart.click();
  await expect(page.locator('.ant-picker-header-view')).toContainText(/\d{4}年/);
  const january = page.locator('.ant-picker-month-panel .ant-picker-cell-inner').first();
  await expect(january).toHaveText('1月');
  await january.click();
  await expect(educationStart).toHaveValue(/\d{4}年01月/);
  await dialog.getByRole('button', { name: /取\s*消/ }).click();

  await page.getByRole('button', { name: '项目经历', exact: true }).click();
  await page.getByRole('button', { name: /添加项目经历/ }).click();
  await expect(dialog.getByLabel('项目名称')).toBeVisible();
  await expect(dialog.getByLabel('担任角色')).toBeVisible();
  await expect(dialog.getByPlaceholder('选择开始月份')).toBeVisible();
  await expect(dialog.getByPlaceholder('选择结束月份')).toBeDisabled();
  await expect(dialog.getByText('至今', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /内容描述 0 \/ 1000/ })).toBeVisible();
  await expect(dialog.getByText(/项目背景|职责|技术栈|成果|项目链接/)).toHaveCount(0);
  await dialog.getByRole('button', { name: /取\s*消/ }).click();

  await page.getByRole('button', { name: '实习 / 工作经历', exact: true }).click();
  await page.getByRole('button', { name: /添加实习或工作/ }).click();
  await expect(dialog.getByLabel('组织 / 公司')).toBeVisible();
  await expect(dialog.getByLabel('职位')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /内容描述 0 \/ 1000/ })).toBeVisible();
  await expect(dialog.getByText(/职责|成果|相关技能/)).toHaveCount(0);
  await dialog.getByRole('button', { name: /取\s*消/ }).click();

  await page.getByRole('button', { name: '校园经历', exact: true }).click();
  await page.getByRole('button', { name: /添加校园经历/ }).click();
  await expect(dialog.getByLabel('组织', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('角色', { exact: true })).toBeVisible();
  await expect(dialog.getByPlaceholder('选择开始月份')).toBeVisible();
  await expect(dialog.getByPlaceholder('选择结束月份')).toBeDisabled();
  await expect(dialog.getByText('至今', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /内容描述 0 \/ 1000/ })).toBeVisible();
  await dialog.getByRole('button', { name: /取\s*消/ }).click();

  await page.getByRole('button', { name: '专业技能', exact: true }).click();
  await page.getByRole('button', { name: /添加专业技能/ }).click();
  await expect(dialog.getByRole('textbox', { name: /内容描述 0 \/ 1000/ })).toBeVisible();
  await expect(dialog.getByText(/技能名称|分类|熟练度/)).toHaveCount(0);
  await dialog.getByLabel('内容描述').fill('Vue 3 与 TypeScript 工程化实践');
  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('Vue 3 与 TypeScript 工程化实践')).toBeVisible();
});
