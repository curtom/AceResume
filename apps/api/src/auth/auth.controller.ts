import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  TokenRequestSchema,
  type LoginRequest,
  type RegisterRequest,
  type UserSummary,
} from '@aceresume/contracts';
import type { ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUserParam } from './current-user.decorator.js';
import { RateLimitService } from './rate-limit.service.js';

const REFRESH_COOKIE = 'aceresume_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
type HttpRequest = { ip?: string; headers: { cookie?: string; 'user-agent'?: string } };
type HttpResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: '注册账户并发送验证邮件' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 10, maxLength: 72 },
      },
    },
  })
  async register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) input: RegisterRequest,
    @Req() request: HttpRequest,
  ) {
    await this.rateLimit.consume('register', request.ip ?? 'unknown', 5, 15 * 60);
    return this.authService.register(input);
  }

  @Post('verify-email')
  @ApiOperation({ summary: '使用一次性令牌验证邮箱' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: { token: { type: 'string', minLength: 32, maxLength: 256 } },
    },
  })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body(new ZodValidationPipe(TokenRequestSchema)) input: { token: string }) {
    return this.authService.verifyEmail(input.token);
  }

  @Post('login')
  @ApiOperation({ summary: '登录并设置 Refresh Token Cookie' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 10, maxLength: 72 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) input: LoginRequest,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    await this.rateLimit.consume('login', request.ip ?? 'unknown', 10, 15 * 60);
    const { refreshToken, ...session } = await this.authService.login(
      input,
      request.headers['user-agent']?.slice(0, 500) ?? null,
    );
    this.setRefreshCookie(response, refreshToken);
    return session;
  }

  @Post('refresh')
  @ApiOperation({ summary: '轮换 Refresh Token 并签发 Access Token' })
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: HttpRequest, @Res({ passthrough: true }) response: HttpResponse) {
    await this.rateLimit.consume('refresh', request.ip ?? 'unknown', 30, 60);
    const { refreshToken, ...session } = await this.authService.refresh(
      this.readRefreshCookie(request),
    );
    this.setRefreshCookie(response, refreshToken);
    return session;
  }

  @Post('logout')
  @ApiOperation({ summary: '撤销当前会话' })
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: HttpRequest, @Res({ passthrough: true }) response: HttpResponse) {
    const result = await this.authService.logout(this.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return result;
  }

  @Post('forgot-password')
  @ApiOperation({ summary: '发送限时一次性密码重置邮件' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) input: { email: string },
    @Req() request: HttpRequest,
  ) {
    await this.rateLimit.consume('forgot-password', request.ip ?? 'unknown', 5, 60 * 60);
    return this.authService.forgotPassword(input.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: '使用一次性令牌重置密码' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: {
        token: { type: 'string', minLength: 32, maxLength: 256 },
        password: { type: 'string', minLength: 10, maxLength: 72 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema))
    input: { token: string; password: string },
    @Req() request: HttpRequest,
  ) {
    await this.rateLimit.consume('reset-password', request.ip ?? 'unknown', 5, 60 * 60);
    return this.authService.resetPassword(input.token, input.password);
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户' })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  me(@CurrentUserParam() user: UserSummary): UserSummary {
    return user;
  }

  private readRefreshCookie(request: HttpRequest): string | undefined {
    return request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`))
      ?.slice(REFRESH_COOKIE.length + 1);
  }
  private setRefreshCookie(response: HttpResponse, token: string): void {
    response.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), maxAge: REFRESH_MAX_AGE_MS });
  }
  private cookieOptions(): Record<string, unknown> {
    return {
      httpOnly: true,
      secure: this.environment.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }
}
