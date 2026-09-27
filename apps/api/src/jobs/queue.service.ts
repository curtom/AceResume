import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { type ApiEnvironment } from '@aceresume/config';
import {
  type AiGenerateJob,
  type DocumentParseJob,
  type DocumentEmbedJob,
  type EmailJob,
  type PdfExportJob,
  type StorageCleanupJob,
} from '@aceresume/contracts';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  private readonly emailQueue: Queue<EmailJob>;
  private readonly pdfQueue: Queue<PdfExportJob>;
  private readonly documentQueue: Queue<DocumentParseJob>;
  private readonly embedQueue: Queue<DocumentEmbedJob>;
  private readonly aiQueue: Queue<AiGenerateJob>;
  private readonly cleanupQueue: Queue<StorageCleanupJob>;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.queue = new Queue('system', { connection: { url: environment.REDIS_URL } });
    this.emailQueue = new Queue<EmailJob>('email.send', {
      connection: { url: environment.REDIS_URL },
    });
    this.pdfQueue = new Queue<PdfExportJob>('pdf.export', {
      connection: { url: environment.REDIS_URL },
    });
    this.documentQueue = new Queue<DocumentParseJob>('document.parse', {
      connection: { url: environment.REDIS_URL },
    });
    this.embedQueue = new Queue<DocumentEmbedJob>('document.embed', {
      connection: { url: environment.REDIS_URL },
    });
    this.aiQueue = new Queue<AiGenerateJob>('ai.generate', {
      connection: { url: environment.REDIS_URL },
    });
    this.cleanupQueue = new Queue<StorageCleanupJob>('storage.cleanup', {
      connection: { url: environment.REDIS_URL },
    });
  }

  async sendEmail(message: EmailJob, jobId: string): Promise<void> {
    await this.emailQueue.add('send', message, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  async exportPdf(exportJobId: string): Promise<void> {
    await this.pdfQueue.add(
      'render',
      { exportJobId },
      {
        jobId: exportJobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async parseDocument(documentId: string, jobId = documentId): Promise<void> {
    await this.documentQueue.add(
      'parse',
      { documentId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async cleanupDocument(documentId: string): Promise<void> {
    await this.cleanupQueue.add(
      'cleanup',
      { documentId },
      {
        jobId: documentId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async embedDocument(documentId: string, jobId = documentId): Promise<void> {
    await this.embedQueue.add(
      'embed',
      { documentId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async generateAi(taskId: string): Promise<void> {
    await this.aiQueue.add(
      'generate',
      { taskId },
      {
        jobId: taskId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await Promise.all([
      this.emailQueue.close(),
      this.pdfQueue.close(),
      this.documentQueue.close(),
      this.embedQueue.close(),
      this.aiQueue.close(),
      this.cleanupQueue.close(),
    ]);
  }
}
