import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const booleanEnvironmentSchema = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

export const InfrastructureEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_PORT: portSchema,
  STORAGE_ACCESS_KEY: z.string().min(3),
  STORAGE_SECRET_KEY: z.string().min(8),
  STORAGE_BUCKET: z.string().min(3),
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: portSchema,
  MAIL_FROM: z.string().email(),
});

export const ApiEnvironmentSchema = InfrastructureEnvironmentSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1),
  API_PORT: portSchema,
  WEB_ORIGIN: z.string().url(),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_REQUIRE_EMAIL_VERIFICATION: booleanEnvironmentSchema,
});

export const WorkerEnvironmentSchema = InfrastructureEnvironmentSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10),
});

export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof WorkerEnvironmentSchema>;

export function loadEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }

  const missingKeys = result.error.issues
    .filter((issue) => issue.code === 'invalid_type' && issue.received === 'undefined')
    .map((issue) => issue.path.join('.'));
  const detail = missingKeys.length > 0 ? ` Missing: ${missingKeys.join(', ')}.` : '';
  throw new Error(`Invalid environment configuration.${detail}`);
}
