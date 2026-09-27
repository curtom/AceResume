import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service.js';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly service: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: '获取已发布的公共模板' })
  list() {
    return this.service.list();
  }
}
