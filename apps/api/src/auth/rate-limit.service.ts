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
    const identityHash = createHash('sha256').update(identity).digest('hex');
    const key = `rate:${scope}:${identityHash}`;
    try {
      const result = (await this.redis.eval(
        `local count = redis.call('INCR', KEYS[1])
         local ttl = redis.call('TTL', KEYS[1])
         if ttl < 0 then
           redis.call('EXPIRE', KEYS[1], ARGV[1])
           ttl = tonumber(ARGV[1])
         end
         return { count, ttl }`,
        1,
        key,
        windowSeconds,
      )) as [number, number];
      const [count, ttl] = result;
      if (count > limit) {
        process.stderr.write(
          JSON.stringify({
            level: 'warn',
            event: 'rate_limit.exceeded',
            scope,
            identityHash: identityHash.slice(0, 12),
            count,
            limit,
            retryAfterSeconds: ttl,
          }) + '\n',
        );
        throw new AppException(
          'RATE_LIMITED',
          HttpStatus.TOO_MANY_REQUESTS,
          `尝试次数过多，请在 ${Math.max(ttl, 1)} 秒后重试。`,
          { retryAfterSeconds: Math.max(ttl, 1) },
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

  async reset(scope: string, identity: string): Promise<void> {
    const identityHash = createHash('sha256').update(identity).digest('hex');
    try {
      await this.redis.del(`rate:${scope}:${identityHash}`);
    } catch {
      process.stderr.write(
        JSON.stringify({
          level: 'warn',
          event: 'rate_limit.reset_failed',
          scope,
          identityHash: identityHash.slice(0, 12),
        }) + '\n',
      );
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
