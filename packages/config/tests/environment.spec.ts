import { describe, expect, it } from 'vitest';
import { ApiEnvironmentSchema, loadEnvironment } from '../src/index.js';

const validEnvironment = {
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  WEB_ORIGIN: 'http://localhost:5173',
  AUTH_JWT_SECRET: 'local-development-only-secret-must-have-32',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/aceresume',
  REDIS_URL: 'redis://localhost:6379',
  STORAGE_ENDPOINT: 'localhost',
  STORAGE_PORT: '9000',
  STORAGE_ACCESS_KEY: 'access',
  STORAGE_SECRET_KEY: 'local-secret',
  STORAGE_BUCKET: 'aceresume',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '1025',
  MAIL_FROM: 'noreply@aceresume.test',
};

describe('loadEnvironment', () => {
  it('coerces valid values', () => {
    const environment = loadEnvironment(ApiEnvironmentSchema, {
      ...validEnvironment,
      AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
    });
    expect(environment.API_PORT).toBe(3000);
    expect(environment.AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(false);
  });

  it('requires email verification by default', () => {
    expect(
      loadEnvironment(ApiEnvironmentSchema, validEnvironment).AUTH_REQUIRE_EMAIL_VERIFICATION,
    ).toBe(true);
  });

  it('names a missing required variable', () => {
    const incompleteEnvironment = { ...validEnvironment, DATABASE_URL: undefined };
    expect(() => loadEnvironment(ApiEnvironmentSchema, incompleteEnvironment)).toThrow(
      'DATABASE_URL',
    );
  });
});
