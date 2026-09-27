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
});
