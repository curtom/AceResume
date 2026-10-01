import { z } from 'zod';

export const ResumeLocaleSchema = z.enum(['zh-CN', 'en-US']);
export const ResumeSectionTypeSchema = z.enum([
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
const nullableText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.null()]).transform((value) => value || null);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '日期格式必须为 YYYY-MM');
const startMonth = z.union([month, z.literal('')]);
const optionalMonth = z.union([month, z.null()]);
const safeLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, '链接只允许 http、https 或 mailto 协议');

export const RichTextMarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }).strict(),
  z.object({ type: z.literal('italic') }).strict(),
  z.object({ type: z.literal('underline') }).strict(),
  z.object({ type: z.literal('link'), attrs: z.object({ href: safeLink }).strict() }).strict(),
]);
export type RichTextMark = z.infer<typeof RichTextMarkSchema>;
export type RichTextNode =
  | { type: 'text'; text: string; marks?: RichTextMark[] | undefined }
  | { type: 'hardBreak' }
  | { type: 'paragraph'; content?: RichTextNode[] | undefined }
  | { type: 'listItem'; content: RichTextNode[] }
  | { type: 'bulletList' | 'orderedList'; content: RichTextNode[] };
export const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('text'),
        text: z.string().max(10_000),
        marks: z.array(RichTextMarkSchema).max(8).optional(),
      })
      .strict(),
    z.object({ type: z.literal('hardBreak') }).strict(),
    z
      .object({
        type: z.literal('paragraph'),
        content: z.array(RichTextNodeSchema).max(200).optional(),
      })
      .strict(),
    z
      .object({ type: z.literal('listItem'), content: z.array(RichTextNodeSchema).min(1).max(100) })
      .strict(),
    z
      .object({
        type: z.enum(['bulletList', 'orderedList']),
        content: z.array(RichTextNodeSchema).max(100),
      })
      .strict(),
  ]),
);
export const RichTextDocumentSchema = z
  .object({ type: z.literal('doc'), content: z.array(RichTextNodeSchema).max(500) })
  .strict();
export type RichTextDocument = z.infer<typeof RichTextDocumentSchema>;

const entryBase = { id: z.string().uuid(), sortOrder: z.number().int().nonnegative() };
const timeline = { startDate: startMonth, endDate: optionalMonth, isCurrent: z.boolean() };
export const EducationResumeEntrySchema = z
  .object({
    ...entryBase,
    school: z.string().trim().max(160),
    major: z.string().trim().max(160),
    degree: z.string().trim().max(80),
    ...timeline,
    description: RichTextDocumentSchema,
  })
  // Strip the two retired keys when loading an old server document or IndexedDB draft.
  .strip();
export const ExperienceResumeEntrySchema = z
  .object({
    ...entryBase,
    organization: z.string().trim().max(160),
    position: z.string().trim().max(120),
    location: nullableText(120),
    ...timeline,
    description: RichTextDocumentSchema,
  })
  .strict();
export const ProjectResumeEntrySchema = z
  .object({
    ...entryBase,
    name: z.string().trim().max(160),
    role: nullableText(120),
    technologies: z.array(z.string().trim().min(1).max(100)).max(30),
    url: z.union([safeLink, z.literal(''), z.null()]).transform((value) => value || null),
    ...timeline,
    description: RichTextDocumentSchema,
  })
  .strict();
export const CampusResumeEntrySchema = z
  .object({
    ...entryBase,
    organization: z.string().trim().max(160),
    role: z.string().trim().max(120),
    ...timeline,
    description: RichTextDocumentSchema,
  })
  .strict();
export const SkillResumeEntrySchema = z
  .object({
    ...entryBase,
    category: z.string().trim().max(80),
    name: z.string().trim().max(100),
    proficiency: nullableText(40),
    description: RichTextDocumentSchema,
  })
  .strict();
export const AwardResumeEntrySchema = z
  .object({
    ...entryBase,
    name: z.string().trim().max(160),
    issuer: nullableText(160),
    awardedAt: optionalMonth,
    description: RichTextDocumentSchema,
  })
  .strict();

const sectionBase = {
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().nonnegative(),
  isVisible: z.boolean(),
  schemaVersion: z.literal(1),
  styleOverride: z.record(z.union([z.string(), z.number()])).optional(),
};
export const ResumeSectionSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...sectionBase,
      type: z.literal('basic'),
      content: z
        .object({
          fullName: nullableText(100),
          email: nullableText(254),
          phone: nullableText(40),
          location: nullableText(120),
          // Kept optional so previously saved resumes remain readable; new editors no longer expose it.
          website: nullableText(500).optional(),
          customFields: z
            .array(
              z
                .object({
                  id: z.string().uuid(),
                  label: z.string().trim().max(80),
                  value: z.string().trim().max(300),
                })
                .strict(),
            )
            .max(10)
            .default([]),
          avatarObjectKey: nullableText(500).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('target'),
      content: z.object({ role: nullableText(120) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('education'),
      content: z.object({ entries: z.array(EducationResumeEntrySchema).max(30) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('experience'),
      content: z.object({ entries: z.array(ExperienceResumeEntrySchema).max(30) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('project'),
      content: z.object({ entries: z.array(ProjectResumeEntrySchema).max(30) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('campus'),
      content: z.object({ entries: z.array(CampusResumeEntrySchema).max(30) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('skill'),
      content: z.object({ entries: z.array(SkillResumeEntrySchema).max(60) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('award'),
      content: z.object({ entries: z.array(AwardResumeEntrySchema).max(40) }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('summary'),
      content: z.object({ body: RichTextDocumentSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...sectionBase,
      type: z.literal('custom'),
      content: z.object({ body: RichTextDocumentSchema }).strict(),
    })
    .strict(),
]);

export const ResumeThemeSchema = z
  .object({
    fontFamily: z.enum(['Noto Sans SC', 'Noto Serif SC', 'Source Han Sans SC']),
    fontSize: z.number().min(9).max(16),
    lineHeight: z.number().min(1.2).max(2),
    sectionGap: z.number().min(6).max(32),
    paragraphGap: z.number().min(2).max(20),
    pageMargin: z
      .object({
        top: z.number().min(10).max(30),
        right: z.number().min(10).max(30),
        bottom: z.number().min(10).max(30),
        left: z.number().min(10).max(30),
      })
      .strict(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export const TemplateLayoutSchema = z.enum(['single-column', 'two-column']);
export const TemplateCategorySchema = z.enum(['general', 'technology', 'internship', 'academic']);
const themeRange = z.object({ min: z.number(), max: z.number() }).strict();
export const TemplateDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1).max(60),
    version: z.number().int().positive(),
    versionId: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    category: TemplateCategorySchema,
    layout: TemplateLayoutSchema,
    supportedLocales: z.array(ResumeLocaleSchema).min(1),
    supportedSections: z.array(ResumeSectionTypeSchema).min(1),
    sidebarSections: z.array(ResumeSectionTypeSchema),
    defaultTheme: ResumeThemeSchema,
    themeConstraints: z
      .object({
        fontSize: themeRange,
        lineHeight: themeRange,
        sectionGap: themeRange,
        paragraphGap: themeRange,
        pageMargin: themeRange,
        fonts: z.array(ResumeThemeSchema.shape.fontFamily).min(1),
      })
      .strict(),
    pagination: z
      .object({
        recommendedPages: z.number().int().min(1).max(4),
        maximumPages: z.number().int().min(1).max(8),
        avoidEntryBreak: z.boolean(),
      })
      .strict(),
    font: z
      .object({
        family: z.literal('Noto Sans SC'),
        asset: z.literal('NotoSansSC-Variable.ttf'),
        license: z.literal('SIL Open Font License 1.1'),
      })
      .strict(),
    visualStyle: z.enum([
      'classic',
      'modern',
      'technical',
      'campus',
      'academic',
      'slate',
      'coral',
      'compact',
    ]),
  })
  .strict();
export const ResumeDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    resumeId: z.string().uuid(),
    templateVersionId: z.string().trim().min(1).max(100),
    locale: ResumeLocaleSchema,
    sections: z.array(ResumeSectionSchema).min(1).max(30),
    theme: ResumeThemeSchema,
  })
  .strict()
  .superRefine((document, context) => {
    if (new Set(document.sections.map((section) => section.id)).size !== document.sections.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections'],
        message: '模块 ID 不能重复',
      });
    const orders = document.sections.map((section) => section.sortOrder).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections'],
        message: '模块排序必须连续且唯一',
      });
  });
export type ResumeLocale = z.infer<typeof ResumeLocaleSchema>;
export type ResumeSectionType = z.infer<typeof ResumeSectionTypeSchema>;
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
export type ResumeTheme = z.infer<typeof ResumeThemeSchema>;
export type TemplateLayout = z.infer<typeof TemplateLayoutSchema>;
export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;
export type ResumeDocument = z.infer<typeof ResumeDocumentSchema>;
export const DEFAULT_RESUME_THEME: ResumeTheme = {
  fontFamily: 'Noto Sans SC',
  fontSize: 11,
  lineHeight: 1.55,
  sectionGap: 14,
  paragraphGap: 6,
  pageMargin: { top: 16, right: 16, bottom: 16, left: 16 },
  accentColor: '#1846b8',
};
export const EMPTY_RICH_TEXT: RichTextDocument = { type: 'doc', content: [{ type: 'paragraph' }] };
export function textToRichText(value: string | null | undefined): RichTextDocument {
  if (!value?.trim()) return structuredClone(EMPTY_RICH_TEXT);
  const content: RichTextNode[] = value
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const text = line.trim();
      return text
        ? { type: 'paragraph', content: [{ type: 'text', text }] }
        : { type: 'paragraph' };
    });
  return { type: 'doc', content };
}
