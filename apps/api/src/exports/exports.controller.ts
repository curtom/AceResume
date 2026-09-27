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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateExportRequestSchema, type CreateExportRequest } from '@aceresume/contracts';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ExportsService } from './exports.service.js';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class ExportsController {
  constructor(@Inject(ExportsService) private readonly service: ExportsService) {}

  @Post('resumes/:resumeId/exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '创建异步 PDF 导出任务' })
  create(
    @CurrentUserParam() user: CurrentUser,
    @Param('resumeId', ParseUUIDPipe) resumeId: string,
    @Body(new ZodValidationPipe(CreateExportRequestSchema)) input: CreateExportRequest,
  ) {
    return this.service.create(user.id, resumeId, input);
  }

  @Get('exports/:id')
  @ApiOperation({ summary: '查询 PDF 导出任务' })
  get(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.id, id);
  }

  @Get('exports/:id/download')
  @ApiOperation({ summary: '下载当前用户已完成的 PDF' })
  download(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.download(user.id, id);
  }
}
