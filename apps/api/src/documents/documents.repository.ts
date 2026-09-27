import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DocumentFileType, DocumentPurpose, ImportCandidate } from '@aceresume/contracts';
import { DatabaseService } from '../infrastructure/database.service.js';
import { documentChunks, documentImports, documents, users } from '../infrastructure/schema.js';

export class DocumentLimitError extends Error {
  constructor(readonly reason: 'count' | 'total') {
    super(reason);
  }
}

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(userId: string, page: number, pageSize: number) {
    const where = and(eq(documents.userId, userId), isNull(documents.deletedAt));
    const [items, totals] = await Promise.all([
      this.database.db
        .select()
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db
        .select({ value: count(), bytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)` })
        .from(documents)
        .where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0, usageBytes: Number(totals[0]?.bytes ?? 0) };
  }

  async create(input: {
    id: string;
    userId: string;
    fileName: string;
    fileType: DocumentFileType;
    purpose: DocumentPurpose;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    objectKey: string;
    maxFiles: number;
    maxTotalBytes: number;
  }) {
    return this.database.db.transaction(async (transaction) => {
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('update');
      const [usage] = await transaction
        .select({ value: count(), bytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)` })
        .from(documents)
        .where(and(eq(documents.userId, input.userId), isNull(documents.deletedAt)));
      if ((usage?.value ?? 0) >= input.maxFiles) throw new DocumentLimitError('count');
      if (Number(usage?.bytes ?? 0) + input.sizeBytes > input.maxTotalBytes)
        throw new DocumentLimitError('total');
      const [document] = await transaction.insert(documents).values(input).returning();
      if (!document) throw new Error('Document insert failed.');
      return document;
    });
  }

  async find(userId: string, id: string) {
    const [document] = await this.database.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId), isNull(documents.deletedAt)))
      .limit(1);
    if (!document) return undefined;
    const [chunks, imports] = await Promise.all([
      this.database.db
        .select()
        .from(documentChunks)
        .where(and(eq(documentChunks.documentId, id), eq(documentChunks.userId, userId)))
        .orderBy(documentChunks.chunkIndex),
      this.database.db
        .select()
        .from(documentImports)
        .where(and(eq(documentImports.documentId, id), eq(documentImports.userId, userId)))
        .limit(1),
    ]);
    return { document, chunks, import: imports[0] };
  }

  async markDeleting(userId: string, id: string) {
    const [document] = await this.database.db
      .update(documents)
      .set({ status: 'deleting', updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.userId, userId), isNull(documents.deletedAt)))
      .returning();
    return document;
  }

  async markQueuedForReparse(userId: string, id: string) {
    const [document] = await this.database.db
      .update(documents)
      .set({
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        attemptCount: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.userId, userId), isNull(documents.deletedAt)))
      .returning();
    return document;
  }

  async confirmImport(
    userId: string,
    importId: string,
    selected: Array<{ id: string; value: string }>,
    destination: string,
    resumeId: string | null,
  ): Promise<boolean> {
    const [record] = await this.database.db
      .update(documentImports)
      .set({
        status: 'confirmed',
        confirmedSelection: selected,
        destination,
        resumeId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentImports.id, importId),
          eq(documentImports.userId, userId),
          eq(documentImports.status, 'pending'),
        ),
      )
      .returning({ id: documentImports.id });
    return Boolean(record);
  }

  async replaceCandidates(userId: string, documentId: string, candidates: ImportCandidate[]) {
    await this.database.db
      .insert(documentImports)
      .values({ userId, documentId, candidates })
      .onConflictDoUpdate({
        target: documentImports.documentId,
        set: { candidates, updatedAt: new Date() },
      });
  }
}
