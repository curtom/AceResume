import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const RequestIdSchema = z.string().uuid();

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  requestId: RequestIdSchema,
});

export function createApiSuccessSchema<TData extends z.ZodTypeAny>(data: TData) {
  return z.object({ data, requestId: RequestIdSchema });
}

export const DependencyStatusSchema = z.enum(['ok', 'unavailable']);

export const HealthDataSchema = z.object({
  application: z.literal('ok'),
  database: DependencyStatusSchema,
  redis: DependencyStatusSchema,
  storage: DependencyStatusSchema,
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type HealthData = z.infer<typeof HealthDataSchema>;
