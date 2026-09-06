import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type HealthData } from '@aceresume/contracts';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'Returns the application and local dependency status.' })
  getHealth(): Promise<HealthData> {
    return this.healthService.getStatus();
  }
}
