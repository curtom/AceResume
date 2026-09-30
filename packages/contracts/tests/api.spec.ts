import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  CreateAiTaskRequestSchema,
  EducationContentSchema,
  ExperienceContentSchema,
  HealthDataSchema,
  PasswordSchema,
  ProjectContentSchema,
  SkillContentSchema,
  UpdateProfileRequestSchema,
  createApiSuccessSchema,
} from '../src/index.js';

describe('API contracts', () => {
  it('accepts the shared health success response', () => {
    const schema = createApiSuccessSchema(HealthDataSchema);
    expect(
      schema.parse({
        data: { application: 'ok', database: 'ok', redis: 'ok', storage: 'ok' },
        requestId: '9e88bd93-3da9-48fd-8553-8ce442b1a98c',
      }),
    ).toBeDefined();
  });

  it('rejects an unstable error code', () => {
    expect(() =>
      ApiErrorSchema.parse({
        code: 'POSTGRES_ERROR',
        message: 'raw infrastructure message',
        requestId: '9e88bd93-3da9-48fd-8553-8ce442b1a98c',
      }),
    ).toThrow();
  });

  it('enforces the confirmed password policy', () => {
    expect(PasswordSchema.safeParse('onlyletters').success).toBe(false);
    expect(PasswordSchema.safeParse('1234567890').success).toBe(false);
    expect(PasswordSchema.safeParse('AceResume2026').success).toBe(true);
  });

  it('normalizes optional profile text to null', () => {
    const result = UpdateProfileRequestSchema.parse({
      baseVersion: 1,
      fullName: '   ',
      targetRole: '',
      email: '',
      phone: null,
      location: '',
      website: '',
      summary: '',
    });
    expect(result).toMatchObject({
      fullName: null,
      targetRole: null,
      email: null,
      location: null,
      website: null,
      summary: null,
    });
  });

  it('rejects unknown or malformed education fields', () => {
    expect(
      EducationContentSchema.safeParse({
        schemaVersion: 1,
        school: '示例大学',
        major: '计算机科学',
        degree: '本科',
        startDate: 'September 2022',
        endDate: null,
        isCurrent: true,
        grade: null,
        ranking: null,
        description: null,
        privateNote: 'not allowed',
      }).success,
    ).toBe(false);
  });

  it('limits profile descriptions to 1000 characters', () => {
    const description = '项'.repeat(1_000);
    const dates = { startDate: '2025-01', endDate: null, isCurrent: true };
    expect(
      ProjectContentSchema.safeParse({
        schemaVersion: 1,
        name: '项目',
        role: null,
        ...dates,
        background: null,
        responsibilities: [description],
        technologies: [],
        outcomes: [],
        url: null,
      }).success,
    ).toBe(true);
    expect(
      ExperienceContentSchema.safeParse({
        schemaVersion: 1,
        organization: '公司',
        position: '职位',
        ...dates,
        responsibilities: [description],
        outcomes: [],
        skills: [],
      }).success,
    ).toBe(true);
    expect(
      SkillContentSchema.safeParse({
        schemaVersion: 1,
        category: '专业技能',
        name: '专业技能',
        proficiency: null,
        description,
      }).success,
    ).toBe(true);
    expect(
      SkillContentSchema.safeParse({
        schemaVersion: 1,
        category: '专业技能',
        name: '专业技能',
        proficiency: null,
        description: description + '超',
      }).success,
    ).toBe(false);
  });

  it('requires a supported AI output content type', () => {
    const request = {
      resumeId: '0ad7a3a3-cb36-4bb0-9f44-46dd677bc199',
      sectionId: '6fbb3d44-669c-4bb3-8a2c-358949c586af',
      contentType: 'project',
      baseVersion: 1,
      instruction: '突出具体行动与结果',
      jobDescription: null,
      sources: {
        documentIds: ['6e378084-7b7d-465f-a2f7-ac49d2d89602'],
        profileEntryIds: [],
      },
      consentToThirdParty: true,
    };
    expect(CreateAiTaskRequestSchema.safeParse(request).success).toBe(true);
    expect(
      CreateAiTaskRequestSchema.safeParse({ ...request, contentType: 'summary' }).success,
    ).toBe(false);
  });
});
