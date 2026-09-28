import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateResumeRequestSchema,
  DuplicateResumeRequestSchema,
  ResumeListQuerySchema,
  ResumeStatusActionRequestSchema,
  SaveResumeRequestSchema,
  UpdateResumeRequestSchema,
  type CreateResumeRequest,
  type ResumeStatus,
  type SaveResumeRequest,
  type UpdateResumeRequest,
} from '@aceresume/contracts';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ResumesService } from './resumes.service.js';

@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('resumes')
export class ResumesController {
  constructor(@Inject(ResumesService) private readonly service: ResumesService) {}
  @Get() @ApiOperation({ summary: '分页获取当前用户简历' }) list(
    @CurrentUserParam() user: CurrentUser,
    @Query(new ZodValidationPipe(ResumeListQuerySchema))
    query: { status: ResumeStatus; page: number; pageSize: number },
  ) {
    return this.service.list(user.id, query.status, query.page, query.pageSize);
  }
  @Post() @ApiOperation({ summary: '从空白或个人资料创建简历' }) create(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(CreateResumeRequestSchema)) input: CreateResumeRequest,
  ) {
    return this.service.create(user.id, input);
  }
  @Get(':id') @ApiOperation({ summary: '获取简历编辑文档' }) get(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(user.id, id);
  }
  @Put(':id') @ApiOperation({ summary: '重命名或更新目标岗位' }) update(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateResumeRequestSchema)) input: UpdateResumeRequest,
  ) {
    return this.service.update(user.id, id, input);
  }
  @Post(':id/duplicate') @ApiOperation({ summary: '复制简历' }) duplicate(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DuplicateResumeRequestSchema)) input: { name?: string },
  ) {
    return this.service.duplicate(user.id, id, input.name);
  }
  @Post(':id/archive') @HttpCode(HttpStatus.OK) archive(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResumeStatusActionRequestSchema)) input: { baseVersion: number },
  ) {
    return this.service.setStatus(user.id, id, input.baseVersion, 'archived');
  }
  @Post(':id/unarchive') @HttpCode(HttpStatus.OK) unarchive(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResumeStatusActionRequestSchema)) input: { baseVersion: number },
  ) {
    return this.service.setStatus(user.id, id, input.baseVersion, 'active');
  }
  @Put(':id/document') @ApiOperation({ summary: '按版本幂等保存最新简历文档' }) save(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SaveResumeRequestSchema)) input: SaveResumeRequest,
  ) {
    return this.service.save(user.id, id, input);
  }
  @Put(':id/avatar')
  @ApiOperation({ summary: '上传或替换简历头像' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAvatar(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { size: number; buffer: Buffer } | undefined,
    @Body('baseVersion', ParseIntPipe) baseVersion: number,
  ) {
    return this.service.uploadAvatar(user.id, id, baseVersion, file);
  }
  @Delete(':id/avatar')
  removeAvatar(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('baseVersion', ParseIntPipe) baseVersion: number,
  ) {
    return this.service.removeAvatar(user.id, id, baseVersion);
  }
  @Delete(':id') @HttpCode(HttpStatus.OK) remove(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(user.id, id);
  }
}
