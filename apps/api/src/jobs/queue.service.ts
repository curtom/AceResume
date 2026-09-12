import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { type ApiEnvironment } from '@aceresume/config';
import { type EmailJob } from '@aceresume/contracts';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  private readonly emailQueue: Queue<EmailJob>;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.queue = new Queue('system', { connection: { url: environment.REDIS_URL } });
    this.emailQueue = new Queue<EmailJob>('email.send', {
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

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.emailQueue.close();
  }
}
