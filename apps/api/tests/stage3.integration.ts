import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import type { ResumeDetail } from '@aceresume/contracts';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { RequestIdInterceptor } from '../src/common/request-id.interceptor.js';
import { DatabaseService } from '../src/infrastructure/database.service.js';
import { users } from '../src/infrastructure/schema.js';

type ApiEnvelope = { data?: unknown; code?: string };
const ipSeed = randomUUID().replaceAll('-', '');
const TEST_CLIENT_IP = `2001:db8:${ipSeed.slice(0, 4)}:${ipSeed.slice(4, 8)}::1`;
async function api(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: ApiEnvelope }> {
  const response = await fetch(baseUrl + '/api/v1' + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': TEST_CLIENT_IP,
      ...init.headers,
    },
  });
  return { response, body: (await response.json()) as ApiEnvelope };
}
function data<T>(body: ApiEnvelope): T {
  assert.ok('data' in body);
  return body.data as T;
}
function bearer(token: string): HeadersInit {
  return { authorization: 'Bearer ' + token };
}

async function main(): Promise<void> {
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'false';
  const suffix = randomUUID();
  const emails = ['stage3-a-' + suffix + '@example.test', 'stage3-b-' + suffix + '@example.test'];
  const password = 'AceResume2026';
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.useGlobalInterceptors(new RequestIdInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const tokens: string[] = [];
    for (const email of emails) {
      const registration = await api(baseUrl, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(registration.response.status, 201);
      const login = await api(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(login.response.status, 200);
      tokens.push(data<{ accessToken: string }>(login.body).accessToken);
    }
    const created = await api(baseUrl, '/resumes', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        mode: 'blank',
        name: '前端工程师简历',
        targetRole: '前端工程师',
        locale: 'zh-CN',
      }),
    });
    assert.equal(created.response.status, 201);
    const original = data<ResumeDetail>(created.body);
    assert.equal(original.document.sections.length, 9);

    const forbidden = await api(baseUrl, '/resumes/' + original.id, {
      headers: bearer(tokens[1]!),
    });
    assert.equal(forbidden.response.status, 404);
    assert.equal(forbidden.body.code, 'RESUME_NOT_FOUND');

    const changed = structuredClone(original.document);
    const basic = changed.sections.find((section) => section.type === 'basic');
    assert.ok(basic?.type === 'basic');
    basic.content.fullName = '阶段三测试用户';
    const idempotencyKey = randomUUID();
    const saved = await api(baseUrl, '/resumes/' + original.id + '/document', {
      method: 'PUT',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        baseVersion: original.version,
        idempotencyKey,
        document: changed,
      }),
    });
    assert.equal(saved.response.status, 200);
    const latest = data<ResumeDetail>(saved.body);
    assert.equal(latest.version, original.version + 1);

    const repeated = await api(baseUrl, '/resumes/' + original.id + '/document', {
      method: 'PUT',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        baseVersion: original.version,
        idempotencyKey,
        document: changed,
      }),
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(data<ResumeDetail>(repeated.body).version, latest.version);

    const conflict = await api(baseUrl, '/resumes/' + original.id + '/document', {
      method: 'PUT',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        baseVersion: original.version,
        idempotencyKey: randomUUID(),
        document: changed,
      }),
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.code, 'RESUME_VERSION_CONFLICT');

    const archived = await api(baseUrl, '/resumes/' + original.id + '/archive', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({ baseVersion: latest.version }),
    });
    assert.equal(archived.response.status, 200);
    assert.equal(data<ResumeDetail>(archived.body).status, 'archived');

    for (let index = 0; index < 5; index += 1) {
      const duplicate = await api(baseUrl, '/resumes/' + original.id + '/duplicate', {
        method: 'POST',
        headers: bearer(tokens[0]!),
        body: JSON.stringify({ name: '简历副本 ' + (index + 1) }),
      });
      assert.equal(duplicate.response.status, 201);
    }
    const overLimit = await api(baseUrl, '/resumes/' + original.id + '/duplicate', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({ name: '第七份简历' }),
    });
    assert.equal(overLimit.response.status, 409);
    assert.equal(overLimit.body.code, 'RESUME_LIMIT_REACHED');

    const removed = await api(baseUrl, '/resumes/' + original.id, {
      method: 'DELETE',
      headers: bearer(tokens[0]!),
    });
    assert.equal(removed.response.status, 200);
    const afterDelete = await api(baseUrl, '/resumes/' + original.id, {
      headers: bearer(tokens[0]!),
    });
    assert.equal(afterDelete.response.status, 404);
    process.stdout.write(
      'Stage 3 resume CRUD, ownership, latest-only save, idempotency, conflict and limit integration passed.\n',
    );
  } finally {
    const database = app.get(DatabaseService);
    await database.db.delete(users).where(inArray(users.email, emails));
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
