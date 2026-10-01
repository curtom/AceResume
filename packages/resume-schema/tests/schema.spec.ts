import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RESUME_THEME,
  ResumeDocumentSchema,
  RichTextDocumentSchema,
} from '../src/index.js';

describe('resume schema', () => {
  it('rejects dangerous rich text links', () => {
    expect(
      RichTextDocumentSchema.safeParse({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'click',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('requires continuous section order', () => {
    const section = {
      id: randomUUID(),
      type: 'summary',
      title: '自我评价',
      sortOrder: 1,
      isVisible: true,
      schemaVersion: 1,
      content: { body: { type: 'doc', content: [{ type: 'paragraph' }] } },
    };
    expect(
      ResumeDocumentSchema.safeParse({
        schemaVersion: 1,
        resumeId: randomUUID(),
        templateVersionId: 'classic-single-v1',
        locale: 'zh-CN',
        sections: [section],
        theme: DEFAULT_RESUME_THEME,
      }).success,
    ).toBe(false);
  });

  it('strips retired education metrics from legacy resume documents', () => {
    const result = ResumeDocumentSchema.parse({
      schemaVersion: 1,
      resumeId: randomUUID(),
      templateVersionId: 'classic-single-v1',
      locale: 'zh-CN',
      sections: [
        {
          id: randomUUID(),
          type: 'education',
          title: '教育经历',
          sortOrder: 0,
          isVisible: true,
          schemaVersion: 1,
          content: {
            entries: [
              {
                id: randomUUID(),
                sortOrder: 0,
                school: '示例大学',
                major: '计算机科学',
                degree: '本科',
                startDate: '2022-09',
                endDate: '2026-06',
                isCurrent: false,
                grade: '3.8',
                ranking: '前 10%',
                description: { type: 'doc', content: [{ type: 'paragraph' }] },
              },
            ],
          },
        },
      ],
      theme: DEFAULT_RESUME_THEME,
    });
    const education = result.sections[0];
    expect(education?.type).toBe('education');
    if (education?.type === 'education') {
      expect(education.content.entries[0]).not.toHaveProperty('grade');
      expect(education.content.entries[0]).not.toHaveProperty('ranking');
    }
  });
});
