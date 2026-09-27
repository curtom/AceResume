import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ResumesModule } from '../resumes/resumes.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsRepository } from './exports.repository.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [AuthModule, JobsModule, ResumesModule],
  controllers: [ExportsController],
  providers: [ExportsRepository, ExportsService],
})
export class ExportsModule {}
