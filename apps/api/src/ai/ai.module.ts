import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ResumesModule } from '../resumes/resumes.module.js';
import { AiController } from './ai.controller.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';

@Module({
  imports: [AuthModule, JobsModule, ResumesModule],
  controllers: [AiController],
  providers: [AiRepository, AiService],
})
export class AiModule {}
