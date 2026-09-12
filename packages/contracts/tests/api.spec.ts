import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  EducationContentSchema,
  HealthDataSchema,
  PasswordSchema,
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
});
