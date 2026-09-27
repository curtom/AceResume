import { HttpStatus, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import type { ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { AppException } from '../common/app.exception.js';

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.redis = new Redis(environment.REDIS_URL, { maxRetriesPerRequest: 1 });
  }

  async consume(
    scope: string,
    identity: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const key = `rate:${scope}:${identity}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSeconds);
      if (count > limit) {
        process.stderr.write(
          JSON.stringify({
            level: 'warn',
            event: 'rate_limit.exceeded',
            scope,
            identityHash: createHash('sha256').update(identity).digest('hex').slice(0, 12),
            count,
            limit,
          }) + '\n',
        );
        throw new AppException(
          'RATE_LIMITED',
          HttpStatus.TOO_MANY_REQUESTS,
          '请求过于频繁，请稍后再试。',
        );
      }
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw new AppException(
        'DEPENDENCY_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        '认证服务暂时不可用。',
      );
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
