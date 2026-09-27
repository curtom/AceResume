import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  AiTaskEvent,
  CreateAiTaskRequest,
  ImportCandidate,
  ProfileEntryContent,
  RenderDiagnostics,
  ResumeSuggestion,
} from '@aceresume/contracts';
import type {
  ResumeDocument,
  ResumeSection,
  ResumeTheme,
  TemplateDefinition,
} from '@aceresume/resume-schema';

export const userRole = pgEnum('user_role', ['user', 'admin']);
export const userStatus = pgEnum('user_status', ['active', 'disabled']);
export const profileEntryType = pgEnum('profile_entry_type', [
  'education',
  'project',
  'experience',
  'skill',
]);
export const resumeStatus = pgEnum('resume_status', ['active', 'archived']);
export const resumeSource = pgEnum('resume_source', ['blank', 'profile', 'import']);
export const documentFileType = pgEnum('document_file_type', ['docx', 'pdf', 'txt', 'md']);
export const documentPurpose = pgEnum('document_purpose', ['material', 'resume']);
export const documentStatus = pgEnum('document_status', [
  'queued',
  'parsing',
  'ready',
  'failed',
  'deleting',
]);
export const documentImportStatus = pgEnum('document_import_status', ['pending', 'confirmed']);
export const templateVersionStatus = pgEnum('template_version_status', [
  'draft',
  'published',
  'retired',
]);
export const exportJobStatus = pgEnum('export_job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);
export const aiTaskStatus = pgEnum('ai_task_status', [
  'queued',
  'processing',
  'awaiting_confirmation',
  'completed',
  'failed',
]);
export const aiGenerationDecision = pgEnum('ai_generation_decision', [
  'pending',
  'accepted',
  'rejected',
]);
export const aiSourceType = pgEnum('ai_source_type', ['profile', 'document']);
export const aiTaskEventType = pgEnum('ai_task_event_type', [
  'started',
  'progress',
  'delta',
  'suggestion',
  'completed',
  'failed',
  'heartbeat',
]);
export const promptVersionStatus = pgEnum('prompt_version_status', ['draft', 'active', 'retired']);
export const auditResult = pgEnum('audit_result', ['success', 'failed']);
export const resumeSectionType = pgEnum('resume_section_type', [
  'basic',
  'target',
  'education',
  'experience',
  'project',
  'campus',
  'skill',
  'award',
  'summary',
  'custom',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    status: userStatus('status').notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),
    deviceInfo: varchar('device_info', { length: 500 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_sessions_refresh_hash_unique').on(table.refreshTokenHash),
    index('user_sessions_user_expires_idx').on(table.userId, table.expiresAt),
  ],
);

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('email_verification_tokens_hash_unique').on(table.tokenHash)],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash)],
);

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 100 }),
    targetRole: varchar('target_role', { length: 120 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 40 }),
    location: varchar('location', { length: 120 }),
    website: varchar('website', { length: 500 }),
    summary: text('summary'),
    version: integer('version').notNull().default(1),
    schemaVersion: integer('schema_version').notNull().default(1),
    ...timestamps,
  },
  (table) => [uniqueIndex('profiles_user_unique').on(table.userId)],
);

export const profileEntries = pgTable(
  'profile_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: profileEntryType('type').notNull(),
    content: jsonb('content').$type<ProfileEntryContent>().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    version: integer('version').notNull().default(1),
    schemaVersion: integer('schema_version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('profile_entries_user_type_order_idx').on(table.userId, table.type, table.sortOrder),
  ],
);

export const templates = pgTable('templates', {
  id: varchar('id', { length: 60 }).primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  description: varchar('description', { length: 240 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  layout: varchar('layout', { length: 30 }).notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  ...timestamps,
});

export const templateVersions = pgTable(
  'template_versions',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    templateId: varchar('template_id', { length: 60 })
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    status: templateVersionStatus('status').notNull().default('draft'),
    definition: jsonb('definition').$type<TemplateDefinition>().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('template_versions_template_version_unique').on(table.templateId, table.version),
  ],
);

export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    targetRole: varchar('target_role', { length: 120 }),
    locale: varchar('locale', { length: 10 }).notNull().default('zh-CN'),
    templateVersionId: varchar('template_version_id', { length: 100 }).notNull(),
    theme: jsonb('theme').$type<ResumeTheme>().notNull(),
    status: resumeStatus('status').notNull().default('active'),
    source: resumeSource('source').notNull(),
    thumbnailStatus: varchar('thumbnail_status', { length: 20 }).notNull().default('placeholder'),
    version: integer('version').notNull().default(1),
    lastSaveKey: uuid('last_save_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('resumes_user_status_updated_idx').on(table.userId, table.status, table.updatedAt),
  ],
);

export const resumeSections = pgTable(
  'resume_sections',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    type: resumeSectionType('section_type').notNull(),
    title: varchar('title', { length: 80 }).notNull(),
    content: jsonb('content').$type<ResumeSection['content']>().notNull(),
    sortOrder: integer('sort_order').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),
    styleOverride: jsonb('style_override').$type<Record<string, string | number>>(),
    schemaVersion: integer('schema_version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('resume_sections_resume_order_unique').on(table.resumeId, table.sortOrder),
    index('resume_sections_user_resume_idx').on(table.userId, table.resumeId),
  ],
);

export const exportJobs = pgTable(
  'export_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    resumeVersion: integer('resume_version').notNull(),
    templateVersionId: varchar('template_version_id', { length: 100 })
      .notNull()
      .references(() => templateVersions.id, { onDelete: 'restrict' }),
    idempotencyKey: uuid('idempotency_key').notNull(),
    status: exportJobStatus('status').notNull().default('queued'),
    inputSnapshot: jsonb('input_snapshot').$type<ResumeDocument>().notNull(),
    objectKey: varchar('object_key', { length: 500 }),
    fileName: varchar('file_name', { length: 180 }).notNull(),
    diagnostics: jsonb('diagnostics').$type<RenderDiagnostics>(),
    errorCode: varchar('error_code', { length: 80 }),
    errorMessage: varchar('error_message', { length: 500 }),
    attemptCount: integer('attempt_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('export_jobs_user_idempotency_unique').on(table.userId, table.idempotencyKey),
    index('export_jobs_user_created_idx').on(table.userId, table.createdAt),
    index('export_jobs_resume_version_idx').on(table.resumeId, table.resumeVersion),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: documentFileType('file_type').notNull(),
    purpose: documentPurpose('purpose').notNull().default('material'),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    status: documentStatus('status').notNull().default('queued'),
    pageCount: integer('page_count'),
    chunkCount: integer('chunk_count').notNull().default(0),
    errorCode: varchar('error_code', { length: 80 }),
    errorMessage: varchar('error_message', { length: 500 }),
    attemptCount: integer('attempt_count').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('documents_user_created_idx').on(table.userId, table.createdAt),
    index('documents_user_status_idx').on(table.userId, table.status),
  ],
);

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    pageNumber: integer('page_number'),
    paragraphStart: integer('paragraph_start'),
    paragraphEnd: integer('paragraph_end'),
    sectionPath: varchar('section_path', { length: 300 }),
    chunkIndex: integer('chunk_index').notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding', { dimensions: 1024 }),
    embeddingModel: varchar('embedding_model', { length: 120 }),
    embeddedAt: timestamp('embedded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('document_chunks_document_index_unique').on(table.documentId, table.chunkIndex),
    index('document_chunks_user_document_idx').on(table.userId, table.documentId),
  ],
);

export const aiTasks = pgTable(
  'ai_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').notNull(),
    baseVersion: integer('base_version').notNull(),
    status: aiTaskStatus('status').notNull().default('queued'),
    progress: integer('progress').notNull().default(0),
    provider: varchar('provider', { length: 20 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    promptVersion: varchar('prompt_version', { length: 80 }).notNull(),
    input: jsonb('input').$type<CreateAiTaskRequest>().notNull(),
    sequence: integer('sequence').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    inputTokenCount: integer('input_token_count').notNull().default(0),
    outputTokenCount: integer('output_token_count').notNull().default(0),
    errorCode: varchar('error_code', { length: 80 }),
    errorMessage: varchar('error_message', { length: 500 }),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('ai_tasks_user_created_idx').on(table.userId, table.createdAt),
    index('ai_tasks_resume_created_idx').on(table.resumeId, table.createdAt),
  ],
);

export const aiGenerations = pgTable(
  'ai_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => aiTasks.id, { onDelete: 'cascade' }),
    suggestion: jsonb('suggestion').$type<ResumeSuggestion>().notNull(),
    decision: aiGenerationDecision('decision').notNull().default('pending'),
    editedText: text('edited_text'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedResumeVersion: integer('applied_resume_version'),
    ...timestamps,
  },
  (table) => [
    index('ai_generations_task_created_idx').on(table.taskId, table.createdAt),
    index('ai_generations_user_created_idx').on(table.userId, table.createdAt),
  ],
);

export const aiCitations = pgTable(
  'ai_citations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    generationId: uuid('generation_id')
      .notNull()
      .references(() => aiGenerations.id, { onDelete: 'cascade' }),
    sourceType: aiSourceType('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    chunkId: uuid('chunk_id').references(() => documentChunks.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 255 }).notNull(),
    excerpt: varchar('excerpt', { length: 800 }).notNull(),
    quoteRange: jsonb('quote_range').$type<{ start: number; end: number } | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_citations_generation_idx').on(table.generationId),
    index('ai_citations_user_source_idx').on(table.userId, table.sourceId),
  ],
);

export const aiTaskEvents = pgTable(
  'ai_task_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => aiTasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    type: aiTaskEventType('event_type').notNull(),
    data: jsonb('data').$type<AiTaskEvent['data']>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_task_events_task_sequence_unique').on(table.taskId, table.sequence),
    index('ai_task_events_user_task_idx').on(table.userId, table.taskId),
  ],
);

export const documentImports = pgTable(
  'document_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    status: documentImportStatus('status').notNull().default('pending'),
    candidates: jsonb('candidates').$type<ImportCandidate[]>().notNull(),
    confirmedSelection: jsonb('confirmed_selection').$type<Array<{ id: string; value: string }>>(),
    destination: varchar('destination', { length: 20 }),
    resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('document_imports_document_unique').on(table.documentId),
    index('document_imports_user_created_idx').on(table.userId, table.createdAt),
  ],
);

export const modelConfigs = pgTable('model_configs', {
  id: varchar('id', { length: 60 }).primaryKey(),
  provider: varchar('provider', { length: 20 }).notNull(),
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  chatModel: varchar('chat_model', { length: 120 }).notNull(),
  embeddingModel: varchar('embedding_model', { length: 120 }).notNull(),
  embeddingDimension: integer('embedding_dimension').notNull(),
  timeoutMs: integer('timeout_ms').notNull(),
  maxOutputTokens: integer('max_output_tokens').notNull(),
  temperaturePermille: integer('temperature_permille').notNull(),
  supportsJson: boolean('supports_json').notNull().default(true),
  supportsTools: boolean('supports_tools').notNull().default(false),
  isEnabled: boolean('is_enabled').notNull().default(true),
  secretCiphertext: text('secret_ciphertext'),
  secretIv: varchar('secret_iv', { length: 64 }),
  secretTag: varchar('secret_tag', { length: 64 }),
  ...timestamps,
});

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('prompt_key', { length: 80 }).notNull(),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    status: promptVersionStatus('status').notNull().default('draft'),
    rolloutPercent: integer('rollout_percent').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'restrict' }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('prompt_versions_key_version_unique').on(table.key, table.version)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    adminEmail: varchar('admin_email', { length: 254 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 80 }).notNull(),
    targetId: varchar('target_id', { length: 120 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    result: auditResult('result').notNull(),
    requestId: uuid('request_id'),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_created_idx').on(table.createdAt),
    index('audit_logs_admin_created_idx').on(table.adminUserId, table.createdAt),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
  ],
);
