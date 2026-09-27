import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, JobsModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminRepository, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
