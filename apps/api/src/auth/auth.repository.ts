import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DatabaseService } from '../infrastructure/database.service.js';
import {
  emailVerificationTokens,
  passwordResetTokens,
  profiles,
  users,
  userSessions,
} from '../infrastructure/schema.js';

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findUserByEmail(email: string) {
    return this.database.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  findUserById(id: string) {
    return this.database.db.query.users.findFirst({ where: eq(users.id, id) });
  }

  findActiveSession(id: string, userId: string, now: Date) {
    return this.database.db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.id, id),
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, now),
      ),
    });
  }

  async createUser(input: {
    id: string;
    email: string;
    passwordHash: string;
    verificationToken: {
      id: string;
      hash: string;
      expiresAt: Date;
    } | null;
  }) {
    return this.database.db.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({ id: input.id, email: input.email, passwordHash: input.passwordHash })
        .returning();
      if (!user) throw new Error('User insert failed.');
      await transaction.insert(profiles).values({ userId: user.id, email: user.email });
      if (input.verificationToken)
        await transaction.insert(emailVerificationTokens).values({
          id: input.verificationToken.id,
          userId: user.id,
          tokenHash: input.verificationToken.hash,
          expiresAt: input.verificationToken.expiresAt,
        });
      return user;
    });
  }

  async verifyEmail(tokenHash: string, now: Date): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const token = await transaction.query.emailVerificationTokens.findFirst({
        where: and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      });
      if (!token) return false;
      const [used] = await transaction
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(
          and(eq(emailVerificationTokens.id, token.id), isNull(emailVerificationTokens.usedAt)),
        )
        .returning({ id: emailVerificationTokens.id });
      if (!used) return false;
      await transaction
        .update(users)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, token.userId));
      return true;
    });
  }

  async createPasswordResetToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.db.insert(passwordResetTokens).values(input);
  }

  async resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const token = await transaction.query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      });
      if (!token) return false;
      const [used] = await transaction
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.id, token.id), isNull(passwordResetTokens.usedAt)))
        .returning({ id: passwordResetTokens.id });
      if (!used) return false;
      await transaction
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, token.userId));
      await transaction
        .update(userSessions)
        .set({ revokedAt: now })
        .where(and(eq(userSessions.userId, token.userId), isNull(userSessions.revokedAt)));
      return true;
    });
  }

  async createSession(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceInfo: string | null;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.db.insert(userSessions).values(input);
  }

  async rotateSession(oldHash: string, newHash: string, expiresAt: Date, now: Date) {
    return this.database.db.transaction(async (transaction) => {
      const session = await transaction.query.userSessions.findFirst({
        where: and(
          eq(userSessions.refreshTokenHash, oldHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
        ),
      });
      if (!session) return undefined;
      const [rotated] = await transaction
        .update(userSessions)
        .set({ refreshTokenHash: newHash, expiresAt, lastUsedAt: now })
        .where(
          and(
            eq(userSessions.id, session.id),
            eq(userSessions.refreshTokenHash, oldHash),
            isNull(userSessions.revokedAt),
          ),
        )
        .returning();
      if (!rotated) return undefined;
      const user = await transaction.query.users.findFirst({ where: eq(users.id, session.userId) });
      return user && user.status === 'active' ? { session: rotated, user } : undefined;
    });
  }

  async revokeSession(refreshTokenHash: string, now: Date): Promise<void> {
    await this.database.db
      .update(userSessions)
      .set({ revokedAt: now })
      .where(
        and(eq(userSessions.refreshTokenHash, refreshTokenHash), isNull(userSessions.revokedAt)),
      );
  }
}
