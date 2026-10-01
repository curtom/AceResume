import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, max } from 'drizzle-orm';
import type {
  CreateProfileEntryRequest,
  ProfileEntryType,
  UpdateProfileRequest,
} from '@aceresume/contracts';
import { DatabaseService } from '../infrastructure/database.service.js';
import { profileEntries, profiles } from '../infrastructure/schema.js';

export class ProfileVersionConflictError extends Error {}

@Injectable()
export class ProfilesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  getProfile(userId: string) {
    return this.database.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  }

  async updateProfile(userId: string, input: UpdateProfileRequest) {
    const { baseVersion, selfEvaluation, ...values } = input;
    const [profile] = await this.database.db
      .update(profiles)
      .set({ ...values, summary: selfEvaluation, version: baseVersion + 1, updatedAt: new Date() })
      .where(and(eq(profiles.userId, userId), eq(profiles.version, baseVersion)))
      .returning();
    return profile;
  }

  async listEntries(userId: string, type: ProfileEntryType, page: number, pageSize: number) {
    const where = and(
      eq(profileEntries.userId, userId),
      eq(profileEntries.type, type),
      isNull(profileEntries.deletedAt),
    );
    const [items, totals] = await Promise.all([
      this.database.db
        .select()
        .from(profileEntries)
        .where(where)
        .orderBy(asc(profileEntries.sortOrder), asc(profileEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.database.db.select({ value: count() }).from(profileEntries).where(where),
    ]);
    return { items, total: totals[0]?.value ?? 0 };
  }

  async createEntry(userId: string, profileId: string, input: CreateProfileEntryRequest) {
    return this.database.db.transaction(async (transaction) => {
      const [last] = await transaction
        .select({ value: max(profileEntries.sortOrder) })
        .from(profileEntries)
        .where(
          and(
            eq(profileEntries.userId, userId),
            eq(profileEntries.type, input.type),
            isNull(profileEntries.deletedAt),
          ),
        );
      const [entry] = await transaction
        .insert(profileEntries)
        .values({
          userId,
          profileId,
          type: input.type,
          content: input.content,
          sortOrder: (last?.value ?? -1) + 1,
        })
        .returning();
      return entry;
    });
  }

  findEntry(userId: string, id: string) {
    return this.database.db.query.profileEntries.findFirst({
      where: and(
        eq(profileEntries.id, id),
        eq(profileEntries.userId, userId),
        isNull(profileEntries.deletedAt),
      ),
    });
  }

  async updateEntry(
    userId: string,
    id: string,
    baseVersion: number,
    content: typeof profileEntries.$inferInsert.content,
  ) {
    const [entry] = await this.database.db
      .update(profileEntries)
      .set({ content, version: baseVersion + 1, updatedAt: new Date() })
      .where(
        and(
          eq(profileEntries.id, id),
          eq(profileEntries.userId, userId),
          eq(profileEntries.version, baseVersion),
          isNull(profileEntries.deletedAt),
        ),
      )
      .returning();
    return entry;
  }

  async deleteEntry(userId: string, id: string): Promise<boolean> {
    const [entry] = await this.database.db
      .update(profileEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(profileEntries.id, id),
          eq(profileEntries.userId, userId),
          isNull(profileEntries.deletedAt),
        ),
      )
      .returning({ id: profileEntries.id });
    return Boolean(entry);
  }

  async reorderEntries(
    userId: string,
    type: ProfileEntryType,
    orderedIds: string[],
    versions: Record<string, number>,
  ) {
    return this.database.db.transaction(async (transaction) => {
      const current = await transaction
        .select()
        .from(profileEntries)
        .where(
          and(
            eq(profileEntries.userId, userId),
            eq(profileEntries.type, type),
            isNull(profileEntries.deletedAt),
          ),
        );
      if (
        current.length !== orderedIds.length ||
        current.some(
          (entry) => !orderedIds.includes(entry.id) || versions[entry.id] !== entry.version,
        )
      )
        throw new ProfileVersionConflictError();
      for (const [sortOrder, id] of orderedIds.entries()) {
        const version = versions[id];
        if (version === undefined) throw new ProfileVersionConflictError();
        const [updated] = await transaction
          .update(profileEntries)
          .set({ sortOrder, version: version + 1, updatedAt: new Date() })
          .where(
            and(
              eq(profileEntries.id, id),
              eq(profileEntries.userId, userId),
              eq(profileEntries.version, version),
            ),
          )
          .returning({ id: profileEntries.id });
        if (!updated) throw new ProfileVersionConflictError();
      }
      return transaction
        .select()
        .from(profileEntries)
        .where(
          and(
            eq(profileEntries.userId, userId),
            eq(profileEntries.type, type),
            isNull(profileEntries.deletedAt),
          ),
        )
        .orderBy(asc(profileEntries.sortOrder));
    });
  }

  async getEntriesByIds(userId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return this.database.db
      .select()
      .from(profileEntries)
      .where(
        and(
          eq(profileEntries.userId, userId),
          inArray(profileEntries.id, ids),
          isNull(profileEntries.deletedAt),
        ),
      )
      .orderBy(asc(profileEntries.type), asc(profileEntries.sortOrder));
  }
}
