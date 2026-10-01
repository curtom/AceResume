import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RESUME_THEME, type ResumeDocument } from '@aceresume/resume-schema';
import { BUILT_IN_TEMPLATES, SAMPLE_RESUME_DOCUMENT, renderResume } from '../src/index.js';

describe('classic single template', () => {
  it('renders deterministically and escapes text', () => {
    const resume: ResumeDocument = {
      schemaVersion: 1,
      resumeId: randomUUID(),
      templateVersionId: 'classic-single-v1',
      locale: 'zh-CN',
      theme: DEFAULT_RESUME_THEME,
      sections: [
        {
          id: randomUUID(),
          type: 'basic',
          title: '基本信息',
          sortOrder: 0,
          isVisible: true,
          schemaVersion: 1,
          content: {
            fullName: '<script>alert(1)</script>',
            email: null,
            phone: null,
            location: null,
            customFields: [
              { id: randomUUID(), label: '<b>作品集</b>', value: '<script>bad</script>' },
            ],
          },
        },
      ],
    };
    const first = renderResume({ resume, mode: 'screen' });
    expect(first).toBe(renderResume({ resume, mode: 'screen' }));
    expect(first).toContain('&lt;script&gt;');
    expect(first).not.toContain('<script>alert');
    expect(first).toContain('&lt;b&gt;作品集&lt;/b&gt;: &lt;script&gt;bad&lt;/script&gt;');
  });

  it('ships eight unique versioned templates that preserve the same content', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(8);
    expect(new Set(BUILT_IN_TEMPLATES.map((item) => item.versionId)).size).toBe(8);
    for (const template of BUILT_IN_TEMPLATES) {
      const resume = {
        ...structuredClone(SAMPLE_RESUME_DOCUMENT),
        templateVersionId: template.versionId,
        theme: template.defaultTheme,
      };
      const html = renderResume({ resume, template, mode: 'print' });
      expect(html).toContain('林知远');
      expect(html).toContain('校园活动管理平台');
      expect(html).toContain(`template-${template.visualStyle}`);
      expect(html).toContain('document.fonts.ready');
    }
  });

  it('merges target and avatar into basic information and keeps entry headings on one row', () => {
    const html = renderResume({
      resume: structuredClone(SAMPLE_RESUME_DOCUMENT),
      mode: 'screen',
      avatarUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(html).toContain('class="resume-avatar"');
    expect(html).toContain('求职意向 · 前端开发工程师');
    expect(html).toContain('<strong>远山大学</strong><span>计算机科学与技术 · 本科</span>');
    expect(html).toContain('<strong>校园活动管理平台</strong><span>前端负责人</span>');
    expect(html).not.toContain('Vue 3');
    expect(html).not.toContain('技能清单');
  });
});
