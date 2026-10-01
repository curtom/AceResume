import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Queue, Worker, UnrecoverableError } from 'bullmq';
import { Client } from 'minio';
import nodemailer from 'nodemailer';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { chromium } from 'playwright';
import postgres from 'postgres';
import { WorkerEnvironmentSchema, loadEnvironment } from '@aceresume/config';
import {
  DocumentParseJobSchema,
  EmailJobSchema,
  PdfExportJobSchema,
  RenderDiagnosticsSchema,
  StorageCleanupJobSchema,
  type DocumentFileType,
  type DocumentEmbedJob,
  type ImportCandidate,
} from '@aceresume/contracts';
import { ResumeDocumentSchema } from '@aceresume/resume-schema';
import { renderResume } from '@aceresume/template-engine';
import { TemplateDefinitionSchema } from '@aceresume/resume-schema';
import { startAiWorkers } from './ai-workers.js';

const environment = loadEnvironment(WorkerEnvironmentSchema, process.env);
const database = postgres(environment.DATABASE_URL);
const embedQueue = new Queue<DocumentEmbedJob>('document.embed', {
  connection: { url: environment.REDIS_URL },
});
const closeAiWorkers = startAiWorkers(environment);
const storage = new Client({
  endPoint: environment.STORAGE_ENDPOINT,
  port: environment.STORAGE_PORT,
  useSSL: false,
  accessKey: environment.STORAGE_ACCESS_KEY,
  secretKey: environment.STORAGE_SECRET_KEY,
});
const systemWorker = new Worker(
  'system',
  async (job) => {
    process.stdout.write(
      JSON.stringify({ level: 'log', jobId: job.id, event: 'system.job.received' }) + '\n',
    );
  },
  {
    connection: { url: environment.REDIS_URL },
    concurrency: environment.WORKER_CONCURRENCY,
  },
);

systemWorker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'system.worker.error', message: error.message }) + '\n',
  );
});

const mailTransport = nodemailer.createTransport({
  host: environment.MAIL_HOST,
  port: environment.MAIL_PORT,
  secure: false,
});
const emailWorker = new Worker(
  'email.send',
  async (job) => {
    const message = EmailJobSchema.parse(job.data);
    await mailTransport.sendMail({ from: environment.MAIL_FROM, ...message });
    process.stdout.write(
      JSON.stringify({ level: 'log', jobId: job.id, event: 'email.sent' }) + '\n',
    );
  },
  { connection: { url: environment.REDIS_URL }, concurrency: environment.WORKER_CONCURRENCY },
);
emailWorker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'email.worker.error', message: error.name }) + '\n',
  );
});

class ExportValidationError extends Error {}

const pdfWorker = new Worker(
  'pdf.export',
  async (job) => {
    const { exportJobId } = PdfExportJobSchema.parse(job.data);
    const [record] = await database<
      Array<{
        id: string;
        user_id: string;
        status: string;
        input_snapshot: unknown;
        template_version_id: string;
      }>
    >`select id, user_id, status, input_snapshot, template_version_id from export_jobs where id = ${exportJobId}`;
    if (!record) throw new UnrecoverableError('Export job record does not exist.');
    if (record.status === 'completed') return;
    await database`update export_jobs set status = 'processing', started_at = coalesce(started_at, now()), attempt_count = attempt_count + 1, updated_at = now(), error_code = null, error_message = null where id = ${record.id}`;
    try {
      const resume = ResumeDocumentSchema.parse(record.input_snapshot);
      const [templateRecord] = await database<
        Array<{ definition: unknown }>
      >`select definition from template_versions where id = ${record.template_version_id}`;
      const definition = templateRecord
        ? TemplateDefinitionSchema.parse(templateRecord.definition)
        : undefined;
      if (!definition) throw new ExportValidationError('Template version is unavailable.');
      const fontPath = resolve(
        __dirname,
        '../../../packages/template-engine/assets/NotoSansSC-Variable.ttf',
      );
      const font = await readFile(fontPath);
      const fontUrl = `data:font/ttf;base64,${font.toString('base64')}`;
      const basic = resume.sections.find((section) => section.type === 'basic');
      const avatarObjectKey =
        basic?.type === 'basic' ? (basic.content.avatarObjectKey ?? null) : null;
      let avatarUrl: string | undefined;
      if (avatarObjectKey) {
        const chunks: Buffer[] = [];
        for await (const chunk of await storage.getObject(
          environment.STORAGE_BUCKET,
          avatarObjectKey,
        ))
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const extension = avatarObjectKey.split('.').pop();
        const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
        avatarUrl = `data:${mimeType};base64,${Buffer.concat(chunks).toString('base64')}`;
      }
      const html = renderResume({
        resume,
        template: definition,
        mode: 'print',
        fontUrl,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      const browser = await chromium.launch({ headless: true });
      let pdf: Buffer;
      let diagnostics;
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
        await page.waitForFunction(
          () => document.documentElement.dataset.renderReady === 'true',
          undefined,
          { timeout: 30_000 },
        );
        diagnostics = RenderDiagnosticsSchema.parse(
          await page.evaluate(
            () => (window as unknown as { __ACE_RESUME_RENDER__: unknown }).__ACE_RESUME_RENDER__,
          ),
        );
        if (
          !diagnostics.fontReady ||
          diagnostics.blankPageCount > 0 ||
          diagnostics.overflowCount > 0 ||
          diagnostics.invalidLinkCount > 0 ||
          diagnostics.exceedsMaximumPages
        )
          throw new ExportValidationError('PDF preflight validation failed.');
        pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      } finally {
        await browser.close();
      }
      if (pdf.length < 1_000 || pdf.subarray(0, 4).toString('ascii') !== '%PDF')
        throw new ExportValidationError('Chromium returned an invalid PDF.');
      if (!(await storage.bucketExists(environment.STORAGE_BUCKET)))
        await storage.makeBucket(environment.STORAGE_BUCKET);
      const objectKey = `exports/${record.user_id}/${record.id}.pdf`;
      await storage.putObject(environment.STORAGE_BUCKET, objectKey, pdf, pdf.length, {
        'Content-Type': 'application/pdf',
      });
      await database`update export_jobs set status = 'completed', object_key = ${objectKey}, diagnostics = ${database.json(diagnostics)}, completed_at = now(), updated_at = now() where id = ${record.id}`;
      process.stdout.write(
        JSON.stringify({ level: 'log', jobId: job.id, event: 'pdf.export.completed' }) + '\n',
      );
    } catch (error: unknown) {
      const isValidation = error instanceof ExportValidationError;
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const status = isValidation || isFinalAttempt ? 'failed' : 'queued';
      const code = isValidation ? 'EXPORT_RENDER_FAILED' : 'DEPENDENCY_UNAVAILABLE';
      await database`update export_jobs set status = ${status}, error_code = ${code}, error_message = ${isValidation ? '导出前校验未通过，请检查分页、链接或字体。' : 'PDF 服务暂时不可用，任务将按策略重试。'}, updated_at = now() where id = ${record.id}`;
      if (isValidation) throw new UnrecoverableError('PDF preflight validation failed.');
      throw error;
    }
  },
  { connection: { url: environment.REDIS_URL }, concurrency: environment.WORKER_CONCURRENCY },
);
pdfWorker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'pdf.worker.error', message: error.name }) + '\n',
  );
});

type ParsedParagraph = {
  text: string;
  pageNumber: number | null;
  paragraph: number;
  section: string | null;
};
type ParsedChunk = ParsedParagraph & {
  id: string;
  content: string;
  paragraphEnd: number;
  chunkIndex: number;
};
class DocumentValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sectionFor(line: string): string | null {
  if (/教育|学历|education/i.test(line)) return 'education';
  if (/实习|工作经历|experience|employment/i.test(line)) return 'experience';
  if (/项目|project/i.test(line)) return 'project';
  if (/技能|skills?|技术栈/i.test(line)) return 'skill';
  if (/简介|评价|summary|profile/i.test(line)) return 'summary';
  return null;
}

function textParagraphs(text: string, pageNumber: number | null = null): ParsedParagraph[] {
  let section: string | null = null;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, paragraph) => {
      const nextSection = sectionFor(line);
      if (nextSection && line.length <= 30) section = nextSection;
      return { text: line, pageNumber, paragraph, section };
    });
}

function validateDocxArchive(buffer: Buffer): void {
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let offset = buffer.indexOf(signature);
  let total = 0;
  let entries = 0;
  while (offset >= 0 && offset + 46 <= buffer.length) {
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    if (uncompressedSize === 0xffffffff)
      throw new DocumentValidationError('DOCX_TOO_LARGE', '暂不支持 ZIP64 DOCX 文件。');
    total += uncompressedSize;
    if (total > environment.DOCUMENT_MAX_DOCX_UNCOMPRESSED_BYTES)
      throw new DocumentValidationError('DOCX_TOO_LARGE', 'DOCX 解压后内容超过安全限制。');
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries += 1;
    offset = buffer.indexOf(signature, offset + 46 + nameLength + extraLength + commentLength);
  }
  if (!entries) throw new DocumentValidationError('DOCX_CORRUPT', 'DOCX 文件损坏或无法解析。');
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DocumentValidationError('DOCUMENT_PARSE_TIMEOUT', '文档解析超时。')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function parseDocument(
  buffer: Buffer,
  fileType: DocumentFileType,
): Promise<{ paragraphs: ParsedParagraph[]; pageCount: number | null }> {
  if (fileType === 'txt' || fileType === 'md')
    return {
      paragraphs: textParagraphs(new TextDecoder('utf-8', { fatal: true }).decode(buffer)),
      pageCount: null,
    };
  if (fileType === 'docx') {
    validateDocxArchive(buffer);
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { paragraphs: textParagraphs(result.value), pageCount: null };
    } catch {
      throw new DocumentValidationError('DOCX_CORRUPT', 'DOCX 文件损坏或无法解析。');
    }
  }
  try {
    const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const pdf = await task.promise;
    if (pdf.numPages > environment.DOCUMENT_MAX_PAGES)
      throw new DocumentValidationError(
        'PDF_PAGE_LIMIT',
        `PDF 页数超过 ${environment.DOCUMENT_MAX_PAGES} 页限制。`,
      );
    const paragraphs: ParsedParagraph[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
        .filter(Boolean)
        .join('');
      paragraphs.push(...textParagraphs(text, pageNumber));
    }
    return { paragraphs, pageCount: pdf.numPages };
  } catch (error: unknown) {
    if (error instanceof DocumentValidationError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (/password/i.test(name))
      throw new DocumentValidationError('PDF_ENCRYPTED', '不支持受密码保护的 PDF。');
    throw new DocumentValidationError('PDF_CORRUPT', 'PDF 文件损坏或无法解析。');
  }
}

function createChunks(paragraphs: ParsedParagraph[]): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  for (const paragraph of paragraphs) {
    const previous = chunks.at(-1);
    if (
      previous &&
      previous.pageNumber === paragraph.pageNumber &&
      previous.section === paragraph.section &&
      previous.content.length + paragraph.text.length < 1_600
    ) {
      previous.content += `\n${paragraph.text}`;
      previous.paragraphEnd = paragraph.paragraph;
    } else {
      chunks.push({
        ...paragraph,
        id: randomUUID(),
        content: paragraph.text,
        paragraphEnd: paragraph.paragraph,
        chunkIndex: chunks.length,
      });
    }
  }
  return chunks;
}

function extractCandidates(chunks: ParsedChunk[]): ImportCandidate[] {
  const candidates: ImportCandidate[] = [];
  const seen = new Set<string>();
  const add = (
    chunk: ParsedChunk,
    section: ImportCandidate['section'],
    field: ImportCandidate['field'],
    label: string,
    value: string,
    confidence: number,
  ) => {
    const clean = value
      .trim()
      .replace(/^[-•]\s*/, '')
      .slice(0, 5_000);
    const key = `${section}:${field}:${clean}`;
    if (!clean || seen.has(key)) return;
    seen.add(key);
    candidates.push({
      id: randomUUID(),
      section,
      field,
      label,
      value: clean,
      confidence,
      source: { chunkId: chunk.id, pageNumber: chunk.pageNumber, paragraphStart: chunk.paragraph },
    });
  };
  for (const chunk of chunks) {
    for (const line of chunk.content
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)) {
      const section = (sectionFor(line) ?? chunk.section ?? 'basic') as ImportCandidate['section'];
      const labeled = line.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
      const label = labeled?.[1] ?? '';
      const content = labeled?.[2] ?? line;
      if (/姓名/.test(label)) add(chunk, 'basic', 'fullName', '姓名', content, 0.98);
      if (/邮箱|email/i.test(label) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content))
        add(
          chunk,
          'basic',
          'email',
          '邮箱',
          content.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? content,
          0.99,
        );
      if (/电话|手机|phone/i.test(label)) add(chunk, 'basic', 'phone', '电话', content, 0.96);
      if (/所在地|地址|location/i.test(label))
        add(chunk, 'basic', 'location', '所在地', content, 0.9);
      if (/求职|岗位|target/i.test(label))
        add(chunk, 'basic', 'targetRole', '求职意向', content, 0.9);
      if (/简介|评价|summary/i.test(label))
        add(chunk, 'summary', 'summary', '自我评价', content, 0.88);
      if (/学校|院校/.test(label)) add(chunk, 'education', 'school', '学校', content, 0.95);
      if (/专业/.test(label)) add(chunk, 'education', 'major', '专业', content, 0.95);
      if (/学历|学位/.test(label)) add(chunk, 'education', 'degree', '学历', content, 0.95);
      if (/公司|单位|组织/.test(label))
        add(chunk, 'experience', 'organization', '公司 / 组织', content, 0.94);
      if (/职位|职务/.test(label)) add(chunk, 'experience', 'position', '职位', content, 0.94);
      if (/项目名称|项目名/.test(label))
        add(chunk, 'project', 'projectName', '项目名称', content, 0.95);
      if (/项目角色|角色/.test(label))
        add(chunk, 'project', 'projectRole', '项目角色', content, 0.9);
      if (/技术栈|技术/.test(label)) add(chunk, 'project', 'technologies', '技术栈', content, 0.9);
      if (/技能/.test(label))
        for (const skill of content.split(/[,，、]/))
          add(chunk, 'skill', 'skill', '技能', skill, 0.9);
      const months =
        line
          .match(/(?:19|20)\d{2}[.\-/年](?:0?[1-9]|1[0-2])/g)
          ?.map((month) => month.replace(/[年./]/g, '-').replace(/-(\d)$/, '-0$1')) ?? [];
      if (section !== 'basic' && months[0])
        add(chunk, section, 'startDate', '开始时间', months[0], 0.85);
      if (section !== 'basic' && months[1])
        add(chunk, section, 'endDate', '结束时间', months[1], 0.85);
      if (
        !labeled &&
        /^[-•]/.test(line) &&
        ['education', 'experience', 'project'].includes(section)
      )
        add(chunk, section, 'description', '经历描述', line, 0.72);
    }
  }
  const firstLine = chunks[0]?.content.split('\n')[0]?.trim();
  const firstChunk = chunks[0];
  if (firstChunk && firstLine && /^[\p{L}·]{2,30}$/u.test(firstLine) && !sectionFor(firstLine))
    add(firstChunk, 'basic', 'fullName', '姓名', firstLine, 0.65);
  if (candidates.length < 3)
    for (const chunk of chunks)
      add(chunk, 'summary', 'description', '未分类原文', chunk.content, 0.35);
  return candidates.slice(0, 200);
}

const documentWorker = new Worker(
  'document.parse',
  async (job) => {
    const { documentId } = DocumentParseJobSchema.parse(job.data);
    const [record] = await database<
      Array<{
        id: string;
        user_id: string;
        object_key: string;
        file_type: DocumentFileType;
        purpose: string;
        status: string;
      }>
    >`select id, user_id, object_key, file_type, purpose, status from documents where id = ${documentId} and deleted_at is null`;
    if (!record || record.status === 'deleting')
      throw new UnrecoverableError('Document no longer exists.');
    if (record.status === 'ready') return;
    await database`update documents set status = 'parsing', attempt_count = attempt_count + 1, error_code = null, error_message = null, updated_at = now() where id = ${record.id} and status <> 'deleting'`;
    try {
      const buffer = await streamToBuffer(
        await storage.getObject(environment.STORAGE_BUCKET, record.object_key),
      );
      const parsed = await withTimeout(
        parseDocument(buffer, record.file_type),
        environment.DOCUMENT_MAX_PARSE_MS,
      );
      if (!parsed.paragraphs.length)
        throw new DocumentValidationError(
          record.file_type === 'pdf' ? 'PDF_NO_TEXT' : 'DOCUMENT_EMPTY',
          record.file_type === 'pdf'
            ? 'PDF 中没有可提取文本；扫描件暂不支持 OCR。'
            : '文件中没有可解析文本。',
        );
      const totalLength = parsed.paragraphs.reduce(
        (sum, paragraph) => sum + paragraph.text.length,
        0,
      );
      if (totalLength > environment.DOCUMENT_MAX_TEXT_CHARS)
        throw new DocumentValidationError(
          'DOCUMENT_TEXT_LIMIT',
          `提取文本超过 ${environment.DOCUMENT_MAX_TEXT_CHARS} 字符限制。`,
        );
      const chunks = createChunks(parsed.paragraphs);
      const candidates = record.purpose === 'resume' ? extractCandidates(chunks) : [];
      await database.begin(async (transaction) => {
        const [current] = await transaction<
          Array<{ status: string }>
        >`select status from documents where id = ${record.id} for update`;
        if (!current || current.status === 'deleting') return;
        await transaction`delete from document_chunks where document_id = ${record.id}`;
        for (const chunk of chunks)
          await transaction`insert into document_chunks (id, user_id, document_id, content, page_number, paragraph_start, paragraph_end, section_path, chunk_index, token_count) values (${chunk.id}, ${record.user_id}, ${record.id}, ${chunk.content}, ${chunk.pageNumber}, ${chunk.paragraph}, ${chunk.paragraphEnd}, ${chunk.section}, ${chunk.chunkIndex}, ${Math.ceil(chunk.content.length / 2)})`;
        if (record.purpose === 'resume')
          await transaction`insert into document_imports (user_id, document_id, candidates) values (${record.user_id}, ${record.id}, ${transaction.json(candidates)}) on conflict (document_id) do update set candidates = excluded.candidates, updated_at = now()`;
        await transaction`update documents set status = 'ready', page_count = ${parsed.pageCount}, chunk_count = ${chunks.length}, updated_at = now() where id = ${record.id}`;
      });
      process.stdout.write(
        JSON.stringify({
          level: 'log',
          jobId: job.id,
          event: 'document.parse.completed',
          documentId: record.id,
          chunkCount: chunks.length,
        }) + '\n',
      );
      await embedQueue.add(
        'embed',
        { documentId: record.id },
        {
          jobId: record.id + '-' + randomUUID(),
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error: unknown) {
      const validation = error instanceof DocumentValidationError;
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await database`update documents set status = ${validation || finalAttempt ? 'failed' : 'queued'}, error_code = ${validation ? error.code : 'DEPENDENCY_UNAVAILABLE'}, error_message = ${validation ? error.message : '解析服务暂时不可用，任务将按策略重试。'}, updated_at = now() where id = ${record.id} and status <> 'deleting'`;
      if (validation) throw new UnrecoverableError(error.message);
      throw error;
    }
  },
  { connection: { url: environment.REDIS_URL }, concurrency: environment.WORKER_CONCURRENCY },
);
documentWorker.on('error', (error: Error) =>
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'document.worker.error', message: error.name }) + '\n',
  ),
);

const cleanupWorker = new Worker(
  'storage.cleanup',
  async (job) => {
    const { documentId } = StorageCleanupJobSchema.parse(job.data);
    const [record] = await database<
      Array<{ id: string; object_key: string; status: string; deleted_at: Date | null }>
    >`select id, object_key, status, deleted_at from documents where id = ${documentId}`;
    if (!record || record.deleted_at) return;
    if (record.status !== 'deleting')
      throw new UnrecoverableError('Document is not scheduled for deletion.');
    await storage.removeObject(environment.STORAGE_BUCKET, record.object_key);
    await database.begin(async (transaction) => {
      await transaction`update document_imports set candidates = '[]'::jsonb, updated_at = now() where document_id = ${record.id}`;
      await transaction`delete from document_chunks where document_id = ${record.id}`;
      await transaction`update documents set deleted_at = now(), chunk_count = 0, updated_at = now() where id = ${record.id}`;
    });
    process.stdout.write(
      JSON.stringify({
        level: 'log',
        jobId: job.id,
        event: 'storage.cleanup.completed',
        documentId: record.id,
      }) + '\n',
    );
  },
  { connection: { url: environment.REDIS_URL }, concurrency: environment.WORKER_CONCURRENCY },
);
cleanupWorker.on('error', (error: Error) =>
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'cleanup.worker.error', message: error.name }) + '\n',
  ),
);

async function shutdown(): Promise<void> {
  await Promise.all([
    systemWorker.close(),
    emailWorker.close(),
    pdfWorker.close(),
    documentWorker.close(),
    cleanupWorker.close(),
    embedQueue.close(),
    closeAiWorkers(),
  ]);
  await database.end({ timeout: 3 });
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
