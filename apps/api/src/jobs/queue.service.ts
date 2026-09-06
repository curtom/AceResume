import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { type ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.queue = new Queue('system', { connection: { url: environment.REDIS_URL } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
