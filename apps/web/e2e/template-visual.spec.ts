import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  BUILT_IN_TEMPLATES,
  SAMPLE_RESUME_DOCUMENT,
  renderResume,
} from '@aceresume/template-engine';

const fontPath = fileURLToPath(
  new URL('../../../packages/template-engine/assets/NotoSansSC-Variable.ttf', import.meta.url),
);

for (const template of BUILT_IN_TEMPLATES) {
  test(`${template.versionId} visual baseline`, async ({ page }) => {
    const font = await readFile(fontPath);
    const resume = {
      ...structuredClone(SAMPLE_RESUME_DOCUMENT),
      templateVersionId: template.versionId,
      theme: template.defaultTheme,
    };
    await page.setViewportSize({ width: 900, height: 1250 });
    await page.setContent(
      renderResume({
        resume,
        template,
        mode: 'screen',
        fontUrl: `data:font/ttf;base64,${font.toString('base64')}`,
      }),
    );
    await page.waitForFunction(() => document.documentElement.dataset.renderReady === 'true');
    const diagnostics = await page.evaluate(
      () => (window as unknown as { __ACE_RESUME_RENDER__: unknown }).__ACE_RESUME_RENDER__,
    );
    expect(diagnostics).toMatchObject({
      overflowCount: 0,
      blankPageCount: 0,
      invalidLinkCount: 0,
      fontReady: true,
    });
    await expect(page.locator('.page').first()).toHaveScreenshot(`${template.versionId}.png`, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
    await page.setContent(
      renderResume({
        resume,
        template,
        mode: 'print',
        fontUrl: `data:font/ttf;base64,${font.toString('base64')}`,
      }),
    );
    await page.waitForFunction(() => document.documentElement.dataset.renderReady === 'true');
    await expect(page.locator('.page').first()).toHaveScreenshot(
      `${template.versionId}-print.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  });
}

test('long content paginates without clipping and hidden modules stay absent', async ({ page }) => {
  const font = await readFile(fontPath);
  const resume = structuredClone(SAMPLE_RESUME_DOCUMENT);
  const project = resume.sections.find((section) => section.type === 'project');
  const skill = resume.sections.find((section) => section.type === 'skill');
  if (!project || project.type !== 'project' || !skill)
    throw new Error('Fixed sample is incomplete.');
  const original = project.content.entries[0]!;
  project.content.entries = Array.from({ length: 24 }, (_, index) => ({
    ...structuredClone(original),
    id: `00000000-0000-4000-8001-${String(index).padStart(12, '0')}`,
    sortOrder: index,
    name: `分页项目 ${String(index + 1).padStart(2, '0')}`,
  }));
  skill.isVisible = false;
  await page.setContent(
    renderResume({
      resume,
      template: BUILT_IN_TEMPLATES[0],
      mode: 'screen',
      fontUrl: `data:font/ttf;base64,${font.toString('base64')}`,
    }),
  );
  await page.waitForFunction(() => document.documentElement.dataset.renderReady === 'true');
  const diagnostics = await page.evaluate(
    () =>
      (window as unknown as { __ACE_RESUME_RENDER__: { pageCount: number; overflowCount: number } })
        .__ACE_RESUME_RENDER__,
  );
  expect(diagnostics.pageCount).toBeGreaterThan(1);
  expect(diagnostics.overflowCount).toBe(0);
  await expect(page.getByText('技能清单')).toHaveCount(0);
  expect(await page.locator('.page').count()).toBe(diagnostics.pageCount);
});
