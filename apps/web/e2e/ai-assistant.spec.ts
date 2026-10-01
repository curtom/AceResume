import { expect, test } from '@playwright/test';

test('generates a cited suggestion and writes it only after user approval', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `stage6-e2e-${suffix}@example.test`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${suffix.slice(-4)}::6` });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('Stage6Secure123');
  await page.getByRole('button', { name: '登录 / 创建账号' }).click();

  await page.getByRole('link', { name: /材料库/ }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /上传第一份材料|上传材料/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: '项目事实.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('基于 Vue 3 和 TypeScript 完成交易模块，拆分 8 个复用组件。'),
  });
  await expect(page.getByText('解析完成')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: /我的简历/ }).click();
  await page.getByRole('button', { name: '新建简历' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('简历名称').fill('AI 安全测试简历');
  await dialog.getByRole('button', { name: '创建并编辑' }).click();
  await expect(page.getByRole('button', { name: /AI 辅助/ })).toHaveCount(0);
  await page.getByRole('button', { name: /项目经历/ }).click();
  await expect(page.getByRole('button', { name: /AI 辅助/ })).toBeVisible();
  await page.getByRole('button', { name: '＋ 添加条目' }).click();
  await page.getByLabel('项目名称').fill('校园交易平台');
  await page.getByLabel('担任角色').fill('前端负责人');
  await page.locator('.tiptap').fill('负责交易页面开发。');
  await expect(page.getByText('已自动保存')).toBeVisible({ timeout: 8_000 });

  await page.getByRole('button', { name: /AI 辅助/ }).click();
  await expect(page.getByText('Ace AI 写作助手')).toBeVisible();
  const drawer = page.locator('.ai-assistant-drawer .ant-drawer-content-wrapper');
  const defaultDrawerBox = await drawer.boundingBox();
  expect(defaultDrawerBox?.width).toBeCloseTo(430, 0);
  await page.getByRole('button', { name: '展开 AI 助手' }).click();
  await expect(page.getByRole('button', { name: '收回 AI 助手' })).toBeVisible();
  await expect
    .poll(async () => (await drawer.boundingBox())?.width)
    .toBeCloseTo((await page.viewportSize())!.width / 2, 0);
  await page.getByRole('button', { name: '收回 AI 助手' }).click();
  await expect(page.getByRole('radio', { name: '项目经历' })).toBeChecked();
  await page.locator('.source-option', { hasText: '项目事实.txt' }).click();
  await page.locator('.consent-row').click();
  await page.getByRole('button', { name: /生成目标经历/ }).click();
  await expect(page.getByText('04 · 项目经历生成结果')).toBeVisible({ timeout: 60_000 });
  const firstSuggestion = page.locator('.suggestion-card').first();
  await expect(firstSuggestion.getByText('依据充分')).toBeVisible();
  await expect(firstSuggestion.getByText('写作建议')).toBeVisible();
  await expect(firstSuggestion.getByText('修改前')).toHaveCount(0);
  await expect(firstSuggestion).not.toContainText('负责交易页面开发。');
  await expect(firstSuggestion.locator('textarea')).toHaveValue(/^• /);
  await firstSuggestion.getByText(/查看 1 项事实来源/).click();
  await expect(firstSuggestion.getByText('项目事实.txt')).toBeVisible();
  await expect(firstSuggestion).toContainText('8 个复用组件');

  await page.getByRole('button', { name: '关闭 AI 助手' }).click();
  await page.getByRole('button', { name: /AI 辅助/ }).click();
  await expect(page.getByText('04 · 项目经历生成结果')).toBeVisible();
  await expect(page.locator('.suggestion-card').first()).toContainText('8 个复用组件');

  await firstSuggestion.getByRole('button', { name: '✓ 接受并写入' }).click();
  await expect(page.getByText('已接受并写入').first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /项目经历/ }).click();
  await expect(page.locator('.tiptap')).toContainText('8 个复用组件');
});

test('names personal profile AI sources by their actual organization or project', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `ai-profile-sources-${suffix}@example.test`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${suffix.slice(-4)}::8` });
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('ProfileSources123');
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')),
    page.getByRole('button', { name: '登录 / 创建账号' }).click(),
  ]);
  const loginBody = (await loginResponse.json()) as { data: { accessToken: string } };
  const apiOrigin = new URL(loginResponse.url()).origin;
  const headers = { authorization: `Bearer ${loginBody.data.accessToken}` };
  const dates = { startDate: '2025-01', endDate: null, isCurrent: true };
  const createEntry = async (data: object): Promise<string> => {
    const response = await request.post(`${apiOrigin}/api/v1/profile/entries`, { headers, data });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { data: { id: string } }).data.id;
  };
  const projectId = await createEntry({
    type: 'project',
    content: {
      schemaVersion: 1,
      name: '校园交易平台资料',
      role: '前端负责人',
      ...dates,
      background: null,
      responsibilities: ['拆分可复用组件。'],
      technologies: ['Vue 3'],
      outcomes: [],
      url: null,
    },
  });
  const experienceId = await createEntry({
    type: 'experience',
    content: {
      schemaVersion: 1,
      organization: '星河科技',
      position: '前端实习生',
      ...dates,
      responsibilities: ['参与管理后台开发。'],
      outcomes: [],
      skills: ['TypeScript'],
    },
  });
  const campusId = await createEntry({
    type: 'campus',
    content: {
      schemaVersion: 1,
      organization: '校学生会',
      role: '宣传部负责人',
      ...dates,
      description: '组织校园招聘主题分享活动。',
    },
  });
  const resumeResponse = await request.post(`${apiOrigin}/api/v1/resumes`, {
    headers,
    data: {
      mode: 'profile',
      name: '个人资料来源命名测试',
      targetRole: '前端开发',
      locale: 'zh-CN',
      templateVersionId: 'classic-single-v1',
      profileEntryIds: [projectId, experienceId, campusId],
    },
  });
  expect(resumeResponse.ok()).toBe(true);
  const resume = (await resumeResponse.json()) as { data: { id: string } };
  await page.goto(`/resumes/${resume.data.id}/edit`);
  await page.getByRole('button', { name: '项目经历', exact: true }).click();
  await page.getByRole('button', { name: /AI 辅助/ }).click();
  const sourceDrawer = page.locator('.ai-assistant-drawer');
  await expect(page.locator('.source-option', { hasText: '校园交易平台资料' })).toBeVisible();
  await sourceDrawer.getByText('工作 / 实习', { exact: true }).click();
  await expect(page.locator('.source-option', { hasText: '星河科技' })).toBeVisible();
  await sourceDrawer.getByText('校园经历', { exact: true }).click();
  await expect(page.locator('.source-option', { hasText: '校学生会' })).toBeVisible();
});
