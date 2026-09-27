import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { ResumeDocument } from '@aceresume/resume-schema';
import { DatabaseService } from '../infrastructure/database.service.js';
import { exportJobs } from '../infrastructure/schema.js';

@Injectable()
export class ExportsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: {
    id: string;
    userId: string;
    resumeId: string;
    resumeVersion: number;
    templateVersionId: string;
    idempotencyKey: string;
    inputSnapshot: ResumeDocument;
    fileName: string;
  }) {
    const [created] = await this.database.db
      .insert(exportJobs)
      .values(input)
      .onConflictDoNothing({ target: [exportJobs.userId, exportJobs.idempotencyKey] })
      .returning();
    return created ?? this.findByIdempotencyKey(input.userId, input.idempotencyKey);
  }

  async find(userId: string, id: string) {
    const [job] = await this.database.db
      .select()
      .from(exportJobs)
      .where(and(eq(exportJobs.id, id), eq(exportJobs.userId, userId)))
      .limit(1);
    return job;
  }

  private async findByIdempotencyKey(userId: string, idempotencyKey: string) {
    const [job] = await this.database.db
      .select()
      .from(exportJobs)
      .where(and(eq(exportJobs.userId, userId), eq(exportJobs.idempotencyKey, idempotencyKey)))
      .limit(1);
    return job;
  }
}
