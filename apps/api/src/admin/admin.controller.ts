import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminActivatePromptSchema,
  AdminCreatePromptSchema,
  AdminListQuerySchema,
  AdminSaveTemplateSchema,
  AdminSensitiveActionSchema,
  AdminTestPromptSchema,
  AdminUpdateModelConfigSchema,
  AdminUpdateUserStatusSchema,
  type AdminActivatePrompt,
  type AdminCreatePrompt,
  type AdminListQuery,
  type AdminSaveTemplate,
  type AdminUpdateModelConfig,
  type AdminUpdateUserStatus,
  type AdminTestPrompt,
} from '@aceresume/contracts';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@aceresume/resume-schema';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { RateLimitService } from '../auth/rate-limit.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

type AdminRequest = { ip?: string; requestId?: string };

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly service: AdminService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: '分页搜索用户，不返回简历、材料或模型上下文' })
  async users(
    @CurrentUserParam() admin: CurrentUser,
    @Query(new ZodValidationPipe(AdminListQuerySchema)) query: AdminListQuery,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request);
    return this.service.listUsers(query);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: '重新验证管理员密码后禁用或恢复用户' })
  async updateUserStatus(
    @CurrentUserParam() admin: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminUpdateUserStatusSchema)) input: AdminUpdateUserStatus,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.updateUserStatus(admin, id, input, request.requestId ?? null);
  }

  @Get('templates')
  async templates(@CurrentUserParam() admin: CurrentUser, @Req() request: AdminRequest) {
    await this.limit(admin, request);
    return this.service.listTemplates();
  }

  @Post('templates/test')
  @HttpCode(HttpStatus.OK)
  async testTemplate(
    @CurrentUserParam() admin: CurrentUser,
    @Body(new ZodValidationPipe(TemplateDefinitionSchema)) input: TemplateDefinition,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request);
    return this.service.testTemplate(input);
  }

  @Post('templates/versions')
  async createTemplate(
    @CurrentUserParam() admin: CurrentUser,
    @Body(new ZodValidationPipe(AdminSaveTemplateSchema)) input: AdminSaveTemplate,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.saveTemplate(admin, input, request.requestId ?? null);
  }

  @Put('templates/versions/:versionId')
  async updateTemplate(
    @CurrentUserParam() admin: CurrentUser,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(AdminSaveTemplateSchema)) input: AdminSaveTemplate,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.saveTemplate(admin, input, request.requestId ?? null, versionId);
  }

  @Post('templates/versions/:versionId/publish')
  @HttpCode(HttpStatus.OK)
  async publishTemplate(
    @CurrentUserParam() admin: CurrentUser,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(AdminSensitiveActionSchema))
    input: { password: string; reason: string },
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.changeTemplateStatus(
      admin,
      versionId,
      'published',
      input,
      request.requestId ?? null,
    );
  }

  @Post('templates/versions/:versionId/retire')
  @HttpCode(HttpStatus.OK)
  async retireTemplate(
    @CurrentUserParam() admin: CurrentUser,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(AdminSensitiveActionSchema))
    input: { password: string; reason: string },
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.changeTemplateStatus(
      admin,
      versionId,
      'retired',
      input,
      request.requestId ?? null,
    );
  }

  @Get('model-config')
  async modelConfig(@CurrentUserParam() admin: CurrentUser, @Req() request: AdminRequest) {
    await this.limit(admin, request);
    return this.service.getModelConfig();
  }

  @Put('model-config')
  async updateModelConfig(
    @CurrentUserParam() admin: CurrentUser,
    @Body(new ZodValidationPipe(AdminUpdateModelConfigSchema)) input: AdminUpdateModelConfig,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.updateModelConfig(admin, input, request.requestId ?? null);
  }

  @Get('prompts')
  async prompts(@CurrentUserParam() admin: CurrentUser, @Req() request: AdminRequest) {
    await this.limit(admin, request);
    return this.service.listPrompts();
  }

  @Post('prompts/test')
  @HttpCode(HttpStatus.OK)
  async testPrompt(
    @CurrentUserParam() admin: CurrentUser,
    @Body(new ZodValidationPipe(AdminTestPromptSchema)) input: AdminTestPrompt,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request);
    return this.service.testPrompt(input.content);
  }

  @Post('prompts')
  async createPrompt(
    @CurrentUserParam() admin: CurrentUser,
    @Body(new ZodValidationPipe(AdminCreatePromptSchema)) input: AdminCreatePrompt,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.createPrompt(admin, input, request.requestId ?? null);
  }

  @Post('prompts/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activatePrompt(
    @CurrentUserParam() admin: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminActivatePromptSchema)) input: AdminActivatePrompt,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request, true);
    return this.service.activatePrompt(admin, id, input, request.requestId ?? null);
  }

  @Get('monitoring')
  async monitoring(@CurrentUserParam() admin: CurrentUser, @Req() request: AdminRequest) {
    await this.limit(admin, request);
    return this.service.monitoring();
  }

  @Get('audit-logs')
  async audit(
    @CurrentUserParam() admin: CurrentUser,
    @Query(new ZodValidationPipe(AdminListQuerySchema)) query: AdminListQuery,
    @Req() request: AdminRequest,
  ) {
    await this.limit(admin, request);
    return this.service.listAudit(query);
  }

  private limit(admin: CurrentUser, request: AdminRequest, sensitive = false) {
    return this.rateLimit.consume(
      sensitive ? 'admin-sensitive' : 'admin',
      `${admin.id}:${request.ip ?? 'unknown'}`,
      sensitive ? 30 : 120,
      60,
    );
  }
}
