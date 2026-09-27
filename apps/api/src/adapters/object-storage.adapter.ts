import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { Client } from 'minio';
import type { ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';

@Injectable()
export class ObjectStorageAdapter {
  private readonly client: Client;
  constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {
    this.client = new Client({
      endPoint: environment.STORAGE_ENDPOINT,
      port: environment.STORAGE_PORT,
      useSSL: false,
      accessKey: environment.STORAGE_ACCESS_KEY,
      secretKey: environment.STORAGE_SECRET_KEY,
    });
  }
  private async ensureBucket(): Promise<void> {
    if (!(await this.client.bucketExists(this.environment.STORAGE_BUCKET)))
      await this.client.makeBucket(this.environment.STORAGE_BUCKET);
  }
  async putObject(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.putObject(this.environment.STORAGE_BUCKET, key, body, body.length, {
      'Content-Type': mimeType,
    });
  }
  async getObject(key: string): Promise<Readable> {
    return this.client.getObject(this.environment.STORAGE_BUCKET, key);
  }
  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.environment.STORAGE_BUCKET, key);
  }
  async createSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.environment.STORAGE_BUCKET, key, expiresInSeconds);
  }
  async isAvailable(): Promise<boolean> {
    return this.client.bucketExists(this.environment.STORAGE_BUCKET);
  }
}
