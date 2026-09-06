import { Inject, Injectable } from '@nestjs/common';
import { type ApiEnvironment } from '@aceresume/config';
import { type HealthData } from '@aceresume/contracts';
import { Client } from 'minio';
import Redis from 'ioredis';
import postgres from 'postgres';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';

@Injectable()
export class HealthService {
  constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  async getStatus(): Promise<HealthData> {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);
    return { application: 'ok', database, redis, storage };
  }

  private async checkDatabase(): Promise<'ok' | 'unavailable'> {
    try {
      const client = postgres(this.environment.DATABASE_URL, { max: 1, connect_timeout: 1 });
      try {
        await client`select 1`;
        return 'ok';
      } finally {
        await client.end({ timeout: 1 });
      }
    } catch {
      return 'unavailable';
    }
  }

  private async checkRedis(): Promise<'ok' | 'unavailable'> {
    try {
      const client = new Redis(this.environment.REDIS_URL, {
        connectTimeout: 1_000,
        maxRetriesPerRequest: 0,
      });
      try {
        await client.ping();
        return 'ok';
      } finally {
        client.disconnect();
      }
    } catch {
      return 'unavailable';
    }
  }

  private async checkStorage(): Promise<'ok' | 'unavailable'> {
    try {
      const client = new Client({
        endPoint: this.environment.STORAGE_ENDPOINT,
        port: this.environment.STORAGE_PORT,
        useSSL: false,
        accessKey: this.environment.STORAGE_ACCESS_KEY,
        secretKey: this.environment.STORAGE_SECRET_KEY,
      });
      await client.bucketExists(this.environment.STORAGE_BUCKET);
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }
}
