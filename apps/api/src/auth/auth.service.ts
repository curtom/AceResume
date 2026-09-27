import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { jwtVerify, SignJWT } from 'jose';
import type { AuthSession, LoginRequest, RegisterRequest, UserSummary } from '@aceresume/contracts';
import type { ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { AppException } from '../common/app.exception.js';
import { QueueService } from '../jobs/queue.service.js';
import { AuthRepository } from './auth.repository.js';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;
const EMAIL_VERIFICATION_SECONDS = 24 * 60 * 60;
const PASSWORD_RESET_SECONDS = 30 * 60;
const ARGON2_OPTIONS = {
  type: 2,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

export type CurrentUser = UserSummary & { sessionId: string };

@Injectable()
export class AuthService {
  private readonly jwtKey: Uint8Array;

  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {
    this.jwtKey = new TextEncoder().encode(environment.AUTH_JWT_SECRET);
  }

  async register(input: RegisterRequest): Promise<{ message: string }> {
    if (await this.repository.findUserByEmail(input.email)) {
      throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT, '该邮箱已注册。');
    }
    const userId = randomUUID();
    const rawToken = this.environment.AUTH_REQUIRE_EMAIL_VERIFICATION
      ? this.createOpaqueToken()
      : null;
    const verificationToken = rawToken
      ? {
          id: randomUUID(),
          hash: this.hashToken(rawToken),
          expiresAt: this.futureDate(EMAIL_VERIFICATION_SECONDS),
        }
      : null;
    let user;
    try {
      user = await this.repository.createUser({
        id: userId,
        email: input.email,
        passwordHash: await hash(input.password, ARGON2_OPTIONS),
        verificationToken,
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT, '该邮箱已注册。');
      }
      throw error;
    }
    if (!rawToken || !verificationToken) return { message: '注册成功，现在可以登录。' };
    await this.queue.sendEmail(
      {
        to: user.email,
        subject: '验证你的 AceResume 邮箱',
        text: `请在 24 小时内完成邮箱验证：${this.environment.WEB_ORIGIN}/verify-email?token=${encodeURIComponent(rawToken)}`,
      },
      `verify-${verificationToken.id}`,
    );
    return { message: '注册成功，请前往邮箱完成验证。' };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    if (!(await this.repository.verifyEmail(this.hashToken(rawToken), new Date()))) {
      throw new AppException(
        'INVALID_OR_EXPIRED_TOKEN',
        HttpStatus.BAD_REQUEST,
        '验证链接无效或已过期。',
      );
    }
    return { message: '邮箱验证成功，现在可以登录。' };
  }

  async login(
    input: LoginRequest,
    deviceInfo: string | null,
  ): Promise<AuthSession & { refreshToken: string }> {
    const user = await this.repository.findUserByEmail(input.email);
    const isPasswordValid = user
      ? await verify(user.passwordHash, input.password)
      : await this.consumeDummyHash(input.password);
    if (!user || !isPasswordValid || user.status !== 'active') {
      throw new AppException('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED, '邮箱或密码错误。');
    }
    if (this.environment.AUTH_REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt) {
      throw new AppException('EMAIL_NOT_VERIFIED', HttpStatus.FORBIDDEN, '请先完成邮箱验证。');
    }
    return this.createSession(user, deviceInfo);
  }

  async refresh(rawToken: string | undefined): Promise<AuthSession & { refreshToken: string }> {
    if (!rawToken) throw this.sessionExpired();
    const replacement = this.createOpaqueToken();
    const result = await this.repository.rotateSession(
      this.hashToken(rawToken),
      this.hashToken(replacement),
      this.futureDate(REFRESH_TOKEN_SECONDS),
      new Date(),
    );
    if (!result) throw this.sessionExpired();
    return {
      accessToken: await this.signAccessToken(result.user.id, result.session.id),
      refreshToken: replacement,
      user: this.toUserSummary(result.user),
    };
  }

  async logout(rawToken: string | undefined): Promise<{ message: string }> {
    if (rawToken) await this.repository.revokeSession(this.hashToken(rawToken), new Date());
    return { message: '已安全退出。' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.repository.findUserByEmail(email);
    if (user?.emailVerifiedAt && user.status === 'active') {
      const tokenId = randomUUID();
      const rawToken = this.createOpaqueToken();
      await this.repository.createPasswordResetToken({
        id: tokenId,
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: this.futureDate(PASSWORD_RESET_SECONDS),
      });
      await this.queue.sendEmail(
        {
          to: user.email,
          subject: '重置你的 AceResume 密码',
          text: `请在 30 分钟内重置密码：${this.environment.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(rawToken)}`,
        },
        `reset-${tokenId}`,
      );
    }
    return { message: '如果该邮箱已注册，重置邮件将很快送达。' };
  }

  async resetPassword(rawToken: string, password: string): Promise<{ message: string }> {
    const changed = await this.repository.resetPassword(
      this.hashToken(rawToken),
      await hash(password, ARGON2_OPTIONS),
      new Date(),
    );
    if (!changed)
      throw new AppException(
        'INVALID_OR_EXPIRED_TOKEN',
        HttpStatus.BAD_REQUEST,
        '重置链接无效或已过期。',
      );
    return { message: '密码已更新，请重新登录。' };
  }

  async verifyAccessToken(token: string): Promise<CurrentUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwtKey, {
        issuer: 'aceresume',
        audience: 'aceresume-web',
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw new Error('Invalid claims.');
      const [user, session] = await Promise.all([
        this.repository.findUserById(payload.sub),
        this.repository.findActiveSession(payload.sid, payload.sub, new Date()),
      ]);
      if (
        !user ||
        !session ||
        user.status !== 'active' ||
        (this.environment.AUTH_REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt)
      )
        throw new Error('Invalid user.');
      return { ...this.toUserSummary(user), sessionId: payload.sid };
    } catch {
      throw new AppException(
        'SESSION_EXPIRED',
        HttpStatus.UNAUTHORIZED,
        '登录状态已过期，请重新登录。',
      );
    }
  }

  async verifyPasswordForUser(userId: string, password: string): Promise<boolean> {
    const user = await this.repository.findUserById(userId);
    return Boolean(user && user.status === 'active' && (await verify(user.passwordHash, password)));
  }

  private async createSession(
    user: NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>,
    deviceInfo: string | null,
  ) {
    const sessionId = randomUUID();
    const refreshToken = this.createOpaqueToken();
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      deviceInfo,
      expiresAt: this.futureDate(REFRESH_TOKEN_SECONDS),
    });
    return {
      accessToken: await this.signAccessToken(user.id, sessionId),
      refreshToken,
      user: this.toUserSummary(user),
    };
  }

  private signAccessToken(userId: string, sessionId: string): Promise<string> {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('aceresume')
      .setAudience('aceresume-web')
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(this.jwtKey);
  }

  private toUserSummary(
    user: NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>,
  ): UserSummary {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private futureDate(seconds: number): Date {
    return new Date(Date.now() + seconds * 1_000);
  }
  private sessionExpired(): AppException {
    return new AppException(
      'SESSION_EXPIRED',
      HttpStatus.UNAUTHORIZED,
      '登录状态已过期，请重新登录。',
    );
  }

  private async consumeDummyHash(password: string): Promise<boolean> {
    await hash(password, ARGON2_OPTIONS);
    return false;
  }
}
