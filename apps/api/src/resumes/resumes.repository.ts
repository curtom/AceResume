import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { ResumeDocument, ResumeTheme } from '@aceresume/resume-schema';
import type { ResumeStatus } from '@aceresume/contracts';
import { DatabaseService } from '../infrastructure/database.service.js';
import { resumeSections, resumes, users } from '../infrastructure/schema.js';

export class ResumeLimitError extends Error {}

@Injectable()
export class ResumesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(userId: string, status: ResumeStatus, page: number, pageSize: number) {
    const where = and(
      eq(resumes.userId, userId),
      eq(resumes.status, status),
      isNull(resumes.deletedAt),
    );
    const [items, totals] = await Promise.all([
      this.database.db
        .select()
        .from(resumes)
        .where(where)
        .orderBy(desc(resumes.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db.select({ value: count() }).from(resumes).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async find(userId: string, id: string) {
    const [resume] = await this.database.db
      .select()
      .from(resumes)
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
      .limit(1);
    if (!resume) return undefined;
    const sections = await this.database.db
      .select()
      .from(resumeSections)
      .where(and(eq(resumeSections.resumeId, id), eq(resumeSections.userId, userId)))
      .orderBy(resumeSections.sortOrder);
    return { resume, sections };
  }

  async create(input: {
    id: string;
    userId: string;
    name: string;
    targetRole: string | null;
    locale: string;
    templateVersionId: string;
    theme: ResumeTheme;
    source: 'blank' | 'profile' | 'import';
    document: ResumeDocument;
  }) {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('update');
      const [total] = await transaction
        .select({ value: count() })
        .from(resumes)
        .where(and(eq(resumes.userId, input.userId), isNull(resumes.deletedAt)));
      if ((total?.value ?? 0) >= 6) throw new ResumeLimitError();
      await transaction.insert(resumes).values({
        id: input.id,
        userId: input.userId,
        name: input.name,
        targetRole: input.targetRole,
        locale: input.locale,
        templateVersionId: input.templateVersionId,
        theme: input.theme,
        source: input.source,
      });
      await transaction.insert(resumeSections).values(
        input.document.sections.map((section) => ({
          id: section.id,
          userId: input.userId,
          resumeId: input.id,
          type: section.type,
          title: section.title,
          content: section.content,
          sortOrder: section.sortOrder,
          isVisible: section.isVisible,
          styleOverride: section.styleOverride,
        })),
      );
    });
  }

  async updateMetadata(
    userId: string,
    id: string,
    baseVersion: number,
    values: { name: string; targetRole: string | null },
  ) {
    const [resume] = await this.database.db
      .update(resumes)
      .set({ ...values, version: baseVersion + 1, updatedAt: new Date() })
      .where(
        and(
          eq(resumes.id, id),
          eq(resumes.userId, userId),
          eq(resumes.version, baseVersion),
          isNull(resumes.deletedAt),
        ),
      )
      .returning();
    return resume;
  }

  async setStatus(userId: string, id: string, baseVersion: number, status: ResumeStatus) {
    const [resume] = await this.database.db
      .update(resumes)
      .set({ status, version: baseVersion + 1, updatedAt: new Date() })
      .where(
        and(
          eq(resumes.id, id),
          eq(resumes.userId, userId),
          eq(resumes.version, baseVersion),
          isNull(resumes.deletedAt),
        ),
      )
      .returning();
    return resume;
  }

  async saveDocument(
    userId: string,
    id: string,
    baseVersion: number,
    idempotencyKey: string,
    document: ResumeDocument,
  ) {
    return this.database.db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(resumes)
        .where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
        .limit(1);
      if (!current) return { result: 'not-found' as const };
      if (current.lastSaveKey === idempotencyKey) return { result: 'saved' as const };
      if (current.version !== baseVersion) return { result: 'conflict' as const };
      const targetSection = document.sections.find((section) => section.type === 'target');
      const [updated] = await transaction
        .update(resumes)
        .set({
          locale: document.locale,
          templateVersionId: document.templateVersionId,
          theme: document.theme,
          targetRole: targetSection?.content.role ?? null,
          lastSaveKey: idempotencyKey,
          version: baseVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(eq(resumes.id, id), eq(resumes.userId, userId), eq(resumes.version, baseVersion)),
        )
        .returning({ id: resumes.id });
      if (!updated) return { result: 'conflict' as const };
      await transaction
        .delete(resumeSections)
        .where(and(eq(resumeSections.resumeId, id), eq(resumeSections.userId, userId)));
      await transaction.insert(resumeSections).values(
        document.sections.map((section) => ({
          id: section.id,
          userId,
          resumeId: id,
          type: section.type,
          title: section.title,
          content: section.content,
          sortOrder: section.sortOrder,
          isVisible: section.isVisible,
          styleOverride: section.styleOverride,
        })),
      );
      return { result: 'saved' as const };
    });
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const [resume] = await this.database.db
      .update(resumes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
      .returning({ id: resumes.id });
    return Boolean(resume);
  }
}
