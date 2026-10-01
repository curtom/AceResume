import { z } from 'zod';
import {
  ResumeDocumentSchema,
  ResumeLocaleSchema,
  TemplateDefinitionSchema,
} from '@aceresume/resume-schema';

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
  'RESUME_LIMIT_REACHED',
  'RESUME_NOT_FOUND',
  'RESUME_VERSION_CONFLICT',
  'TEMPLATE_NOT_FOUND',
  'EXPORT_NOT_FOUND',
  'EXPORT_NOT_READY',
  'EXPORT_RENDER_FAILED',
  'DOCUMENT_NOT_FOUND',
  'DOCUMENT_LIMIT_REACHED',
  'DOCUMENT_TYPE_UNSUPPORTED',
  'DOCUMENT_TOO_LARGE',
  'DOCUMENT_PARSE_FAILED',
  'DOCUMENT_NOT_READY',
  'DOCUMENT_DELETE_FAILED',
  'IMPORT_NOT_FOUND',
  'IMPORT_ALREADY_CONFIRMED',
  'AI_TASK_NOT_FOUND',
  'AI_SOURCE_FORBIDDEN',
  'AI_CONSENT_REQUIRED',
  'AI_OUTPUT_INVALID',
  'AI_UNSUPPORTED_CLAIM',
  'AI_PROVIDER_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_CONTENT_REJECTED',
  'AI_PROVIDER_UNAVAILABLE',
  'ADMIN_REAUTH_REQUIRED',
  'ADMIN_SELF_ACTION_FORBIDDEN',
  'ADMIN_TEMPLATE_STATE_INVALID',
  'ADMIN_CONFIG_INVALID',
  'FEATURE_NOT_AVAILABLE',
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
const textList = (maximumItems = 20, maximumLength = 500) =>
  z.array(z.string().trim().min(1).max(maximumLength)).max(maximumItems);

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
    responsibilities: textList(20, 1_000),
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
    responsibilities: textList(20, 1_000),
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
    description: nullableText(1_000),
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
const profileEntryBase = {
  id: z.string().uuid(),
  sortOrder: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const ProfileEntrySchema = z.discriminatedUnion('type', [
  z.object({ ...profileEntryBase, type: z.literal('education'), content: EducationContentSchema }),
  z.object({ ...profileEntryBase, type: z.literal('project'), content: ProjectContentSchema }),
  z.object({
    ...profileEntryBase,
    type: z.literal('experience'),
    content: ExperienceContentSchema,
  }),
  z.object({ ...profileEntryBase, type: z.literal('skill'), content: SkillContentSchema }),
]);
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

export const ResumeStatusSchema = z.enum(['active', 'archived']);
export const ResumeSourceSchema = z.enum(['blank', 'profile', 'import']);
export const ResumeSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  targetRole: nullableText(120),
  locale: ResumeLocaleSchema,
  templateVersionId: z.string().min(1).max(100),
  status: ResumeStatusSchema,
  source: ResumeSourceSchema,
  thumbnailStatus: z.literal('placeholder'),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const ResumeDetailSchema = ResumeSummarySchema.extend({
  document: ResumeDocumentSchema,
  template: TemplateDefinitionSchema,
  avatarUrl: z.string().url().nullable(),
});
const resumeName = z.string().trim().min(1).max(120);
const resumeTargetRole = nullableText(120);
const templateVersionId = z.string().trim().min(1).max(100).default('classic-single-v1');
export const CreateResumeRequestSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('blank'),
      name: resumeName,
      targetRole: resumeTargetRole,
      locale: ResumeLocaleSchema,
      templateVersionId,
    })
    .strict(),
  z
    .object({
      mode: z.literal('profile'),
      name: resumeName,
      targetRole: resumeTargetRole,
      locale: ResumeLocaleSchema,
      templateVersionId,
      profileEntryIds: z.array(z.string().uuid()).max(100),
    })
    .strict(),
  z
    .object({
      mode: z.literal('import'),
      name: resumeName,
      targetRole: resumeTargetRole,
      locale: ResumeLocaleSchema,
      templateVersionId,
    })
    .strict(),
]);
export const UpdateResumeRequestSchema = z
  .object({
    baseVersion: z.number().int().positive(),
    name: resumeName,
    targetRole: resumeTargetRole,
  })
  .strict();
export const ResumeStatusActionRequestSchema = z
  .object({ baseVersion: z.number().int().positive() })
  .strict();
export const DuplicateResumeRequestSchema = z.object({ name: resumeName.optional() }).strict();
export const SaveResumeRequestSchema = z
  .object({
    baseVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
    document: ResumeDocumentSchema,
  })
  .strict();
export const ResumeListQuerySchema = z.object({
  status: ResumeStatusSchema.default('active'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(12),
});
export const ResumePageSchema = z.object({
  items: z.array(ResumeSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export type ResumeStatus = z.infer<typeof ResumeStatusSchema>;
export type ResumeSummary = z.infer<typeof ResumeSummarySchema>;
export type ResumeDetail = z.infer<typeof ResumeDetailSchema>;
export type CreateResumeRequest = z.infer<typeof CreateResumeRequestSchema>;
export type UpdateResumeRequest = z.infer<typeof UpdateResumeRequestSchema>;
export type SaveResumeRequest = z.infer<typeof SaveResumeRequestSchema>;
export type ResumePage = z.infer<typeof ResumePageSchema>;

export const TemplateSummarySchema = TemplateDefinitionSchema;
export const TemplateListSchema = z.object({ items: z.array(TemplateSummarySchema) }).strict();
export type TemplateSummary = z.infer<typeof TemplateSummarySchema>;
export type TemplateList = z.infer<typeof TemplateListSchema>;

export const ExportStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
export const RenderDiagnosticsSchema = z
  .object({
    pageCount: z.number().int().nonnegative(),
    overflowCount: z.number().int().nonnegative(),
    blankPageCount: z.number().int().nonnegative(),
    invalidLinkCount: z.number().int().nonnegative(),
    fontReady: z.boolean(),
    exceedsRecommendedPages: z.boolean(),
    exceedsMaximumPages: z.boolean(),
  })
  .strict();
export const CreateExportRequestSchema = z
  .object({
    resumeVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const ExportJobSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    resumeVersion: z.number().int().positive(),
    templateVersionId: z.string().min(1).max(100),
    status: ExportStatusSchema,
    fileName: z.string().min(1).max(180),
    diagnostics: RenderDiagnosticsSchema.nullable(),
    errorCode: z.string().max(80).nullable(),
    errorMessage: z.string().max(500).nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict();
export const PdfExportJobSchema = z.object({ exportJobId: z.string().uuid() }).strict();
export type ExportStatus = z.infer<typeof ExportStatusSchema>;
export type RenderDiagnostics = z.infer<typeof RenderDiagnosticsSchema>;
export type CreateExportRequest = z.infer<typeof CreateExportRequestSchema>;
export type ExportJob = z.infer<typeof ExportJobSchema>;
export type PdfExportJob = z.infer<typeof PdfExportJobSchema>;

export const DocumentFileTypeSchema = z.enum(['docx', 'pdf', 'txt', 'md']);
export const DocumentPurposeSchema = z.enum(['material', 'resume']);
export const DocumentStatusSchema = z.enum(['queued', 'parsing', 'ready', 'failed', 'deleting']);
export const DocumentSummarySchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string().min(1).max(255),
    fileType: DocumentFileTypeSchema,
    purpose: DocumentPurposeSchema,
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().nonnegative(),
    status: DocumentStatusSchema,
    chunkCount: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative().nullable(),
    errorCode: z.string().max(80).nullable(),
    errorMessage: z.string().max(500).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const DocumentPageSchema = z
  .object({
    items: z.array(DocumentSummarySchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    usageBytes: z.number().int().nonnegative(),
    limits: z.object({
      maxFileBytes: z.number().int().positive(),
      maxFiles: z.number().int().positive(),
      maxTotalBytes: z.number().int().positive(),
    }),
  })
  .strict();
export const DocumentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(12),
});
export const DocumentChunkSchema = z
  .object({
    id: z.string().uuid(),
    content: z.string().max(20_000),
    pageNumber: z.number().int().positive().nullable(),
    paragraphStart: z.number().int().nonnegative().nullable(),
    paragraphEnd: z.number().int().nonnegative().nullable(),
    sectionPath: z.string().max(300).nullable(),
    chunkIndex: z.number().int().nonnegative(),
  })
  .strict();
export const ImportCandidateFieldSchema = z.enum([
  'fullName',
  'email',
  'phone',
  'location',
  'targetRole',
  'summary',
  'school',
  'major',
  'degree',
  'organization',
  'position',
  'projectName',
  'projectRole',
  'skill',
  'startDate',
  'endDate',
  'technologies',
  'description',
]);
export const ImportCandidateSchema = z
  .object({
    id: z.string().uuid(),
    section: z.enum(['basic', 'summary', 'education', 'experience', 'project', 'skill']),
    field: ImportCandidateFieldSchema,
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(5_000),
    confidence: z.number().min(0).max(1),
    source: z.object({
      chunkId: z.string().uuid(),
      pageNumber: z.number().int().positive().nullable(),
      paragraphStart: z.number().int().nonnegative().nullable(),
    }),
  })
  .strict();
export const DocumentImportSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(['pending', 'confirmed']),
    candidates: z.array(ImportCandidateSchema).max(200),
    confirmedAt: z.string().datetime().nullable(),
  })
  .strict();
export const DocumentDetailSchema = DocumentSummarySchema.extend({
  chunks: z.array(DocumentChunkSchema).max(5_000),
  import: DocumentImportSchema.nullable(),
});
export const ConfirmDocumentImportRequestSchema = z
  .object({
    selected: z
      .array(z.object({ id: z.string().uuid(), value: z.string().trim().min(1).max(5_000) }))
      .min(1)
      .max(200),
    destination: z.enum(['profile', 'resume', 'both']),
    resumeId: z.string().uuid().nullable().default(null),
    resumeVersion: z.number().int().positive().nullable().default(null),
    newResume: z
      .object({
        name: z.string().trim().min(1).max(120),
        targetRole: nullableText(120),
        locale: ResumeLocaleSchema,
        templateVersionId: z.string().trim().min(1).max(100),
      })
      .nullable()
      .default(null),
  })
  .strict();
export const ConfirmDocumentImportResultSchema = z
  .object({
    profileEntryCount: z.number().int().nonnegative(),
    resumeId: z.string().uuid().nullable(),
  })
  .strict();
export const DocumentParseJobSchema = z.object({ documentId: z.string().uuid() }).strict();
export const StorageCleanupJobSchema = z.object({ documentId: z.string().uuid() }).strict();

export type DocumentFileType = z.infer<typeof DocumentFileTypeSchema>;
export type DocumentPurpose = z.infer<typeof DocumentPurposeSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
export type DocumentPage = z.infer<typeof DocumentPageSchema>;
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;
export type DocumentImport = z.infer<typeof DocumentImportSchema>;
export type ImportCandidate = z.infer<typeof ImportCandidateSchema>;
export type ConfirmDocumentImportRequest = z.infer<typeof ConfirmDocumentImportRequestSchema>;
export type ConfirmDocumentImportResult = z.infer<typeof ConfirmDocumentImportResultSchema>;
export type DocumentParseJob = z.infer<typeof DocumentParseJobSchema>;
export type StorageCleanupJob = z.infer<typeof StorageCleanupJobSchema>;

export const AiSupportStatusSchema = z.enum(['supported', 'conflict', 'unsupported']);
export const AiContentTypeSchema = z.enum(['project', 'experience', 'campus']);
export const AiTaskStatusSchema = z.enum([
  'queued',
  'processing',
  'awaiting_confirmation',
  'completed',
  'failed',
]);
export const AiSourceSelectionSchema = z
  .object({
    documentIds: z.array(z.string().uuid()).max(20).default([]),
    profileEntryIds: z.array(z.string().uuid()).max(50).default([]),
  })
  .strict()
  .refine((value) => value.documentIds.length + value.profileEntryIds.length > 0, {
    message: '请至少选择一项事实来源。',
  });
export const AiResumePatchSchema = z
  .object({
    sectionId: z.string().uuid(),
    entryId: z.string().uuid().nullable(),
    field: z.enum(['body', 'description']),
    operation: z.enum(['replace', 'append']),
  })
  .strict();
export const AiCitationSchema = z
  .object({
    id: z.string().uuid(),
    sourceType: z.enum(['profile', 'document']),
    sourceId: z.string().uuid(),
    chunkId: z.string().uuid().nullable(),
    label: z.string().min(1).max(255),
    excerpt: z.string().min(1).max(800),
    quoteRange: z
      .object({ start: z.number().int().nonnegative(), end: z.number().int().positive() })
      .nullable(),
  })
  .strict();
export const ResumeSuggestionSchema = z
  .object({
    id: z.string().uuid(),
    advice: z.string().trim().min(1).max(2_000).default('基于事实来源优化内容表达与结构。'),
    text: z.string().trim().min(1).max(5_000),
    beforeText: z.string().max(5_000).optional(),
    citations: z.array(AiCitationSchema).min(1).max(20),
    supportStatus: AiSupportStatusSchema,
    missingFacts: z.array(z.string().max(300)).max(20),
    riskFlags: z.array(z.string().max(120)).max(20),
    patch: AiResumePatchSchema,
    decision: z.enum(['pending', 'accepted', 'rejected']),
    editedText: z.string().max(5_000).nullable(),
    appliedAt: z.string().datetime().nullable(),
  })
  .strict();
export const CreateAiTaskRequestSchema = z
  .object({
    resumeId: z.string().uuid(),
    sectionId: z.string().uuid(),
    contentType: AiContentTypeSchema,
    baseVersion: z.number().int().positive(),
    instruction: z.string().trim().min(3).max(2_000),
    jobDescription: z.string().trim().max(10_000).nullable().default(null),
    sources: AiSourceSelectionSchema,
    consentToThirdParty: z.literal(true, {
      errorMap: () => ({ message: '请先同意必要材料将发送给模型服务商。' }),
    }),
  })
  .strict();
export const AiTaskSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    sectionId: z.string().uuid(),
    baseVersion: z.number().int().positive(),
    status: AiTaskStatusSchema,
    progress: z.number().int().min(0).max(100),
    provider: z.enum(['mock', 'qwen']),
    model: z.string().min(1).max(120),
    promptVersion: z.string().min(1).max(80),
    errorCode: z.string().max(80).nullable(),
    errorMessage: z.string().max(500).nullable(),
    suggestions: z.array(ResumeSuggestionSchema).max(10),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const DecideAiSuggestionRequestSchema = z
  .object({
    baseVersion: z.number().int().positive(),
    editedText: z.string().trim().min(1).max(5_000).nullable().default(null),
  })
  .strict();
export const AiTaskEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    type: z.enum([
      'started',
      'progress',
      'delta',
      'suggestion',
      'completed',
      'failed',
      'heartbeat',
    ]),
    data: z.record(z.unknown()),
    createdAt: z.string().datetime(),
  })
  .strict();
export const AiGenerateJobSchema = z.object({ taskId: z.string().uuid() }).strict();
export const DocumentEmbedJobSchema = z.object({ documentId: z.string().uuid() }).strict();

export type AiSupportStatus = z.infer<typeof AiSupportStatusSchema>;
export type AiContentType = z.infer<typeof AiContentTypeSchema>;
export type AiTaskStatus = z.infer<typeof AiTaskStatusSchema>;
export type AiSourceSelection = z.infer<typeof AiSourceSelectionSchema>;
export type AiResumePatch = z.infer<typeof AiResumePatchSchema>;
export type AiCitation = z.infer<typeof AiCitationSchema>;
export type ResumeSuggestion = z.infer<typeof ResumeSuggestionSchema>;
export type CreateAiTaskRequest = z.infer<typeof CreateAiTaskRequestSchema>;
export type AiTask = z.infer<typeof AiTaskSchema>;
export type DecideAiSuggestionRequest = z.infer<typeof DecideAiSuggestionRequestSchema>;
export type AiTaskEvent = z.infer<typeof AiTaskEventSchema>;
export type AiGenerateJob = z.infer<typeof AiGenerateJobSchema>;
export type DocumentEmbedJob = z.infer<typeof DocumentEmbedJobSchema>;

export const AdminSensitiveActionSchema = z
  .object({
    password: PasswordSchema,
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
export const AdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(''),
});
export const AdminUserSchema = z
  .object({
    id: z.string().uuid(),
    email: EmailSchema,
    role: z.enum(['user', 'admin']),
    status: z.enum(['active', 'disabled']),
    isEmailVerified: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const AdminUserPageSchema = z
  .object({
    items: z.array(AdminUserSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export const AdminUpdateUserStatusSchema = AdminSensitiveActionSchema.extend({
  status: z.enum(['active', 'disabled']),
}).strict();
export const AdminTemplateVersionSchema = z
  .object({
    definition: TemplateDefinitionSchema,
    status: z.enum(['draft', 'published', 'retired']),
    publishedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export const AdminTemplateListSchema = z
  .object({ items: z.array(AdminTemplateVersionSchema) })
  .strict();
export const AdminSaveTemplateSchema = AdminSensitiveActionSchema.extend({
  definition: TemplateDefinitionSchema,
}).strict();
export const AdminModelConfigSchema = z
  .object({
    id: z.string().min(1).max(60),
    provider: z.enum(['mock', 'qwen']),
    baseUrl: z.string().url(),
    chatModel: z.string().min(1).max(120),
    embeddingModel: z.string().min(1).max(120),
    embeddingDimension: z.number().int().positive(),
    timeoutMs: z.number().int().min(1_000).max(300_000),
    maxOutputTokens: z.number().int().min(128).max(32_768),
    temperature: z.number().min(0).max(2),
    supportsJson: z.boolean(),
    supportsTools: z.boolean(),
    isEnabled: z.boolean(),
    secretConfigured: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const AdminUpdateModelConfigSchema = AdminSensitiveActionSchema.extend({
  provider: z.enum(['mock', 'qwen']),
  baseUrl: z.string().url(),
  chatModel: z.string().min(1).max(120),
  embeddingModel: z.string().min(1).max(120),
  embeddingDimension: z.number().int().positive(),
  timeoutMs: z.number().int().min(1_000).max(300_000),
  maxOutputTokens: z.number().int().min(128).max(32_768),
  temperature: z.number().min(0).max(2),
  supportsJson: z.boolean(),
  supportsTools: z.boolean(),
  isEnabled: z.boolean(),
  secret: z.string().min(8).max(500).nullable().optional(),
}).strict();
export const AdminPromptVersionSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string().min(1).max(80),
    version: z.number().int().positive(),
    content: z.string().min(1).max(20_000),
    status: z.enum(['draft', 'active', 'retired']),
    rolloutPercent: z.number().int().min(0).max(100),
    createdAt: z.string().datetime(),
    activatedAt: z.string().datetime().nullable(),
  })
  .strict();
export const AdminPromptListSchema = z
  .object({ items: z.array(AdminPromptVersionSchema) })
  .strict();
export const AdminCreatePromptSchema = AdminSensitiveActionSchema.extend({
  key: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(20_000),
  rolloutPercent: z.number().int().min(0).max(100).default(0),
}).strict();
export const AdminActivatePromptSchema = AdminSensitiveActionSchema.extend({
  rolloutPercent: z.number().int().min(1).max(100).default(100),
}).strict();
export const AdminTestPromptSchema = z
  .object({ content: z.string().trim().min(1).max(20_000) })
  .strict();
export const AdminPromptTestResultSchema = z
  .object({
    passed: z.boolean(),
    checks: z.array(
      z.object({ key: z.string(), passed: z.boolean(), message: z.string() }).strict(),
    ),
  })
  .strict();
export const AdminAuditLogSchema = z
  .object({
    id: z.string().uuid(),
    adminUserId: z.string().uuid(),
    adminEmail: EmailSchema,
    action: z.string().max(100),
    targetType: z.string().max(80),
    targetId: z.string().max(120),
    reason: z.string().max(500),
    result: z.enum(['success', 'failed']),
    requestId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export const AdminAuditPageSchema = z
  .object({
    items: z.array(AdminAuditLogSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();
const AdminStatusMetricSchema = z
  .object({ status: z.string(), count: z.number().int().nonnegative() })
  .strict();
export const AdminMonitoringSchema = z
  .object({
    ai: z.object({
      total: z.number().int().nonnegative(),
      succeeded: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      successRate: z.number().min(0).max(1),
      averageLatencyMs: z.number().nonnegative(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      usageEstimated: z.boolean(),
      accepted: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
    }),
    documents: z.array(AdminStatusMetricSchema),
    exports: z.array(AdminStatusMetricSchema),
    queues: z.record(
      z.object({
        waiting: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      }),
    ),
    generatedAt: z.string().datetime(),
  })
  .strict();

export type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>;
export type AdminUpdateUserStatus = z.infer<typeof AdminUpdateUserStatusSchema>;
export type AdminTemplateVersion = z.infer<typeof AdminTemplateVersionSchema>;
export type AdminSaveTemplate = z.infer<typeof AdminSaveTemplateSchema>;
export type AdminModelConfig = z.infer<typeof AdminModelConfigSchema>;
export type AdminUpdateModelConfig = z.infer<typeof AdminUpdateModelConfigSchema>;
export type AdminPromptVersion = z.infer<typeof AdminPromptVersionSchema>;
export type AdminCreatePrompt = z.infer<typeof AdminCreatePromptSchema>;
export type AdminActivatePrompt = z.infer<typeof AdminActivatePromptSchema>;
export type AdminTestPrompt = z.infer<typeof AdminTestPromptSchema>;
export type AdminPromptTestResult = z.infer<typeof AdminPromptTestResultSchema>;
export type AdminAuditLog = z.infer<typeof AdminAuditLogSchema>;
export type AdminAuditPage = z.infer<typeof AdminAuditPageSchema>;
export type AdminMonitoring = z.infer<typeof AdminMonitoringSchema>;
