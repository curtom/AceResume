import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const booleanEnvironmentSchema = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');
const aiEnvironment = {
  AI_PROVIDER: z.enum(['mock', 'qwen']).default('mock'),
  AI_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  AI_CHAT_MODEL: z.string().min(1).default('qwen3.7-plus'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('qwen3.7-text-embedding'),
  AI_EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(30_000),
  AI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(8),
  AI_CONTEXT_LIMIT: z.coerce.number().int().min(1).max(10).default(4),
  DASHSCOPE_API_KEY: z.string().min(1).optional(),
};

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
  ADMIN_CONFIG_ENCRYPTION_KEY: z.string().min(32).optional(),
  AUTH_REQUIRE_EMAIL_VERIFICATION: booleanEnvironmentSchema,
  DOCUMENT_MAX_FILE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),
  DOCUMENT_MAX_FILES: z.coerce.number().int().positive().default(50),
  DOCUMENT_MAX_TOTAL_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(200 * 1024 * 1024),
  ...aiEnvironment,
});

export const WorkerEnvironmentSchema = InfrastructureEnvironmentSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10),
  ADMIN_CONFIG_ENCRYPTION_KEY: z.string().min(32).optional(),
  DOCUMENT_MAX_PARSE_MS: z.coerce.number().int().min(1_000).default(30_000),
  DOCUMENT_MAX_PAGES: z.coerce.number().int().min(1).default(100),
  DOCUMENT_MAX_TEXT_CHARS: z.coerce.number().int().min(1_000).default(1_000_000),
  DOCUMENT_MAX_DOCX_UNCOMPRESSED_BYTES: z.coerce
    .number()
    .int()
    .min(1_000_000)
    .default(50 * 1024 * 1024),
  ...aiEnvironment,
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
