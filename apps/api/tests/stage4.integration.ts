import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import type { ExportJob, ResumeDetail, TemplateList } from '@aceresume/contracts';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { RequestIdInterceptor } from '../src/common/request-id.interceptor.js';
import { DatabaseService } from '../src/infrastructure/database.service.js';
import { users } from '../src/infrastructure/schema.js';

type ApiEnvelope = { data?: unknown; code?: string };
const clientIp = `2001:db8:${randomUUID().slice(0, 4)}::4`;
async function api(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(baseUrl + '/api/v1' + path, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp, ...init.headers },
  });
  const body = (await response.json()) as ApiEnvelope;
  return { response, body };
}
function data<T>(body: ApiEnvelope): T {
  assert.ok('data' in body);
  return body.data as T;
}
function bearer(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

async function main(): Promise<void> {
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'false';
  const suffix = randomUUID();
  const emails = [`stage4-a-${suffix}@example.test`, `stage4-b-${suffix}@example.test`];
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.useGlobalInterceptors(new RequestIdInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const templates = data<TemplateList>((await api(baseUrl, '/templates')).body);
    assert.equal(templates.items.length, 8);

    const tokens: string[] = [];
    for (const email of emails) {
      await api(baseUrl, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'AceResume2026' }),
      });
      const login = await api(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'AceResume2026' }),
      });
      tokens.push(data<{ accessToken: string }>(login.body).accessToken);
    }
    const createdResponse = await api(baseUrl, '/resumes', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        mode: 'blank',
        name: '阶段四导出简历',
        targetRole: '前端工程师',
        locale: 'zh-CN',
        templateVersionId: 'tech-focus-v1',
      }),
    });
    assert.equal(createdResponse.response.status, 201);
    const resume = data<ResumeDetail>(createdResponse.body);
    assert.equal(resume.templateVersionId, 'tech-focus-v1');

    const switchedDocument = structuredClone(resume.document);
    switchedDocument.templateVersionId = 'slate-sidebar-v1';
    const savedResponse = await api(baseUrl, `/resumes/${resume.id}/document`, {
      method: 'PUT',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        baseVersion: resume.version,
        idempotencyKey: randomUUID(),
        document: switchedDocument,
      }),
    });
    assert.equal(savedResponse.response.status, 200);
    const saved = data<ResumeDetail>(savedResponse.body);
    assert.equal(saved.document.sections.length, resume.document.sections.length);
    assert.equal(saved.templateVersionId, 'slate-sidebar-v1');

    const idempotencyKey = randomUUID();
    const firstExport = await api(baseUrl, `/resumes/${resume.id}/exports`, {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({ resumeVersion: saved.version, idempotencyKey }),
    });
    assert.equal(firstExport.response.status, 202);
    const firstJob = data<ExportJob>(firstExport.body);
    const repeatedExport = await api(baseUrl, `/resumes/${resume.id}/exports`, {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({ resumeVersion: saved.version, idempotencyKey }),
    });
    assert.equal(data<ExportJob>(repeatedExport.body).id, firstJob.id);

    const otherUser = await api(baseUrl, `/exports/${firstJob.id}`, {
      headers: bearer(tokens[1]!),
    });
    assert.equal(otherUser.response.status, 404);
    assert.equal(otherUser.body.code, 'EXPORT_NOT_FOUND');
    process.stdout.write(
      'Stage 4 templates, lossless switching, export idempotency and ownership integration passed.\n',
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
