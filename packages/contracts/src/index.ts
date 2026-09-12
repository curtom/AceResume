import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'INVALID_OR_EXPIRED_TOKEN',
  'SESSION_EXPIRED',
  'PROFILE_VERSION_CONFLICT',
  'PROFILE_ENTRY_NOT_FOUND',
  'RATE_LIMITED',
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

export const PasswordSchema = z
  .string()
  .min(10, '密码至少需要 10 位')
  .max(72, '密码最多允许 72 位')
  .regex(/[A-Za-z]/, '密码必须包含字母')
  .regex(/\d/, '密码必须包含数字');
export const EmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
export const RegisterRequestSchema = z
  .object({ email: EmailSchema, password: PasswordSchema })
  .strict();
export const LoginRequestSchema = RegisterRequestSchema;
export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema }).strict();
export const ResetPasswordRequestSchema = z
  .object({ token: z.string().min(32).max(256), password: PasswordSchema })
  .strict();
export const TokenRequestSchema = z.object({ token: z.string().min(32).max(256) }).strict();

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  email: EmailSchema,
  role: z.enum(['user', 'admin']),
  isEmailVerified: z.boolean(),
});
export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  user: UserSummarySchema,
});

const nullableText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.null()]).transform((value) => value || null);
const optionalUrl = z
  .union([z.string().trim().url().max(500), z.literal(''), z.null()])
  .transform((value) => value || null);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '日期格式必须为 YYYY-MM');
const optionalMonth = z.union([month, z.null()]);
const textList = (maximumItems = 20) =>
  z.array(z.string().trim().min(1).max(500)).max(maximumItems);

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  fullName: nullableText(100),
  targetRole: nullableText(120),
  email: z.union([EmailSchema, z.literal(''), z.null()]).transform((value) => value || null),
  phone: nullableText(40),
  location: nullableText(120),
  website: optionalUrl,
  summary: nullableText(2_000),
  version: z.number().int().positive(),
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
});
export const UpdateProfileRequestSchema = ProfileSchema.pick({
  fullName: true,
  targetRole: true,
  email: true,
  phone: true,
  location: true,
  website: true,
  summary: true,
})
  .extend({ baseVersion: z.number().int().positive() })
  .strict();

export const EducationContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    school: z.string().trim().min(1).max(160),
    major: z.string().trim().min(1).max(160),
    degree: z.string().trim().min(1).max(80),
    startDate: month,
    endDate: optionalMonth,
    isCurrent: z.boolean(),
    grade: nullableText(80),
    ranking: nullableText(80),
    description: nullableText(2_000),
  })
  .strict();
export const ProjectContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(160),
    role: nullableText(120),
    startDate: month,
    endDate: optionalMonth,
    isCurrent: z.boolean(),
    background: nullableText(1_000),
    responsibilities: textList(),
    technologies: textList(30),
    outcomes: textList(),
    url: optionalUrl,
  })
  .strict();
export const ExperienceContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    organization: z.string().trim().min(1).max(160),
    position: z.string().trim().min(1).max(120),
    startDate: month,
    endDate: optionalMonth,
    isCurrent: z.boolean(),
    responsibilities: textList(),
    outcomes: textList(),
    skills: textList(30),
  })
  .strict();
export const SkillContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    category: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(100),
    proficiency: nullableText(40),
    description: nullableText(500),
  })
  .strict();

export const ProfileEntryTypeSchema = z.enum(['education', 'project', 'experience', 'skill']);
export const ProfileEntryContentSchema = z.union([
  EducationContentSchema,
  ProjectContentSchema,
  ExperienceContentSchema,
  SkillContentSchema,
]);
export const CreateProfileEntryRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('education'), content: EducationContentSchema }).strict(),
  z.object({ type: z.literal('project'), content: ProjectContentSchema }).strict(),
  z.object({ type: z.literal('experience'), content: ExperienceContentSchema }).strict(),
  z.object({ type: z.literal('skill'), content: SkillContentSchema }).strict(),
]);
export const UpdateProfileEntryRequestSchema = z
  .object({ baseVersion: z.number().int().positive(), content: ProfileEntryContentSchema })
  .strict();
export const ReorderProfileEntriesRequestSchema = z
  .object({
    type: ProfileEntryTypeSchema,
    orderedIds: z.array(z.string().uuid()).max(100),
    versions: z.record(z.string().uuid(), z.number().int().positive()),
  })
  .strict();
export const ProfileEntrySchema = z.object({
  id: z.string().uuid(),
  type: ProfileEntryTypeSchema,
  content: ProfileEntryContentSchema,
  sortOrder: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const ProfileEntryPageSchema = z.object({
  items: z.array(ProfileEntrySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export const ProfileEntryListQuerySchema = z.object({
  type: ProfileEntryTypeSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export const ProfileSnapshotRequestSchema = z
  .object({ entryIds: z.array(z.string().uuid()).max(100) })
  .strict();
export const ProfileSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime(),
  profile: ProfileSchema,
  entries: z.array(ProfileEntrySchema),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type ProfileEntryType = z.infer<typeof ProfileEntryTypeSchema>;
export type ProfileEntryContent = z.infer<typeof ProfileEntryContentSchema>;
export type CreateProfileEntryRequest = z.infer<typeof CreateProfileEntryRequestSchema>;
export type UpdateProfileEntryRequest = z.infer<typeof UpdateProfileEntryRequestSchema>;
export type ReorderProfileEntriesRequest = z.infer<typeof ReorderProfileEntriesRequestSchema>;
export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;
export type ProfileEntryPage = z.infer<typeof ProfileEntryPageSchema>;
export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;

export const EmailJobSchema = z.object({
  to: EmailSchema,
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(5_000),
});
export type EmailJob = z.infer<typeof EmailJobSchema>;

export const MessageDataSchema = z.object({ message: z.string() });
