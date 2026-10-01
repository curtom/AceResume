import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import type { AiTask, ResumeDetail } from '@aceresume/contracts';
import { textToRichText } from '@aceresume/resume-schema';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { RequestIdInterceptor } from '../src/common/request-id.interceptor.js';
import { DatabaseService } from '../src/infrastructure/database.service.js';
import { aiTaskEvents, documentChunks, users } from '../src/infrastructure/schema.js';

type ApiEnvelope = { data?: unknown; code?: string; message?: string };
const TEST_CLIENT_IP = '2001:db8:' + randomUUID().slice(0, 4) + '::6';
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
async function waitDocument(baseUrl: string, token: string, id: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await api(baseUrl, '/documents/' + id, { headers: bearer(token) });
    const detail = data<{ status: string }>(result.body);
    if (detail.status === 'ready') return;
    if (detail.status === 'failed') throw new Error('Document parsing failed.');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Document parsing timed out.');
}
async function waitTask(baseUrl: string, token: string, id: string): Promise<AiTask> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await api(baseUrl, '/ai/tasks/' + id, { headers: bearer(token) });
    const task = data<AiTask>(result.body);
    if (task.status === 'awaiting_confirmation') return task;
    if (task.status === 'failed') throw new Error(task.errorMessage ?? 'AI task failed.');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('AI task timed out.');
}

async function main(): Promise<void> {
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'false';
  process.env.AI_PROVIDER = 'mock';
  const suffix = randomUUID();
  const emails = ['stage6-a-' + suffix + '@example.test', 'stage6-b-' + suffix + '@example.test'];
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
      assert.equal(
        (
          await api(baseUrl, '/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          })
        ).response.status,
        201,
      );
      const login = await api(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokens.push(data<{ accessToken: string }>(login.body).accessToken);
    }

    const created = await api(baseUrl, '/resumes', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        mode: 'blank',
        name: 'AI 安全测试简历',
        targetRole: '前端开发',
        locale: 'zh-CN',
      }),
    });
    const resume = data<ResumeDetail>(created.body);
    const changed = structuredClone(resume.document);
    const project = changed.sections.find((section) => section.type === 'project');
    assert.ok(project?.type === 'project');
    project.content.entries.push({
      id: randomUUID(),
      sortOrder: 0,
      name: '校园交易平台',
      role: '前端负责人',
      technologies: ['Vue 3', 'TypeScript'],
      url: null,
      startDate: '2025-03',
      endDate: '2025-08',
      isCurrent: false,
      description: textToRichText('负责交易页面开发。'),
    });
    const savedResponse = await api(baseUrl, '/resumes/' + resume.id + '/document', {
      method: 'PUT',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        baseVersion: resume.version,
        idempotencyKey: randomUUID(),
        document: changed,
      }),
    });
    const saved = data<ResumeDetail>(savedResponse.body);

    const form = new FormData();
    form.append(
      'file',
      new Blob(['项目事实\n基于 Vue 3 和 TypeScript 完成交易模块，拆分 8 个复用组件。'], {
        type: 'text/plain',
      }),
      '虚构项目事实.txt',
    );
    form.append('purpose', 'material');
    const uploadedResponse = await fetch(baseUrl + '/api/v1/documents', {
      method: 'POST',
      headers: { ...bearer(tokens[0]!), 'x-forwarded-for': TEST_CLIENT_IP },
      body: form,
    });
    assert.equal(uploadedResponse.status, 201);
    const uploaded = data<{ id: string }>((await uploadedResponse.json()) as ApiEnvelope);
    await waitDocument(baseUrl, tokens[0]!, uploaded.id);

    const noConsent = await api(baseUrl, '/ai/tasks', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        resumeId: saved.id,
        sectionId: project.id,
        contentType: 'project',
        baseVersion: saved.version,
        instruction: '突出工程化成果',
        jobDescription: '希望候选人拥有不存在的 Kubernetes 经验',
        sources: { documentIds: [uploaded.id], profileEntryIds: [] },
        consentToThirdParty: false,
      }),
    });
    assert.equal(noConsent.response.status, 400);

    const forbiddenSource = await api(baseUrl, '/ai/tasks', {
      method: 'POST',
      headers: bearer(tokens[1]!),
      body: JSON.stringify({
        resumeId: saved.id,
        sectionId: project.id,
        contentType: 'project',
        baseVersion: saved.version,
        instruction: '生成项目描述',
        jobDescription: null,
        sources: { documentIds: [uploaded.id], profileEntryIds: [] },
        consentToThirdParty: true,
      }),
    });
    assert.ok([403, 404].includes(forbiddenSource.response.status));

    const taskResponse = await api(baseUrl, '/ai/tasks', {
      method: 'POST',
      headers: bearer(tokens[0]!),
      body: JSON.stringify({
        resumeId: saved.id,
        sectionId: project.id,
        contentType: 'project',
        baseVersion: saved.version,
        instruction: '突出工程化成果，保留有依据的数字',
        jobDescription: '希望候选人拥有不存在的 Kubernetes 经验和日活 500+',
        sources: { documentIds: [uploaded.id], profileEntryIds: [] },
        consentToThirdParty: true,
      }),
    });
    assert.equal(taskResponse.response.status, 201);
    const pendingTask = data<AiTask>(taskResponse.body);
    const task = await waitTask(baseUrl, tokens[0]!, pendingTask.id);
    assert.ok(task.suggestions.length > 0);
    const suggestion = task.suggestions[0]!;
    assert.equal(suggestion.supportStatus, 'supported');
    assert.ok(suggestion.citations.every((citation) => citation.sourceId === uploaded.id));
    assert.doesNotMatch(suggestion.text, /Kubernetes|500/);

    const strangerTask = await api(baseUrl, '/ai/tasks/' + task.id, {
      headers: bearer(tokens[1]!),
    });
    assert.equal(strangerTask.response.status, 404);

    const beforeAccept = await api(baseUrl, '/resumes/' + saved.id, {
      headers: bearer(tokens[0]!),
    });
    assert.doesNotMatch(
      JSON.stringify(data<ResumeDetail>(beforeAccept.body).document),
      /8 个复用组件/,
    );

    const accepted = await api(
      baseUrl,
      '/ai/tasks/' + task.id + '/generations/' + suggestion.id + '/accept',
      {
        method: 'POST',
        headers: bearer(tokens[0]!),
        body: JSON.stringify({ baseVersion: saved.version, editedText: null }),
      },
    );
    assert.equal(accepted.response.status, 200);
    const updated = data<ResumeDetail>(accepted.body);
    assert.equal(updated.version, saved.version + 1);
    assert.match(JSON.stringify(updated.document), /8 个复用组件/);

    const database = app.get(DatabaseService);
    const [embedded] = await database.db
      .select({ embedding: documentChunks.embedding })
      .from(documentChunks)
      .where(inArray(documentChunks.documentId, [uploaded.id]))
      .limit(1);
    assert.equal(embedded?.embedding?.length, 1024);
    const events = await database.db
      .select({ type: aiTaskEvents.type })
      .from(aiTaskEvents)
      .where(inArray(aiTaskEvents.taskId, [task.id]));
    for (const eventType of ['started', 'progress', 'delta', 'suggestion', 'completed'])
      assert.ok(events.some((event) => event.type === eventType));

    process.stdout.write(
      'Stage 6 embedding, scoped retrieval, guardrails, approval boundary and AI task events passed.\n',
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
