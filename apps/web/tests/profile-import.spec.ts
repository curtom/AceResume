import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ProfileEntry } from '@aceresume/contracts';
import type { ResumeSection } from '@aceresume/resume-schema';
import { applyProfileImport } from '../src/modules/resume/profile-import';

describe('profile import', () => {
  it('fills every matching project field while preserving the target entry identity', () => {
    const entryId = randomUUID();
    const section: ResumeSection = {
      id: randomUUID(),
      type: 'project',
      title: '项目经历',
      sortOrder: 0,
      isVisible: true,
      schemaVersion: 1,
      content: {
        entries: [
          {
            id: entryId,
            sortOrder: 0,
            name: '',
            role: null,
            technologies: [],
            url: null,
            startDate: '2026-01',
            endDate: null,
            isCurrent: true,
            description: { type: 'doc', content: [] },
          },
        ],
      },
    };
    const source: ProfileEntry = {
      id: randomUUID(),
      type: 'project',
      sortOrder: 0,
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      content: {
        schemaVersion: 1,
        name: '校园活动管理平台',
        role: '前端负责人',
        startDate: '2025-09',
        endDate: '2026-03',
        isCurrent: false,
        background: '服务校内社团活动管理',
        responsibilities: ['完成报名流程'],
        technologies: ['Vue 3', 'TypeScript'],
        outcomes: ['报名耗时降低 30%'],
        url: 'https://example.test',
      },
    };

    const result = applyProfileImport(section, source, 0).section;
    expect(result.type).toBe('project');
    if (result.type !== 'project') return;
    expect(result.content.entries[0]).toMatchObject({
      id: entryId,
      name: '校园活动管理平台',
      role: '前端负责人',
      technologies: ['Vue 3', 'TypeScript'],
      url: 'https://example.test',
      startDate: '2025-09',
      endDate: '2026-03',
      isCurrent: false,
    });
    expect(JSON.stringify(result.content.entries[0]?.description)).toContain('报名耗时降低 30%');
  });
});
