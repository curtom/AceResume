import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HealthController } from '../src/health/health.controller.js';
import { HealthService } from '../src/health/health.service.js';

const expected = { application: 'ok', database: 'ok', redis: 'ok', storage: 'ok' };

@Module({
  controllers: [HealthController],
  providers: [{ provide: HealthService, useValue: { getStatus: async () => expected } }],
})
class HealthTestModule {}

async function main(): Promise<void> {
  const app = await NestFactory.create(HealthTestModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
    console.log('Health controller injection passes under the development tsx runtime.');
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
