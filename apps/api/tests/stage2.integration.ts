import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import type { EmailJob } from '@aceresume/contracts';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { AuthRepository } from '../src/auth/auth.repository.js';
import { AuthService } from '../src/auth/auth.service.js';
import { RateLimitService } from '../src/auth/rate-limit.service.js';
import { EnvironmentModule } from '../src/bootstrap/environment.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { RequestIdInterceptor } from '../src/common/request-id.interceptor.js';
import { DatabaseModule } from '../src/infrastructure/database.module.js';
import { DatabaseService } from '../src/infrastructure/database.service.js';
import { users } from '../src/infrastructure/schema.js';
import { QueueService } from '../src/jobs/queue.service.js';
import { ProfilesController } from '../src/profiles/profiles.controller.js';
import { ProfilesRepository } from '../src/profiles/profiles.repository.js';
import { ProfilesService } from '../src/profiles/profiles.service.js';

const sentMail: EmailJob[] = [];
const ipSeed = randomUUID().replaceAll('-', '');
const TEST_CLIENT_IP = `2001:db8:${ipSeed.slice(0, 4)}:${ipSeed.slice(4, 8)}::1`;
const fakeQueue = {
  sendEmail: async (message: EmailJob) => {
    sentMail.push(message);
  },
};

@Module({
  imports: [EnvironmentModule, DatabaseModule],
  controllers: [AuthController, ProfilesController],
  providers: [
    AuthRepository,
    AuthService,
    AuthGuard,
    RateLimitService,
    ProfilesRepository,
    ProfilesService,
    { provide: QueueService, useValue: fakeQueue },
  ],
})
class StageTwoTestModule {}

type ApiEnvelope = { data?: unknown; code?: string };
async function api(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: ApiEnvelope }> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
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
function tokenFromMail(mail: EmailJob): string {
  const match = mail.text.match(/[?&]token=([^\s]+)/);
  assert.ok(match?.[1]);
  return decodeURIComponent(match[1]);
}
function cookie(response: Response): string {
  const value = response.headers.get('set-cookie');
  assert.ok(value);
  return value.split(';')[0] ?? '';
}

async function main(): Promise<void> {
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'true';
  const app = await NestFactory.create(StageTwoTestModule, { logger: false });
  const suffix = randomUUID();
  const emails = [`stage2-a-${suffix}@example.test`, `stage2-b-${suffix}@example.test`];
  const autoCreatedEmail = `stage2-auto-${suffix}@example.test`;
  const password = 'AceResume2026';
  const newPassword = 'AceResume2027';
  try {
    app.setGlobalPrefix('api/v1');
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.useGlobalInterceptors(new RequestIdInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const unauthenticatedProfile = await api(baseUrl, '/profile');
    assert.equal(unauthenticatedProfile.response.status, 401);
    const autoCreatedLogin = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: autoCreatedEmail, password }),
    });
    assert.equal(autoCreatedLogin.response.status, 200);
    assert.equal(
      data<{ user: { isEmailVerified: boolean } }>(autoCreatedLogin.body).user.isEmailVerified,
      true,
    );
    assert.ok(cookie(autoCreatedLogin.response));
    for (const email of emails) {
      const registration = await api(baseUrl, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(registration.response.status, 201);
      if (email === emails[0]) {
        const duplicate = await api(baseUrl, '/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.body.code, 'EMAIL_ALREADY_REGISTERED');
        const unverifiedLogin = await api(baseUrl, '/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        assert.equal(unverifiedLogin.response.status, 403);
        assert.equal(unverifiedLogin.body.code, 'EMAIL_NOT_VERIFIED');
      }
      const verification = await api(baseUrl, '/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tokenFromMail(sentMail.at(-1)!) }),
      });
      assert.equal(verification.response.status, 200);
    }
    const loginA = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emails[0], password }),
    });
    assert.equal(loginA.response.status, 200);
    const sessionA = data<{ accessToken: string }>(loginA.body);
    const refreshCookieA = cookie(loginA.response);
    const profileA = await api(baseUrl, '/profile', {
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
    });
    assert.equal(profileA.response.status, 200);
    const profile = data<{ version: number }>(profileA.body);
    const profileUpdate = await api(baseUrl, '/profile', {
      method: 'PUT',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        baseVersion: profile.version,
        fullName: '林知远',
        targetRole: '前端开发工程师',
        email: emails[0],
        phone: null,
        location: '杭州',
        customFields: [
          {
            id: '00000000-0000-4000-8000-000000000099',
            label: '作品集',
            value: 'https://example.test',
          },
        ],
        selfEvaluation: '关注用户体验与工程质量。',
      }),
    });
    assert.equal(profileUpdate.response.status, 200);
    const updatedProfile = data<{
      customFields: Array<{ label: string; value: string }>;
      selfEvaluation: string | null;
    }>(profileUpdate.body);
    assert.deepEqual(updatedProfile.customFields, [
      {
        label: '作品集',
        value: 'https://example.test',
        id: '00000000-0000-4000-8000-000000000099',
      },
    ]);
    assert.equal(updatedProfile.selfEvaluation, '关注用户体验与工程质量。');
    const education = await api(baseUrl, '/profile/entries', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'education',
        content: {
          schemaVersion: 1,
          school: '示例大学',
          major: '计算机科学',
          degree: '本科',
          startDate: '2022-09',
          endDate: '2026-06',
          isCurrent: false,
          description: null,
        },
      }),
    });
    assert.equal(education.response.status, 201);
    const entry = data<{ id: string; version: number }>(education.body);
    const campus = await api(baseUrl, '/profile/entries', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'campus',
        content: {
          schemaVersion: 1,
          organization: '学生会',
          role: '宣传部负责人',
          startDate: '2023-09',
          endDate: null,
          isCurrent: true,
          description: '组织校园招聘主题分享活动。',
        },
      }),
    });
    assert.equal(campus.response.status, 201);
    const campusList = await api(baseUrl, '/profile/entries?type=campus&page=1&pageSize=20', {
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
    });
    assert.equal(data<{ total: number }>(campusList.body).total, 1);
    const secondEducation = await api(baseUrl, '/profile/entries', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'education',
        content: {
          schemaVersion: 1,
          school: '第二示例大学',
          major: '软件工程',
          degree: '硕士',
          startDate: '2026-09',
          endDate: null,
          isCurrent: true,
          description: null,
        },
      }),
    });
    assert.equal(secondEducation.response.status, 201);
    const secondEntry = data<{ id: string; version: number }>(secondEducation.body);
    const invalidTimeline = await api(baseUrl, '/profile/entries', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'education',
        content: {
          schemaVersion: 1,
          school: '错误时间大学',
          major: '测试',
          degree: '本科',
          startDate: '2026-09',
          endDate: '2025-06',
          isCurrent: false,
          description: null,
        },
      }),
    });
    assert.equal(invalidTimeline.response.status, 400);
    const loginB = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emails[1], password }),
    });
    const sessionB = data<{ accessToken: string }>(loginB.body);
    const forbiddenUpdate = await api(baseUrl, `/profile/entries/${entry.id}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${sessionB.accessToken}` },
      body: JSON.stringify({
        baseVersion: entry.version,
        content: {
          schemaVersion: 1,
          school: '越权修改',
          major: '测试',
          degree: '本科',
          startDate: '2022-09',
          endDate: '2026-06',
          isCurrent: false,
          description: null,
        },
      }),
    });
    assert.equal(forbiddenUpdate.response.status, 404);
    assert.equal(forbiddenUpdate.body.code, 'PROFILE_ENTRY_NOT_FOUND');
    const forbiddenDelete = await api(baseUrl, `/profile/entries/${entry.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${sessionB.accessToken}` },
    });
    assert.equal(forbiddenDelete.response.status, 404);
    const forbiddenSnapshot = await api(baseUrl, '/profile/snapshot', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionB.accessToken}` },
      body: JSON.stringify({ entryIds: [entry.id] }),
    });
    assert.equal(forbiddenSnapshot.response.status, 404);
    const reordered = await api(baseUrl, '/profile/entries/reorder', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'education',
        orderedIds: [secondEntry.id, entry.id],
        versions: { [entry.id]: entry.version, [secondEntry.id]: secondEntry.version },
      }),
    });
    assert.equal(reordered.response.status, 200);
    const reorderedEntries = data<Array<{ id: string; version: number }>>(reordered.body);
    assert.deepEqual(
      reorderedEntries.map((item) => item.id),
      [secondEntry.id, entry.id],
    );
    const snapshot = await api(baseUrl, '/profile/snapshot', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({ entryIds: [entry.id, secondEntry.id] }),
    });
    assert.equal(snapshot.response.status, 200);
    assert.equal(data<{ entries: unknown[] }>(snapshot.body).entries.length, 2);
    const conflict = await api(baseUrl, '/profile/entries/reorder', {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
      body: JSON.stringify({
        type: 'education',
        orderedIds: [entry.id, secondEntry.id],
        versions: { [entry.id]: entry.version + 1 },
      }),
    });
    assert.equal(conflict.response.status, 409);
    const deleted = await api(baseUrl, `/profile/entries/${secondEntry.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
    });
    assert.equal(deleted.response.status, 200);
    const remaining = await api(baseUrl, '/profile/entries?type=education&page=1&pageSize=20', {
      headers: { authorization: `Bearer ${sessionA.accessToken}` },
    });
    assert.equal(data<{ total: number }>(remaining.body).total, 1);
    const refresh = await api(baseUrl, '/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookieA },
    });
    assert.equal(refresh.response.status, 200);
    const replay = await api(baseUrl, '/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookieA },
    });
    assert.equal(replay.response.status, 401);
    await api(baseUrl, '/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: emails[0] }),
    });
    const resetToken = tokenFromMail(sentMail.at(-1)!);
    const reset = await api(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });
    assert.equal(reset.response.status, 200);
    const resetReplay = await api(baseUrl, '/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });
    assert.equal(resetReplay.response.status, 400);
    const relogin = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emails[0], password: newPassword }),
    });
    assert.equal(relogin.response.status, 200);
    const reloginSession = data<{ accessToken: string }>(relogin.body);
    const reloginCookie = cookie(relogin.response);
    const logout = await api(baseUrl, '/auth/logout', {
      method: 'POST',
      headers: { cookie: reloginCookie },
    });
    assert.equal(logout.response.status, 200);
    const afterLogout = await api(baseUrl, '/auth/me', {
      headers: { authorization: `Bearer ${reloginSession.accessToken}` },
    });
    assert.equal(afterLogout.response.status, 401);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const failed = await api(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: autoCreatedEmail, password: 'WrongPassword2026' }),
      });
      assert.equal(failed.response.status, 401);
    }
    const clearsFailures = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: autoCreatedEmail, password }),
    });
    assert.equal(clearsFailures.response.status, 200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await api(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: autoCreatedEmail, password: 'WrongPassword2026' }),
      });
      assert.equal(failed.response.status, 401);
    }
    const rateLimited = await api(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: autoCreatedEmail, password: 'WrongPassword2026' }),
    });
    assert.equal(rateLimited.response.status, 429);
    assert.ok(
      Number(
        (rateLimited.body as { details?: { retryAfterSeconds?: number } }).details
          ?.retryAfterSeconds,
      ) > 0,
    );
    process.stdout.write(
      'Stage 2 auth, session, profile CRUD, ownership and concurrency integration passed.\n',
    );
  } finally {
    const database = app.get(DatabaseService);
    await database.db.delete(users).where(inArray(users.email, [...emails, autoCreatedEmail]));
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
