import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthDataSchema, createApiSuccessSchema } from '../src/index.js';

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
});
