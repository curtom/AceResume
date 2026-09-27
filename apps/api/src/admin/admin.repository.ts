import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, ne, sql, isNull } from 'drizzle-orm';
import type { TemplateDefinition } from '@aceresume/resume-schema';
import { DatabaseService } from '../infrastructure/database.service.js';
import {
  aiGenerations,
  aiTasks,
  auditLogs,
  documents,
  exportJobs,
  modelConfigs,
  promptVersions,
  templateVersions,
  templates,
  users,
  userSessions,
} from '../infrastructure/schema.js';

@Injectable()
export class AdminRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listUsers(page: number, pageSize: number, search: string) {
    const where = search ? ilike(users.email, `%${search}%`) : undefined;
    const [items, totals] = await Promise.all([
      this.database.db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db.select({ value: count() }).from(users).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async updateUserStatus(userId: string, status: 'active' | 'disabled'): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      if (!updated) return false;
      if (status === 'disabled')
        await transaction
          .update(userSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
      return true;
    });
  }

  listTemplateVersions() {
    return this.database.db
      .select({
        definition: templateVersions.definition,
        status: templateVersions.status,
        publishedAt: templateVersions.publishedAt,
        createdAt: templateVersions.createdAt,
      })
      .from(templateVersions)
      .orderBy(asc(templateVersions.templateId), desc(templateVersions.version));
  }

  async createTemplateVersion(definition: TemplateDefinition): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .insert(templates)
        .values({
          id: definition.id,
          name: definition.name,
          description: definition.description,
          category: definition.category,
          layout: definition.layout,
          isPublic: false,
        })
        .onConflictDoUpdate({
          target: templates.id,
          set: {
            name: definition.name,
            description: definition.description,
            category: definition.category,
            layout: definition.layout,
            updatedAt: new Date(),
          },
        });
      await transaction.insert(templateVersions).values({
        id: definition.versionId,
        templateId: definition.id,
        version: definition.version,
        status: 'draft',
        definition,
      });
    });
  }

  async updateDraftTemplate(versionId: string, definition: TemplateDefinition): Promise<boolean> {
    const [updated] = await this.database.db
      .update(templateVersions)
      .set({ definition })
      .where(and(eq(templateVersions.id, versionId), eq(templateVersions.status, 'draft')))
      .returning({ id: templateVersions.id });
    return Boolean(updated);
  }

  async publishTemplate(versionId: string): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [target] = await transaction
        .select({ templateId: templateVersions.templateId })
        .from(templateVersions)
        .where(eq(templateVersions.id, versionId))
        .limit(1);
      if (!target) return false;
      await transaction
        .update(templateVersions)
        .set({ status: 'retired' })
        .where(
          and(
            eq(templateVersions.templateId, target.templateId),
            eq(templateVersions.status, 'published'),
            ne(templateVersions.id, versionId),
          ),
        );
      const [published] = await transaction
        .update(templateVersions)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(templateVersions.id, versionId))
        .returning({ id: templateVersions.id });
      if (!published) return false;
      await transaction
        .update(templates)
        .set({ isPublic: true, updatedAt: new Date() })
        .where(eq(templates.id, target.templateId));
      return true;
    });
  }

  async retireTemplate(versionId: string): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [target] = await transaction
        .update(templateVersions)
        .set({ status: 'retired' })
        .where(eq(templateVersions.id, versionId))
        .returning({ templateId: templateVersions.templateId });
      if (!target) return false;
      const [published] = await transaction
        .select({ id: templateVersions.id })
        .from(templateVersions)
        .where(
          and(
            eq(templateVersions.templateId, target.templateId),
            eq(templateVersions.status, 'published'),
          ),
        )
        .limit(1);
      if (!published)
        await transaction
          .update(templates)
          .set({ isPublic: false, updatedAt: new Date() })
          .where(eq(templates.id, target.templateId));
      return true;
    });
  }

  async ensureModelConfig(input: typeof modelConfigs.$inferInsert): Promise<void> {
    await this.database.db.insert(modelConfigs).values(input).onConflictDoNothing();
  }

  async ensurePrompt(input: typeof promptVersions.$inferInsert): Promise<void> {
    await this.database.db.insert(promptVersions).values(input).onConflictDoNothing();
  }

  getModelConfig() {
    return this.database.db.query.modelConfigs.findFirst({ where: eq(modelConfigs.id, 'primary') });
  }

  async updateModelConfig(input: Omit<typeof modelConfigs.$inferInsert, 'id' | 'createdAt'>) {
    const [updated] = await this.database.db
      .update(modelConfigs)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(modelConfigs.id, 'primary'))
      .returning();
    return updated;
  }

  listPromptVersions() {
    return this.database.db
      .select()
      .from(promptVersions)
      .orderBy(asc(promptVersions.key), desc(promptVersions.version));
  }

  async createPrompt(input: {
    key: string;
    content: string;
    rolloutPercent: number;
    createdBy: string;
  }) {
    const [latest] = await this.database.db
      .select({ version: promptVersions.version })
      .from(promptVersions)
      .where(eq(promptVersions.key, input.key))
      .orderBy(desc(promptVersions.version))
      .limit(1);
    const [created] = await this.database.db
      .insert(promptVersions)
      .values({ ...input, version: (latest?.version ?? 0) + 1 })
      .returning();
    return created;
  }

  async activatePrompt(id: string, rolloutPercent: number): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [target] = await transaction
        .select({ key: promptVersions.key })
        .from(promptVersions)
        .where(eq(promptVersions.id, id))
        .limit(1);
      if (!target) return false;
      if (rolloutPercent === 100)
        await transaction
          .update(promptVersions)
          .set({ status: 'retired', rolloutPercent: 0 })
          .where(
            and(
              eq(promptVersions.key, target.key),
              eq(promptVersions.status, 'active'),
              ne(promptVersions.id, id),
            ),
          );
      const [active] = await transaction
        .update(promptVersions)
        .set({ status: 'active', rolloutPercent, activatedAt: new Date() })
        .where(eq(promptVersions.id, id))
        .returning({ id: promptVersions.id });
      return Boolean(active);
    });
  }

  async insertAudit(input: typeof auditLogs.$inferInsert): Promise<void> {
    await this.database.db.insert(auditLogs).values(input);
  }

  async listAudit(page: number, pageSize: number) {
    const [items, totals] = await Promise.all([
      this.database.db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db.select({ value: count() }).from(auditLogs),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async monitoring() {
    const [ai, decisions, documentStatuses, exportStatuses] = await Promise.all([
      this.database.db
        .select({
          total: count(),
          failed: sql<number>`count(*) filter (where ${aiTasks.status} = 'failed')`,
          succeeded: sql<number>`count(*) filter (where ${aiTasks.status} in ('awaiting_confirmation', 'completed'))`,
          averageLatencyMs: sql<number>`coalesce(avg(extract(epoch from (${aiTasks.completedAt} - ${aiTasks.startedAt})) * 1000) filter (where ${aiTasks.completedAt} is not null and ${aiTasks.startedAt} is not null), 0)`,
          inputTokens: sql<number>`coalesce(sum(${aiTasks.inputTokenCount}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${aiTasks.outputTokenCount}), 0)`,
        })
        .from(aiTasks),
      this.database.db
        .select({ decision: aiGenerations.decision, value: count() })
        .from(aiGenerations)
        .groupBy(aiGenerations.decision),
      this.database.db
        .select({ status: documents.status, value: count() })
        .from(documents)
        .groupBy(documents.status),
      this.database.db
        .select({ status: exportJobs.status, value: count() })
        .from(exportJobs)
        .groupBy(exportJobs.status),
    ]);
    return { ai: ai[0], decisions, documentStatuses, exportStatuses };
  }
}
