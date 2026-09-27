import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { HttpStatus, Inject, Injectable, StreamableFile } from '@nestjs/common';
import type { ApiEnvironment } from '@aceresume/config';
import {
  CreateProfileEntryRequestSchema,
  DocumentDetailSchema,
  DocumentPageSchema,
  type ConfirmDocumentImportRequest,
  type ConfirmDocumentImportResult,
  type DocumentDetail,
  type DocumentFileType,
  type DocumentPage,
  type DocumentPurpose,
  type ImportCandidate,
} from '@aceresume/contracts';
import { ObjectStorageAdapter } from '../adapters/object-storage.adapter.js';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { AppException } from '../common/app.exception.js';
import { QueueService } from '../jobs/queue.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { ResumesService } from '../resumes/resumes.service.js';
import { DocumentLimitError, DocumentsRepository } from './documents.repository.js';

export type UploadedDocument = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
const MIME: Record<DocumentFileType, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
};

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository) private readonly repository: DocumentsRepository,
    @Inject(ObjectStorageAdapter) private readonly storage: ObjectStorageAdapter,
    @Inject(QueueService) private readonly queues: QueueService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(ResumesService) private readonly resumes: ResumesService,
  ) {}

  async list(userId: string, page: number, pageSize: number): Promise<DocumentPage> {
    const result = await this.repository.list(userId, page, pageSize);
    return DocumentPageSchema.parse({
      items: result.items.map((item) => this.summary(item)),
      page,
      pageSize,
      total: result.total,
      usageBytes: result.usageBytes,
      limits: this.limits,
    });
  }

  async get(userId: string, id: string): Promise<DocumentDetail> {
    const result = await this.repository.find(userId, id);
    if (!result) throw this.notFound();
    return DocumentDetailSchema.parse({
      ...this.summary(result.document),
      chunks: result.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        paragraphStart: chunk.paragraphStart,
        paragraphEnd: chunk.paragraphEnd,
        sectionPath: chunk.sectionPath,
        chunkIndex: chunk.chunkIndex,
      })),
      import: result.import
        ? {
            id: result.import.id,
            status: result.import.status,
            candidates: result.import.candidates,
            confirmedAt: result.import.confirmedAt?.toISOString() ?? null,
          }
        : null,
    });
  }

  async upload(userId: string, file: UploadedDocument | undefined, purpose: DocumentPurpose) {
    if (!file || file.size === 0)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, '请选择非空文件。');
    if (file.size > this.environment.DOCUMENT_MAX_FILE_BYTES)
      throw new AppException(
        'DOCUMENT_TOO_LARGE',
        HttpStatus.PAYLOAD_TOO_LARGE,
        `单个文件不能超过 ${Math.floor(this.environment.DOCUMENT_MAX_FILE_BYTES / 1024 / 1024)} MB。`,
      );
    const decodedName = [...file.originalname].every((character) => character.charCodeAt(0) <= 255)
      ? Buffer.from(file.originalname, 'latin1').toString('utf8')
      : file.originalname;
    const fileName = basename(decodedName.replaceAll('\\', '/')).slice(0, 255);
    const fileType = this.validateFile(fileName, file.buffer);
    const id = randomUUID();
    const objectKey = `documents/${userId}/${id}/source.${fileType}`;
    await this.storage.putObject(objectKey, file.buffer, MIME[fileType]);
    try {
      const document = await this.repository.create({
        id,
        userId,
        fileName,
        fileType,
        purpose,
        mimeType: MIME[fileType],
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        objectKey,
        maxFiles: this.environment.DOCUMENT_MAX_FILES,
        maxTotalBytes: this.environment.DOCUMENT_MAX_TOTAL_BYTES,
      });
      await this.queues.parseDocument(id);
      return this.summary(document);
    } catch (error: unknown) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      if (error instanceof DocumentLimitError)
        throw new AppException(
          'DOCUMENT_LIMIT_REACHED',
          HttpStatus.CONFLICT,
          error.reason === 'count'
            ? `材料数量已达到 ${this.environment.DOCUMENT_MAX_FILES} 个上限。`
            : `材料总容量已达到 ${Math.floor(this.environment.DOCUMENT_MAX_TOTAL_BYTES / 1024 / 1024)} MB 上限。`,
        );
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    if (!(await this.repository.markDeleting(userId, id))) throw this.notFound();
    await this.queues.cleanupDocument(id);
    return { message: '材料已进入安全删除队列。' };
  }

  async reparse(userId: string, id: string) {
    const detail = await this.repository.find(userId, id);
    if (!detail) throw this.notFound();
    if (detail.document.purpose !== 'resume')
      throw new AppException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        '只有旧简历材料可以重新识别候选字段。',
      );
    if (detail.import?.status === 'confirmed')
      throw new AppException(
        'IMPORT_ALREADY_CONFIRMED',
        HttpStatus.CONFLICT,
        '该导入结果已经确认，不能重新识别。',
      );
    if (detail.document.status === 'queued' || detail.document.status === 'parsing')
      return this.summary(detail.document);
    const document = await this.repository.markQueuedForReparse(userId, id);
    if (!document) throw this.notFound();
    await this.queues.parseDocument(id, id + '-' + randomUUID());
    return this.summary(document);
  }

  async download(userId: string, id: string): Promise<StreamableFile> {
    const result = await this.repository.find(userId, id);
    if (!result) throw this.notFound();
    return new StreamableFile(await this.storage.getObject(result.document.objectKey), {
      type: result.document.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.document.fileName)}`,
    });
  }

  async confirmImport(
    userId: string,
    documentId: string,
    input: ConfirmDocumentImportRequest,
  ): Promise<ConfirmDocumentImportResult> {
    const detail = await this.repository.find(userId, documentId);
    if (!detail) throw this.notFound();
    if (detail.document.status !== 'ready' || !detail.import)
      throw new AppException('DOCUMENT_NOT_READY', HttpStatus.CONFLICT, '材料尚未完成解析。');
    if (detail.import.status === 'confirmed')
      throw new AppException(
        'IMPORT_ALREADY_CONFIRMED',
        HttpStatus.CONFLICT,
        '该导入结果已经确认。',
      );
    const selectedById = new Map(input.selected.map((item) => [item.id, item.value]));
    const candidates = detail.import.candidates
      .filter((candidate) => selectedById.has(candidate.id))
      .map((candidate) => ({
        ...candidate,
        value: selectedById.get(candidate.id) ?? candidate.value,
      }));
    if (candidates.length !== selectedById.size)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '包含不属于该材料的候选字段。',
      );
    let profileEntryCount = 0;
    if (input.destination !== 'resume')
      profileEntryCount = await this.applyToProfile(userId, candidates);
    const resumeId =
      input.destination === 'profile'
        ? null
        : await this.resumes.applyImport(userId, candidates, {
            resumeId: input.resumeId,
            resumeVersion: input.resumeVersion,
            newResume: input.newResume,
          });
    if (
      !(await this.repository.confirmImport(
        userId,
        detail.import.id,
        input.selected,
        input.destination,
        resumeId,
      ))
    )
      throw new AppException(
        'IMPORT_ALREADY_CONFIRMED',
        HttpStatus.CONFLICT,
        '该导入结果已经确认。',
      );
    return { profileEntryCount, resumeId };
  }

  private async applyToProfile(userId: string, candidates: ImportCandidate[]): Promise<number> {
    const value = (field: ImportCandidate['field'], section?: ImportCandidate['section']) =>
      candidates.find((item) => item.field === field && (!section || item.section === section))
        ?.value ?? null;
    const profile = await this.profiles.getProfile(userId);
    const basicFields = {
      fullName: value('fullName') ?? profile.fullName,
      targetRole: value('targetRole') ?? profile.targetRole,
      email: value('email') ?? profile.email,
      phone: value('phone') ?? profile.phone,
      location: value('location') ?? profile.location,
      website: profile.website,
      summary: value('summary') ?? profile.summary,
    };
    await this.profiles.updateProfile(userId, { ...basicFields, baseVersion: profile.version });
    const startDate = value('startDate');
    const endDate = value('endDate');
    const possible = [
      {
        type: 'education',
        content: {
          schemaVersion: 1,
          school: value('school'),
          major: value('major'),
          degree: value('degree'),
          startDate,
          endDate,
          isCurrent: !endDate,
          grade: null,
          ranking: null,
          description: value('description', 'education'),
        },
      },
      {
        type: 'experience',
        content: {
          schemaVersion: 1,
          organization: value('organization'),
          position: value('position'),
          startDate,
          endDate,
          isCurrent: !endDate,
          responsibilities: value('description', 'experience')
            ? [value('description', 'experience')]
            : [],
          outcomes: [],
          skills: [],
        },
      },
      {
        type: 'project',
        content: {
          schemaVersion: 1,
          name: value('projectName'),
          role: value('projectRole'),
          startDate,
          endDate,
          isCurrent: !endDate,
          background: value('description', 'project'),
          responsibilities: [],
          technologies: (value('technologies') ?? '')
            .split(/[,，、]/)
            .map((item) => item.trim())
            .filter(Boolean),
          outcomes: [],
          url: null,
        },
      },
      ...candidates
        .filter((item) => item.field === 'skill')
        .map((item) => ({
          type: 'skill',
          content: {
            schemaVersion: 1,
            category: '专业技能',
            name: item.value,
            proficiency: null,
            description: null,
          },
        })),
    ];
    let count = 0;
    for (const candidate of possible) {
      const parsed = CreateProfileEntryRequestSchema.safeParse(candidate);
      if (!parsed.success) continue;
      await this.profiles.createEntry(userId, parsed.data);
      count += 1;
    }
    return count;
  }

  private validateFile(fileName: string, buffer: Buffer): DocumentFileType {
    const extension = extname(fileName).toLowerCase();
    const type = extension === '.markdown' ? 'md' : extension.slice(1);
    if (!['docx', 'pdf', 'txt', 'md'].includes(type))
      throw new AppException(
        'DOCUMENT_TYPE_UNSUPPORTED',
        HttpStatus.BAD_REQUEST,
        '仅支持 DOCX、文本型 PDF、TXT 和 Markdown。',
      );
    if (type === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw new AppException(
        'DOCUMENT_TYPE_UNSUPPORTED',
        HttpStatus.BAD_REQUEST,
        '文件扩展名与实际 PDF 内容不匹配。',
      );
    if (type === 'docx' && buffer.subarray(0, 2).toString('ascii') !== 'PK')
      throw new AppException(
        'DOCUMENT_TYPE_UNSUPPORTED',
        HttpStatus.BAD_REQUEST,
        '文件扩展名与实际 DOCX 内容不匹配。',
      );
    if ((type === 'txt' || type === 'md') && buffer.includes(0))
      throw new AppException(
        'DOCUMENT_TYPE_UNSUPPORTED',
        HttpStatus.BAD_REQUEST,
        '文本文件包含二进制内容。',
      );
    if (type === 'txt' || type === 'md') {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        throw new AppException(
          'DOCUMENT_TYPE_UNSUPPORTED',
          HttpStatus.BAD_REQUEST,
          '文本文件必须使用 UTF-8 编码。',
        );
      }
    }
    return type as DocumentFileType;
  }

  private summary(document: {
    id: string;
    fileName: string;
    fileType: DocumentFileType;
    purpose: DocumentPurpose;
    mimeType: string;
    sizeBytes: number;
    status: string;
    chunkCount: number;
    pageCount: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      purpose: document.purpose,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      chunkCount: document.chunkCount,
      pageCount: document.pageCount,
      errorCode: document.errorCode,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
  private get limits() {
    return {
      maxFileBytes: this.environment.DOCUMENT_MAX_FILE_BYTES,
      maxFiles: this.environment.DOCUMENT_MAX_FILES,
      maxTotalBytes: this.environment.DOCUMENT_MAX_TOTAL_BYTES,
    };
  }
  private notFound() {
    return new AppException('DOCUMENT_NOT_FOUND', HttpStatus.NOT_FOUND, '材料不存在。');
  }
}
