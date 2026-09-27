import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { AiTaskEvent, CreateAiTaskRequest, ResumeSuggestion } from '@aceresume/contracts';
import { DatabaseService } from '../infrastructure/database.service.js';
import {
  aiCitations,
  aiGenerations,
  aiTaskEvents,
  aiTasks,
  documents,
  profileEntries,
} from '../infrastructure/schema.js';

@Injectable()
export class AiRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async sourcesBelongToUser(
    userId: string,
    documentIds: string[],
    profileEntryIds: string[],
  ): Promise<boolean> {
    const [ownedDocuments, ownedEntries] = await Promise.all([
      documentIds.length
        ? this.database.db
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.userId, userId),
                inArray(documents.id, documentIds),
                eq(documents.status, 'ready'),
                isNull(documents.deletedAt),
              ),
            )
        : [],
      profileEntryIds.length
        ? this.database.db
            .select({ id: profileEntries.id })
            .from(profileEntries)
            .where(
              and(
                eq(profileEntries.userId, userId),
                inArray(profileEntries.id, profileEntryIds),
                isNull(profileEntries.deletedAt),
              ),
            )
        : [],
    ]);
    return (
      ownedDocuments.length === documentIds.length && ownedEntries.length === profileEntryIds.length
    );
  }

  async createTask(input: {
    id: string;
    userId: string;
    provider: 'mock' | 'qwen';
    model: string;
    promptVersion: string;
    request: CreateAiTaskRequest;
  }) {
    const [task] = await this.database.db
      .insert(aiTasks)
      .values({
        id: input.id,
        userId: input.userId,
        resumeId: input.request.resumeId,
        sectionId: input.request.sectionId,
        baseVersion: input.request.baseVersion,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        input: input.request,
        consentedAt: new Date(),
      })
      .returning();
    return task;
  }

  async findTask(userId: string, id: string) {
    const [task] = await this.database.db
      .select()
      .from(aiTasks)
      .where(and(eq(aiTasks.id, id), eq(aiTasks.userId, userId)))
      .limit(1);
    if (!task) return undefined;
    const generations = await this.database.db
      .select()
      .from(aiGenerations)
      .where(and(eq(aiGenerations.taskId, id), eq(aiGenerations.userId, userId)))
      .orderBy(asc(aiGenerations.createdAt));
    return { task, generations };
  }

  async listEvents(userId: string, taskId: string, afterSequence: number): Promise<AiTaskEvent[]> {
    const events = await this.database.db
      .select()
      .from(aiTaskEvents)
      .where(and(eq(aiTaskEvents.userId, userId), eq(aiTaskEvents.taskId, taskId)))
      .orderBy(asc(aiTaskEvents.sequence));
    return events
      .filter((event) => event.sequence > afterSequence)
      .map((event) => ({
        sequence: event.sequence,
        type: event.type,
        data: event.data,
        createdAt: event.createdAt.toISOString(),
      }));
  }

  async findGeneration(userId: string, taskId: string, generationId: string) {
    const [record] = await this.database.db
      .select({ generation: aiGenerations, task: aiTasks })
      .from(aiGenerations)
      .innerJoin(aiTasks, eq(aiTasks.id, aiGenerations.taskId))
      .where(
        and(
          eq(aiGenerations.id, generationId),
          eq(aiGenerations.taskId, taskId),
          eq(aiGenerations.userId, userId),
          eq(aiTasks.userId, userId),
        ),
      )
      .limit(1);
    return record;
  }

  async acceptGeneration(userId: string, generationId: string, editedText: string | null) {
    const [generation] = await this.database.db
      .update(aiGenerations)
      .set({
        decision: 'accepted',
        editedText,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiGenerations.id, generationId),
          eq(aiGenerations.userId, userId),
          eq(aiGenerations.decision, 'pending'),
        ),
      )
      .returning();
    return generation;
  }

  async rejectGeneration(userId: string, generationId: string) {
    const [generation] = await this.database.db
      .update(aiGenerations)
      .set({ decision: 'rejected', decidedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(aiGenerations.id, generationId),
          eq(aiGenerations.userId, userId),
          eq(aiGenerations.decision, 'pending'),
        ),
      )
      .returning();
    return generation;
  }

  async markApplied(userId: string, taskId: string, generationId: string, resumeVersion: number) {
    await this.database.db
      .update(aiGenerations)
      .set({ appliedAt: new Date(), appliedResumeVersion: resumeVersion, updatedAt: new Date() })
      .where(
        and(
          eq(aiGenerations.id, generationId),
          eq(aiGenerations.taskId, taskId),
          eq(aiGenerations.userId, userId),
        ),
      );
  }

  async completeIfDecided(userId: string, taskId: string) {
    const pending = await this.database.db
      .select({ id: aiGenerations.id })
      .from(aiGenerations)
      .where(
        and(
          eq(aiGenerations.taskId, taskId),
          eq(aiGenerations.userId, userId),
          eq(aiGenerations.decision, 'pending'),
        ),
      )
      .limit(1);
    if (!pending.length)
      await this.database.db
        .update(aiTasks)
        .set({ status: 'completed', progress: 100, completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(aiTasks.id, taskId), eq(aiTasks.userId, userId)));
  }

  async citationOwnershipIsValid(
    userId: string,
    generationId: string,
    suggestion: ResumeSuggestion,
  ): Promise<boolean> {
    const rows = await this.database.db
      .select()
      .from(aiCitations)
      .where(and(eq(aiCitations.generationId, generationId), eq(aiCitations.userId, userId)));
    const expected = new Set(suggestion.citations.map((citation) => citation.id));
    return rows.length === expected.size && rows.every((row) => expected.has(row.id));
  }
}
