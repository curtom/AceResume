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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConfirmDocumentImportRequestSchema,
  DocumentListQuerySchema,
  DocumentPurposeSchema,
  type ConfirmDocumentImportRequest,
  type DocumentPurpose,
} from '@aceresume/contracts';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { RateLimitService } from '../auth/rate-limit.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DocumentsService, type UploadedDocument } from './documents.service.js';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly service: DocumentsService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}
  @Get()
  list(
    @CurrentUserParam() user: CurrentUser,
    @Query(new ZodValidationPipe(DocumentListQuerySchema))
    query: { page: number; pageSize: number },
  ) {
    return this.service.list(user.id, query.page, query.pageSize);
  }
  @Get(':id')
  get(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.id, id);
  }
  @Get(':id/download')
  async download(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.rateLimit.consume('document-download', user.id, 30, 60);
    return this.service.download(user.id, id);
  }
  @Post()
  @ApiOperation({ summary: '上传材料并异步解析' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUserParam() user: CurrentUser,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body('purpose', new ZodValidationPipe(DocumentPurposeSchema)) purpose: DocumentPurpose,
  ) {
    return this.service.upload(user.id, file, purpose);
  }
  @Post(':id/confirm-import')
  @HttpCode(HttpStatus.OK)
  confirmImport(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ConfirmDocumentImportRequestSchema))
    input: ConfirmDocumentImportRequest,
  ) {
    return this.service.confirmImport(user.id, id, input);
  }
  @Post(':id/reparse')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '重新解析旧简历并识别候选字段' })
  reparse(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reparse(user.id, id);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  remove(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.id, id);
  }
}
