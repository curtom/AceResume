import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AiResumePatch,
  CreateResumeRequest,
  ImportCandidate,
  ResumeDetail,
  ResumePage,
  ResumeStatus,
  ResumeSummary,
  SaveResumeRequest,
  UpdateResumeRequest,
} from '@aceresume/contracts';
import {
  ResumeDocumentSchema,
  ResumeSectionSchema,
  textToRichText,
  type RichTextDocument,
  type RichTextNode,
  type ResumeDocument,
  type ResumeSection,
} from '@aceresume/resume-schema';
import { ObjectStorageAdapter } from '../adapters/object-storage.adapter.js';
import { AppException } from '../common/app.exception.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { TemplatesService } from '../templates/templates.service.js';
import { ResumeLimitError, ResumesRepository } from './resumes.repository.js';

function richTextNodeToPlain(node: RichTextNode): string {
  if (node.type === 'text') return node.text;
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? [])
    .map(richTextNodeToPlain)
    .join(node.type === 'bulletList' || node.type === 'orderedList' ? '\n' : '');
}

function richTextToPlain(document: RichTextDocument): string {
  return document.content.map(richTextNodeToPlain).join('\n').trim();
}

const TITLES = {
  basic: '基本信息',
  target: '求职意向',
  education: '教育经历',
  experience: '实习 / 工作经历',
  project: '项目经历',
  campus: '校园经历',
  skill: '专业技能',
  award: '奖项证书',
  summary: '自我评价',
} as const;

@Injectable()
export class ResumesService {
  constructor(
    @Inject(ResumesRepository) private readonly repository: ResumesRepository,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(TemplatesService) private readonly templates: TemplatesService,
    @Inject(ObjectStorageAdapter) private readonly storage: ObjectStorageAdapter,
  ) {}

  async list(
    userId: string,
    status: ResumeStatus,
    page: number,
    pageSize: number,
  ): Promise<ResumePage> {
    const result = await this.repository.list(userId, status, page, pageSize);
    return {
      items: result.items.map((resume) => this.mapSummary(resume)),
      page,
      pageSize,
      total: result.total,
    };
  }

  async get(userId: string, id: string): Promise<ResumeDetail> {
    const result = await this.repository.find(userId, id);
    if (!result) throw this.notFound();
    const template = await this.templates.getDefinition(result.resume.templateVersionId);
    if (!template)
      throw new AppException(
        'TEMPLATE_NOT_FOUND',
        HttpStatus.CONFLICT,
        '该简历引用的模板版本不存在。',
      );
    const document = ResumeDocumentSchema.parse({
      schemaVersion: 1,
      resumeId: result.resume.id,
      templateVersionId: result.resume.templateVersionId,
      locale: result.resume.locale,
      theme: result.resume.theme,
      sections: result.sections.map((section) => ({
        id: section.id,
        type: section.type,
        title:
          section.type === 'skill' && section.title === '技能清单' ? TITLES.skill : section.title,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        schemaVersion: 1,
        content: section.content,
        ...(section.styleOverride ? { styleOverride: section.styleOverride } : {}),
      })),
    });
    const avatarObjectKey = this.avatarObjectKey(document);
    const avatarUrl = avatarObjectKey
      ? await this.storage.createSignedUrl(avatarObjectKey, 60 * 60)
      : null;
    return { ...this.mapSummary(result.resume), document, template, avatarUrl };
  }

  async create(userId: string, input: CreateResumeRequest): Promise<ResumeDetail> {
    if (input.mode === 'import')
      throw new AppException(
        'FEATURE_NOT_AVAILABLE',
        HttpStatus.NOT_IMPLEMENTED,
        '旧简历导入将在阶段五开放。',
      );
    const resumeId = randomUUID();
    const definition = await this.templates.getPublishedDefinition(input.templateVersionId);
    if (!definition)
      throw new AppException(
        'TEMPLATE_NOT_FOUND',
        HttpStatus.BAD_REQUEST,
        '所选模板不存在或已不可用。',
      );
    const snapshot =
      input.mode === 'profile'
        ? await this.profiles.createSnapshot(userId, input.profileEntryIds)
        : null;
    const document = this.createDocument(
      resumeId,
      input.locale,
      input.targetRole,
      input.templateVersionId,
      definition.defaultTheme,
      snapshot,
    );
    try {
      await this.repository.create({
        id: resumeId,
        userId,
        name: input.name,
        targetRole: input.targetRole,
        locale: input.locale,
        templateVersionId: input.templateVersionId,
        theme: document.theme,
        source: input.mode,
        document,
      });
    } catch (error: unknown) {
      if (error instanceof ResumeLimitError)
        throw new AppException(
          'RESUME_LIMIT_REACHED',
          HttpStatus.CONFLICT,
          '每个用户最多创建 6 份简历，请先删除不再需要的简历。',
        );
      throw error;
    }
    return this.get(userId, resumeId);
  }

  async applyImport(
    userId: string,
    candidates: ImportCandidate[],
    target: {
      resumeId: string | null;
      resumeVersion: number | null;
      newResume: {
        name: string;
        targetRole: string | null;
        locale: 'zh-CN' | 'en-US';
        templateVersionId: string;
      } | null;
    },
  ): Promise<string> {
    if (target.resumeId) {
      if (!target.resumeVersion)
        throw new AppException(
          'VALIDATION_FAILED',
          HttpStatus.BAD_REQUEST,
          '导入到现有简历时必须提供当前版本。',
        );
      const current = await this.get(userId, target.resumeId);
      if (current.version !== target.resumeVersion) throw this.conflict();
      const document = this.mergeImport(current.document, candidates);
      const saved = await this.save(userId, current.id, {
        baseVersion: current.version,
        idempotencyKey: randomUUID(),
        document,
      });
      return saved.id;
    }
    if (!target.newResume)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '请选择现有简历或填写新简历信息。',
      );
    const definition = await this.templates.getPublishedDefinition(
      target.newResume.templateVersionId,
    );
    if (!definition)
      throw new AppException(
        'TEMPLATE_NOT_FOUND',
        HttpStatus.BAD_REQUEST,
        '所选模板不存在或已不可用。',
      );
    const resumeId = randomUUID();
    const blank = this.createDocument(
      resumeId,
      target.newResume.locale,
      target.newResume.targetRole,
      target.newResume.templateVersionId,
      definition.defaultTheme,
      null,
    );
    const document = this.mergeImport(blank, candidates);
    try {
      await this.repository.create({
        id: resumeId,
        userId,
        name: target.newResume.name,
        targetRole:
          document.sections.find((section) => section.type === 'target')?.content.role ?? null,
        locale: target.newResume.locale,
        templateVersionId: target.newResume.templateVersionId,
        theme: document.theme,
        source: 'import',
        document,
      });
    } catch (error: unknown) {
      if (error instanceof ResumeLimitError)
        throw new AppException(
          'RESUME_LIMIT_REACHED',
          HttpStatus.CONFLICT,
          '每个用户最多创建 6 份简历，请先删除不再需要的简历。',
        );
      throw error;
    }
    return resumeId;
  }

  async applyAiSuggestion(
    userId: string,
    resumeId: string,
    baseVersion: number,
    patch: AiResumePatch,
    text: string,
  ): Promise<ResumeDetail> {
    const current = await this.get(userId, resumeId);
    if (current.version !== baseVersion) throw this.conflict();
    const document = structuredClone(current.document);
    const section = document.sections.find((item) => item.id === patch.sectionId);
    if (!section)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'AI 建议对应的简历模块不存在。',
      );
    if (patch.field === 'body' && (section.type === 'summary' || section.type === 'custom')) {
      const before = richTextToPlain(section.content.body);
      section.content.body = textToRichText(
        patch.operation === 'append' && before ? before + '\n' + text : text,
      );
    } else if (patch.field === 'description' && 'entries' in section.content) {
      const entry = section.content.entries.find((item) => item.id === patch.entryId);
      if (!entry || !('description' in entry))
        throw new AppException(
          'VALIDATION_FAILED',
          HttpStatus.BAD_REQUEST,
          'AI 建议对应的经历条目不存在。',
        );
      const before = richTextToPlain(entry.description);
      entry.description = textToRichText(
        patch.operation === 'append' && before ? before + '\n' + text : text,
      );
    } else {
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        'AI 建议与目标模块不匹配。',
      );
    }
    return this.save(userId, resumeId, {
      baseVersion,
      idempotencyKey: randomUUID(),
      document: ResumeDocumentSchema.parse(document),
    });
  }

  private mergeImport(document: ResumeDocument, candidates: ImportCandidate[]): ResumeDocument {
    const next = structuredClone(document);
    const value = (field: ImportCandidate['field'], section?: ImportCandidate['section']) =>
      candidates.find((item) => item.field === field && (!section || item.section === section))
        ?.value ?? null;
    const validMonth = (field: 'startDate' | 'endDate', section: ImportCandidate['section']) => {
      const month = value(field, section);
      return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
    };
    const basic = next.sections.find((section) => section.type === 'basic');
    if (basic?.type === 'basic')
      basic.content = {
        ...basic.content,
        fullName: value('fullName') ?? basic.content.fullName,
        email: value('email') ?? basic.content.email,
        phone: value('phone') ?? basic.content.phone,
        location: value('location') ?? basic.content.location,
      };
    const target = next.sections.find((section) => section.type === 'target');
    if (target?.type === 'target') target.content.role = value('targetRole') ?? target.content.role;
    const summary = next.sections.find((section) => section.type === 'summary');
    if (summary?.type === 'summary' && value('summary'))
      summary.content.body = textToRichText(value('summary'));

    const education = next.sections.find((section) => section.type === 'education');
    const educationStart = validMonth('startDate', 'education');
    if (education?.type === 'education' && value('school') && educationStart)
      education.content.entries.push({
        id: randomUUID(),
        sortOrder: education.content.entries.length,
        school: value('school') ?? '',
        major: value('major') ?? '',
        degree: value('degree') ?? '',
        startDate: educationStart,
        endDate: validMonth('endDate', 'education'),
        isCurrent: !validMonth('endDate', 'education'),
        grade: null,
        ranking: null,
        description: textToRichText(value('description', 'education')),
      });
    const experience = next.sections.find((section) => section.type === 'experience');
    const experienceStart = validMonth('startDate', 'experience');
    if (
      experience?.type === 'experience' &&
      value('organization') &&
      value('position') &&
      experienceStart
    )
      experience.content.entries.push({
        id: randomUUID(),
        sortOrder: experience.content.entries.length,
        organization: value('organization') ?? '',
        position: value('position') ?? '',
        location: null,
        startDate: experienceStart,
        endDate: validMonth('endDate', 'experience'),
        isCurrent: !validMonth('endDate', 'experience'),
        description: textToRichText(value('description', 'experience')),
      });
    const project = next.sections.find((section) => section.type === 'project');
    const projectStart = validMonth('startDate', 'project');
    if (project?.type === 'project' && value('projectName') && projectStart)
      project.content.entries.push({
        id: randomUUID(),
        sortOrder: project.content.entries.length,
        name: value('projectName') ?? '',
        role: value('projectRole'),
        technologies: (value('technologies') ?? '')
          .split(/[,，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
        url: null,
        startDate: projectStart,
        endDate: validMonth('endDate', 'project'),
        isCurrent: !validMonth('endDate', 'project'),
        description: textToRichText(value('description', 'project')),
      });
    const skills = next.sections.find((section) => section.type === 'skill');
    if (skills?.type === 'skill')
      for (const item of candidates.filter((candidate) => candidate.field === 'skill'))
        skills.content.entries.push({
          id: randomUUID(),
          sortOrder: skills.content.entries.length,
          category: '专业技能',
          name: item.value,
          proficiency: null,
          description: textToRichText(null),
        });

    const used = new Set([
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
    ]);
    const remaining = candidates
      .filter((item) => !used.has(item.field))
      .map((item) => `${item.label}：${item.value}`);
    if (remaining.length) {
      next.sections.push({
        id: randomUUID(),
        type: 'custom',
        title: '待整理导入内容',
        sortOrder: next.sections.length,
        isVisible: true,
        schemaVersion: 1,
        content: { body: textToRichText(remaining.join('\n')) },
      });
    }
    return ResumeDocumentSchema.parse(next);
  }

  async update(userId: string, id: string, input: UpdateResumeRequest): Promise<ResumeDetail> {
    await this.assertVersion(userId, id, input.baseVersion);
    if (
      !(await this.repository.updateMetadata(userId, id, input.baseVersion, {
        name: input.name,
        targetRole: input.targetRole,
      }))
    )
      throw this.conflict();
    return this.get(userId, id);
  }

  async duplicate(userId: string, id: string, name?: string): Promise<ResumeDetail> {
    const original = await this.get(userId, id);
    const resumeId = randomUUID();
    let document: ResumeDocument = {
      ...structuredClone(original.document),
      resumeId,
      sections: original.document.sections.map((section) => this.renewSectionIds(section)),
    };
    let duplicatedAvatarKey: string | null = null;
    const originalAvatarKey = this.avatarObjectKey(document);
    if (originalAvatarKey) {
      const extension =
        originalAvatarKey.split('.').pop() === 'jpg' ? 'jpg' : originalAvatarKey.split('.').pop();
      if (extension && ['jpg', 'png', 'webp'].includes(extension)) {
        duplicatedAvatarKey = `avatars/${userId}/${resumeId}/${randomUUID()}.${extension}`;
        const chunks: Buffer[] = [];
        for await (const chunk of await this.storage.getObject(originalAvatarKey))
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        await this.storage.putObject(
          duplicatedAvatarKey,
          Buffer.concat(chunks),
          extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
        );
        document = this.withAvatarObjectKey(document, duplicatedAvatarKey);
      }
    }
    try {
      await this.repository.create({
        id: resumeId,
        userId,
        name: name ?? `${original.name.slice(0, 110)} 副本`,
        targetRole: original.targetRole,
        locale: original.locale,
        templateVersionId: original.templateVersionId,
        theme: original.document.theme,
        source: original.source,
        document,
      });
    } catch (error: unknown) {
      if (duplicatedAvatarKey)
        await this.storage.deleteObject(duplicatedAvatarKey).catch(() => undefined);
      if (error instanceof ResumeLimitError)
        throw new AppException(
          'RESUME_LIMIT_REACHED',
          HttpStatus.CONFLICT,
          '每个用户最多创建 6 份简历，请先删除不再需要的简历。',
        );
      throw error;
    }
    return this.get(userId, resumeId);
  }

  async setStatus(
    userId: string,
    id: string,
    baseVersion: number,
    status: ResumeStatus,
  ): Promise<ResumeDetail> {
    await this.assertVersion(userId, id, baseVersion);
    if (!(await this.repository.setStatus(userId, id, baseVersion, status))) throw this.conflict();
    return this.get(userId, id);
  }

  async save(userId: string, id: string, input: SaveResumeRequest): Promise<ResumeDetail> {
    if (input.document.resumeId !== id)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '简历文档 ID 与路径不一致。',
      );
    const current = await this.get(userId, id);
    if (this.avatarObjectKey(input.document) !== this.avatarObjectKey(current.document))
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '头像只能通过头像上传或移除操作更新。',
      );
    const template =
      current.document.templateVersionId === input.document.templateVersionId
        ? await this.templates.getDefinition(input.document.templateVersionId)
        : await this.templates.getPublishedDefinition(input.document.templateVersionId);
    if (!template)
      throw new AppException(
        'TEMPLATE_NOT_FOUND',
        HttpStatus.BAD_REQUEST,
        '所选模板不存在或已不可用。',
      );
    const result = await this.repository.saveDocument(
      userId,
      id,
      input.baseVersion,
      input.idempotencyKey,
      input.document,
    );
    if (result.result === 'not-found') throw this.notFound();
    if (result.result === 'conflict') throw this.conflict();
    return this.get(userId, id);
  }

  async uploadAvatar(
    userId: string,
    id: string,
    baseVersion: number,
    file: { size: number; buffer: Buffer } | undefined,
  ): Promise<ResumeDetail> {
    if (!file?.size)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, '请选择头像图片。');
    if (file.size > 2 * 1024 * 1024)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.PAYLOAD_TOO_LARGE,
        '头像不能超过 2 MB。',
      );
    const extension = this.avatarExtension(file.buffer);
    if (!extension)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '头像仅支持 JPG、PNG 或 WebP 图片。',
      );
    const current = await this.get(userId, id);
    if (current.version !== baseVersion) throw this.conflict();
    const previousKey = this.avatarObjectKey(current.document);
    const objectKey = `avatars/${userId}/${id}/${randomUUID()}.${extension}`;
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    await this.storage.putObject(objectKey, file.buffer, mimeType);
    try {
      const document = this.withAvatarObjectKey(current.document, objectKey);
      const result = await this.repository.saveDocument(
        userId,
        id,
        baseVersion,
        randomUUID(),
        document,
      );
      if (result.result === 'not-found') throw this.notFound();
      if (result.result === 'conflict') throw this.conflict();
    } catch (error: unknown) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
    if (previousKey) await this.storage.deleteObject(previousKey).catch(() => undefined);
    return this.get(userId, id);
  }

  async removeAvatar(userId: string, id: string, baseVersion: number): Promise<ResumeDetail> {
    const current = await this.get(userId, id);
    if (current.version !== baseVersion) throw this.conflict();
    const previousKey = this.avatarObjectKey(current.document);
    if (!previousKey) return current;
    const result = await this.repository.saveDocument(
      userId,
      id,
      baseVersion,
      randomUUID(),
      this.withAvatarObjectKey(current.document, null),
    );
    if (result.result === 'not-found') throw this.notFound();
    if (result.result === 'conflict') throw this.conflict();
    await this.storage.deleteObject(previousKey).catch(() => undefined);
    return this.get(userId, id);
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const current = await this.get(userId, id);
    if (!(await this.repository.softDelete(userId, id))) throw this.notFound();
    const avatarObjectKey = this.avatarObjectKey(current.document);
    if (avatarObjectKey) await this.storage.deleteObject(avatarObjectKey).catch(() => undefined);
    return { message: '简历已删除。' };
  }

  private createDocument(
    resumeId: string,
    locale: 'zh-CN' | 'en-US',
    targetRole: string | null,
    templateVersionId: string,
    theme: ResumeDocument['theme'],
    snapshot: Awaited<ReturnType<ProfilesService['createSnapshot']>> | null,
  ): ResumeDocument {
    const profile = snapshot?.profile;
    const entries = snapshot?.entries ?? [];
    const sections: ResumeSection[] = [
      {
        id: randomUUID(),
        type: 'basic',
        title: TITLES.basic,
        sortOrder: 0,
        isVisible: true,
        schemaVersion: 1,
        content: {
          fullName: profile?.fullName ?? null,
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          location: profile?.location ?? null,
          website: profile?.website ?? null,
          avatarObjectKey: null,
        },
      },
      {
        id: randomUUID(),
        type: 'target',
        title: TITLES.target,
        sortOrder: 1,
        isVisible: true,
        schemaVersion: 1,
        content: { role: targetRole ?? profile?.targetRole ?? null },
      },
      {
        id: randomUUID(),
        type: 'education',
        title: TITLES.education,
        sortOrder: 2,
        isVisible: true,
        schemaVersion: 1,
        content: {
          entries: entries
            .filter((entry) => entry.type === 'education')
            .map((entry, sortOrder) => ({
              id: randomUUID(),
              sortOrder,
              school: entry.content.school,
              major: entry.content.major,
              degree: entry.content.degree,
              startDate: entry.content.startDate,
              endDate: entry.content.endDate,
              isCurrent: entry.content.isCurrent,
              grade: entry.content.grade,
              ranking: entry.content.ranking,
              description: textToRichText(entry.content.description),
            })),
        },
      },
      {
        id: randomUUID(),
        type: 'experience',
        title: TITLES.experience,
        sortOrder: 3,
        isVisible: true,
        schemaVersion: 1,
        content: {
          entries: entries
            .filter((entry) => entry.type === 'experience')
            .map((entry, sortOrder) => ({
              id: randomUUID(),
              sortOrder,
              organization: entry.content.organization,
              position: entry.content.position,
              location: null,
              startDate: entry.content.startDate,
              endDate: entry.content.endDate,
              isCurrent: entry.content.isCurrent,
              description: textToRichText(
                [...entry.content.responsibilities, ...entry.content.outcomes].join('\n'),
              ),
            })),
        },
      },
      {
        id: randomUUID(),
        type: 'project',
        title: TITLES.project,
        sortOrder: 4,
        isVisible: true,
        schemaVersion: 1,
        content: {
          entries: entries
            .filter((entry) => entry.type === 'project')
            .map((entry, sortOrder) => ({
              id: randomUUID(),
              sortOrder,
              name: entry.content.name,
              role: entry.content.role,
              technologies: entry.content.technologies,
              url: entry.content.url,
              startDate: entry.content.startDate,
              endDate: entry.content.endDate,
              isCurrent: entry.content.isCurrent,
              description: textToRichText(
                [
                  entry.content.background,
                  ...entry.content.responsibilities,
                  ...entry.content.outcomes,
                ]
                  .filter(Boolean)
                  .join('\n'),
              ),
            })),
        },
      },
      {
        id: randomUUID(),
        type: 'campus',
        title: TITLES.campus,
        sortOrder: 5,
        isVisible: true,
        schemaVersion: 1,
        content: { entries: [] },
      },
      {
        id: randomUUID(),
        type: 'skill',
        title: TITLES.skill,
        sortOrder: 6,
        isVisible: true,
        schemaVersion: 1,
        content: {
          entries: entries
            .filter((entry) => entry.type === 'skill')
            .map((entry, sortOrder) => ({
              id: randomUUID(),
              sortOrder,
              category: entry.content.category,
              name: entry.content.name,
              proficiency: entry.content.proficiency,
              description: textToRichText(entry.content.description),
            })),
        },
      },
      {
        id: randomUUID(),
        type: 'award',
        title: TITLES.award,
        sortOrder: 7,
        isVisible: true,
        schemaVersion: 1,
        content: { entries: [] },
      },
      {
        id: randomUUID(),
        type: 'summary',
        title: TITLES.summary,
        sortOrder: 8,
        isVisible: true,
        schemaVersion: 1,
        content: { body: textToRichText(profile?.summary) },
      },
    ];
    return ResumeDocumentSchema.parse({
      schemaVersion: 1,
      resumeId,
      templateVersionId,
      locale,
      sections,
      theme,
    });
  }

  private avatarObjectKey(document: ResumeDocument): string | null {
    const basic = document.sections.find((section) => section.type === 'basic');
    return basic?.type === 'basic' ? (basic.content.avatarObjectKey ?? null) : null;
  }

  private withAvatarObjectKey(document: ResumeDocument, avatarObjectKey: string | null) {
    const next = structuredClone(document);
    const basic = next.sections.find((section) => section.type === 'basic');
    if (basic?.type === 'basic') basic.content.avatarObjectKey = avatarObjectKey;
    return ResumeDocumentSchema.parse(next);
  }

  private avatarExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return 'png';
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
      return 'webp';
    return null;
  }

  private renewSectionIds(section: ResumeSection): ResumeSection {
    return ResumeSectionSchema.parse({
      ...structuredClone(section),
      id: randomUUID(),
      ...('entries' in section.content
        ? {
            content: {
              entries: section.content.entries.map((entry, sortOrder) => ({
                ...entry,
                id: randomUUID(),
                sortOrder,
              })),
            },
          }
        : {}),
    });
  }
  private async assertVersion(userId: string, id: string, baseVersion: number): Promise<void> {
    const current = await this.repository.find(userId, id);
    if (!current) throw this.notFound();
    if (current.resume.version !== baseVersion) throw this.conflict();
  }
  private mapSummary(
    resume: NonNullable<Awaited<ReturnType<ResumesRepository['find']>>>['resume'],
  ): ResumeSummary {
    return {
      id: resume.id,
      name: resume.name,
      targetRole: resume.targetRole,
      locale: resume.locale === 'en-US' ? 'en-US' : 'zh-CN',
      templateVersionId: resume.templateVersionId,
      status: resume.status,
      source: resume.source,
      thumbnailStatus: 'placeholder',
      version: resume.version,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
    };
  }
  private notFound(): AppException {
    return new AppException('RESUME_NOT_FOUND', HttpStatus.NOT_FOUND, '简历不存在。');
  }
  private conflict(): AppException {
    return new AppException(
      'RESUME_VERSION_CONFLICT',
      HttpStatus.CONFLICT,
      '简历已在其他位置更新，请选择保留本地草稿或使用服务端内容。',
    );
  }
}
