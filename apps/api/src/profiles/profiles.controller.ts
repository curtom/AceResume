import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CreateProfileEntryRequestSchema,
  ProfileEntryListQuerySchema,
  ProfileSnapshotRequestSchema,
  ReorderProfileEntriesRequestSchema,
  UpdateProfileEntryRequestSchema,
  UpdateProfileRequestSchema,
  type CreateProfileEntryRequest,
  type ProfileEntryType,
  type ReorderProfileEntriesRequest,
  type UpdateProfileEntryRequest,
  type UpdateProfileRequest,
} from '@aceresume/contracts';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProfilesService } from './profiles.service.js';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('profile')
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly profilesService: ProfilesService) {}
  @ApiOperation({ summary: '获取当前用户基本资料' })
  @Get()
  getProfile(@CurrentUserParam() user: CurrentUser) {
    return this.profilesService.getProfile(user.id);
  }
  @ApiOperation({ summary: '按版本更新当前用户基本资料' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['baseVersion'],
      properties: {
        baseVersion: { type: 'integer', minimum: 1 },
        fullName: { type: 'string', nullable: true, maxLength: 100 },
        targetRole: { type: 'string', nullable: true, maxLength: 120 },
        email: { type: 'string', nullable: true, format: 'email' },
        phone: { type: 'string', nullable: true, maxLength: 40 },
        location: { type: 'string', nullable: true, maxLength: 120 },
        customFields: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            required: ['id', 'label', 'value'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              label: { type: 'string', maxLength: 80 },
              value: { type: 'string', maxLength: 300 },
            },
          },
        },
        selfEvaluation: { type: 'string', nullable: true, maxLength: 2000 },
      },
    },
  })
  @Put()
  updateProfile(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) input: UpdateProfileRequest,
  ) {
    return this.profilesService.updateProfile(user.id, input);
  }
  @ApiOperation({ summary: '分页获取指定类型的资料条目' })
  @ApiQuery({ name: 'type', enum: ['education', 'project', 'experience', 'skill'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @Get('entries')
  listEntries(
    @CurrentUserParam() user: CurrentUser,
    @Query(new ZodValidationPipe(ProfileEntryListQuerySchema))
    query: { type: ProfileEntryType; page: number; pageSize: number },
  ) {
    return this.profilesService.listEntries(user.id, query.type, query.page, query.pageSize);
  }
  @ApiOperation({ summary: '创建资料条目；content 由 type 对应的共享 Schema 校验' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'content'],
      properties: {
        type: { type: 'string', enum: ['education', 'project', 'experience', 'skill'] },
        content: { type: 'object', description: '带 schemaVersion=1 的类型化资料内容' },
      },
    },
  })
  @Post('entries')
  createEntry(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(CreateProfileEntryRequestSchema)) input: CreateProfileEntryRequest,
  ) {
    return this.profilesService.createEntry(user.id, input);
  }
  @ApiOperation({ summary: '按版本更新当前用户资料条目' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['baseVersion', 'content'],
      properties: {
        baseVersion: { type: 'integer', minimum: 1 },
        content: { type: 'object', description: '必须匹配条目现有类型的共享 Schema' },
      },
    },
  })
  @Put('entries/:id')
  updateEntry(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProfileEntryRequestSchema)) input: UpdateProfileEntryRequest,
  ) {
    return this.profilesService.updateEntry(user.id, id, input);
  }
  @ApiOperation({ summary: '软删除当前用户资料条目' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Delete('entries/:id')
  @HttpCode(HttpStatus.OK)
  deleteEntry(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profilesService.deleteEntry(user.id, id);
  }
  @ApiOperation({ summary: '提交完整有序 ID 列表并按版本重排同类条目' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'orderedIds', 'versions'],
      properties: {
        type: { type: 'string', enum: ['education', 'project', 'experience', 'skill'] },
        orderedIds: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } },
        versions: { type: 'object', additionalProperties: { type: 'integer', minimum: 1 } },
      },
    },
  })
  @Post('entries/reorder')
  @HttpCode(HttpStatus.OK)
  reorderEntries(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(ReorderProfileEntriesRequestSchema))
    input: ReorderProfileEntriesRequest,
  ) {
    return this.profilesService.reorderEntries(user.id, input);
  }
  @ApiOperation({ summary: '从所选资料条目创建不可变简历输入快照' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['entryIds'],
      properties: {
        entryIds: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } },
      },
    },
  })
  @Post('snapshot')
  @HttpCode(HttpStatus.OK)
  createSnapshot(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(ProfileSnapshotRequestSchema)) input: { entryIds: string[] },
  ) {
    return this.profilesService.createSnapshot(user.id, input.entryIds);
  }
}
