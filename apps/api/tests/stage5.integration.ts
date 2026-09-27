import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
type ApiResponse<T> = { data: T };
async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T> & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${response.status} ${body.code} ${body.message}`);
  return body.data;
}
async function register(email: string) {
  const seed = randomUUID().replaceAll('-', '');
  const clientIp = `2001:db8:${seed.slice(0, 4)}:${seed.slice(4, 8)}::5`;
  const registered = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
    body: JSON.stringify({ email, password: 'Stage5Secure123' }),
  });
  assert.equal(registered.status, 201);
  return json<{ accessToken: string }>(
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
      body: JSON.stringify({ email, password: 'Stage5Secure123' }),
    }),
  );
}
async function upload(
  token: string,
  name: string,
  content: string,
  purpose: 'material' | 'resume',
) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/markdown' }), name);
  form.append('purpose', purpose);
  return json<{ id: string }>(
    await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    }),
  );
}
async function waitReady(token: string, id: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const detail = await json<{
      status: string;
      chunks: unknown[];
      import: null | {
        id: string;
        status: string;
        candidates: Array<{ id: string; field: string; value: string }>;
      };
    }>(
      await fetch(`${baseUrl}/documents/${id}`, { headers: { authorization: `Bearer ${token}` } }),
    );
    if (detail.status === 'ready') return detail;
    if (detail.status === 'failed') throw new Error('Document parse failed.');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Document parse timed out.');
}

async function main(): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = await register(`stage5-owner-${suffix}@example.test`);
  const stranger = await register(`stage5-stranger-${suffix}@example.test`);
  const resumeText = `张小满
邮箱：student@example.test
电话：13800000000
求职意向：前端开发实习

教育经历
学校：示例大学
专业：软件工程
学历：本科
时间：2022-09 至 2026-06

项目经历
项目名称：校园互助平台
项目角色：前端负责人
技术栈：Vue 3、TypeScript
时间：2025-03 至 2025-08
- 完成结构化页面与性能优化

技能：Vue 3、TypeScript`;
  const uploaded = await upload(owner.accessToken, '虚构旧简历.md', resumeText, 'resume');
  const parsed = await waitReady(owner.accessToken, uploaded.id);
  assert.ok(parsed.chunks.length > 0);
  assert.ok(parsed.import && parsed.import.candidates.length >= 8);

  const unstructured = await upload(
    owner.accessToken,
    '无标签旧简历.txt',
    '王小明\n武汉科技大学 计算机科学与技术 本科 2022.09 - 2026.06\n熟练掌握 Vue 3 和 TypeScript',
    'resume',
  );
  const unstructuredParsed = await waitReady(owner.accessToken, unstructured.id);
  assert.ok(unstructuredParsed.import && unstructuredParsed.import.candidates.length > 0);
  assert.ok(
    unstructuredParsed.import?.candidates.some((candidate) => candidate.field === 'description'),
  );
  const reparsed = await fetch(baseUrl + '/documents/' + unstructured.id + '/reparse', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + owner.accessToken },
  });
  assert.equal(reparsed.status, 202);
  assert.ok((await waitReady(owner.accessToken, unstructured.id)).import?.candidates.length);
  const ownerDownload = await fetch(`${baseUrl}/documents/${uploaded.id}/download`, {
    headers: { authorization: `Bearer ${owner.accessToken}` },
  });
  assert.equal(ownerDownload.status, 200);
  assert.match(await ownerDownload.text(), /校园互助平台/);

  const forbidden = await fetch(`${baseUrl}/documents/${uploaded.id}`, {
    headers: { authorization: `Bearer ${stranger.accessToken}` },
  });
  assert.equal(forbidden.status, 404);
  assert.equal(
    (
      await fetch(`${baseUrl}/documents/${uploaded.id}/download`, {
        headers: { authorization: `Bearer ${stranger.accessToken}` },
      })
    ).status,
    404,
  );

  const selected = parsed.import!.candidates.map((candidate) => ({
    id: candidate.id,
    value: candidate.value,
  }));
  const confirmed = await json<{ resumeId: string; profileEntryCount: number }>(
    await fetch(`${baseUrl}/documents/${uploaded.id}/confirm-import`, {
      method: 'POST',
      headers: { authorization: `Bearer ${owner.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        selected,
        destination: 'both',
        resumeId: null,
        resumeVersion: null,
        newResume: {
          name: '虚构导入简历',
          targetRole: '前端开发实习',
          locale: 'zh-CN',
          templateVersionId: 'classic-single-v1',
        },
      }),
    }),
  );
  assert.ok(confirmed.resumeId);
  assert.ok(confirmed.profileEntryCount >= 1);
  const resume = await json<{ source: string }>(
    await fetch(`${baseUrl}/resumes/${confirmed.resumeId}`, {
      headers: { authorization: `Bearer ${owner.accessToken}` },
    }),
  );
  assert.equal(resume.source, 'import');

  const duplicateConfirm = await fetch(`${baseUrl}/documents/${uploaded.id}/confirm-import`, {
    method: 'POST',
    headers: { authorization: `Bearer ${owner.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      selected,
      destination: 'profile',
      resumeId: null,
      resumeVersion: null,
      newResume: null,
    }),
  });
  assert.equal(duplicateConfirm.status, 409);

  const notes = await upload(
    owner.accessToken,
    '项目事实.txt',
    '项目事实\n使用 Vue 3 完成虚构课程项目。',
    'material',
  );
  await waitReady(owner.accessToken, notes.id);
  const deleted = await fetch(`${baseUrl}/documents/${notes.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${owner.accessToken}` },
  });
  assert.equal(deleted.status, 202);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${baseUrl}/documents/${notes.id}`, {
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    if (response.status === 404) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (attempt === 29) throw new Error('Cleanup timed out.');
  }

  const badForm = new FormData();
  badForm.append('file', new Blob(['MZ executable']), 'unsafe.exe');
  badForm.append('purpose', 'material');
  const unsupported = await fetch(`${baseUrl}/documents`, {
    method: 'POST',
    headers: { authorization: `Bearer ${owner.accessToken}` },
    body: badForm,
  });
  assert.equal(unsupported.status, 400);

  const emptyForm = new FormData();
  emptyForm.append('file', new Blob([]), 'empty.txt');
  emptyForm.append('purpose', 'material');
  assert.equal(
    (
      await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: { authorization: `Bearer ${owner.accessToken}` },
        body: emptyForm,
      })
    ).status,
    400,
  );

  const corruptDocx = await upload(
    owner.accessToken,
    '损坏文档.docx',
    'PK broken archive',
    'material',
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${baseUrl}/documents/${corruptDocx.id}`, {
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const body = (await response.json()) as { data: { status: string; errorCode: string | null } };
    if (body.data.status === 'failed') {
      assert.equal(body.data.errorCode, 'DOCX_CORRUPT');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (attempt === 29) throw new Error('Corrupt DOCX did not reach failed state.');
  }

  const fakePdf = new FormData();
  fakePdf.append('file', new Blob(['not a pdf']), 'fake.pdf');
  fakePdf.append('purpose', 'material');
  assert.equal(
    (
      await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: { authorization: `Bearer ${owner.accessToken}` },
        body: fakePdf,
      })
    ).status,
    400,
  );
  console.log(
    'Stage 5 upload, parse, preview, import confirmation, ownership and cleanup integration passed.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
