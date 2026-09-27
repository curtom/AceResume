import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, StreamableFile } from '@nestjs/common';
import { Client } from 'minio';
import type { ApiEnvironment } from '@aceresume/config';
import type { CreateExportRequest, ExportJob } from '@aceresume/contracts';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { AppException } from '../common/app.exception.js';
import { QueueService } from '../jobs/queue.service.js';
import { ResumesService } from '../resumes/resumes.service.js';
import { ExportsRepository } from './exports.repository.js';

@Injectable()
export class ExportsService {
  private readonly storage: Client;

  constructor(
    @Inject(ExportsRepository) private readonly repository: ExportsRepository,
    @Inject(ResumesService) private readonly resumes: ResumesService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {
    this.storage = new Client({
      endPoint: environment.STORAGE_ENDPOINT,
      port: environment.STORAGE_PORT,
      useSSL: false,
      accessKey: environment.STORAGE_ACCESS_KEY,
      secretKey: environment.STORAGE_SECRET_KEY,
    });
  }

  async create(userId: string, resumeId: string, input: CreateExportRequest): Promise<ExportJob> {
    const resume = await this.resumes.get(userId, resumeId);
    if (resume.version !== input.resumeVersion)
      throw new AppException(
        'RESUME_VERSION_CONFLICT',
        HttpStatus.CONFLICT,
        '简历已更新，请等待自动保存完成后重新导出。',
      );
    const job = await this.repository.create({
      id: randomUUID(),
      userId,
      resumeId,
      resumeVersion: resume.version,
      templateVersionId: resume.templateVersionId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: resume.document,
      fileName: `${this.safeFileName(resume.name)}.pdf`,
    });
    if (!job) throw new Error('Export job could not be created.');
    if (job.status === 'queued') await this.queue.exportPdf(job.id);
    return this.map(job);
  }

  async get(userId: string, id: string): Promise<ExportJob> {
    const job = await this.repository.find(userId, id);
    if (!job) throw this.notFound();
    return this.map(job);
  }

  async download(userId: string, id: string): Promise<StreamableFile> {
    const job = await this.repository.find(userId, id);
    if (!job) throw this.notFound();
    if (job.status !== 'completed' || !job.objectKey)
      throw new AppException(
        'EXPORT_NOT_READY',
        HttpStatus.CONFLICT,
        'PDF 尚未生成完成，请稍后重试。',
      );
    const stream = await this.storage.getObject(this.environment.STORAGE_BUCKET, job.objectKey);
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(job.fileName)}`,
    });
  }

  private map(job: NonNullable<Awaited<ReturnType<ExportsRepository['find']>>>): ExportJob {
    return {
      id: job.id,
      resumeId: job.resumeId,
      resumeVersion: job.resumeVersion,
      templateVersionId: job.templateVersionId,
      status: job.status,
      fileName: job.fileName,
      diagnostics: job.diagnostics,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private safeFileName(value: string): string {
    return (
      value
        .replace(/[<>:"/\\|?*]/g, '_')
        .split('')
        .filter((character) => character.charCodeAt(0) >= 32)
        .join('')
        .trim()
        .slice(0, 170) || '简历'
    );
  }

  private notFound(): AppException {
    return new AppException('EXPORT_NOT_FOUND', HttpStatus.NOT_FOUND, '导出任务不存在。');
  }
}
