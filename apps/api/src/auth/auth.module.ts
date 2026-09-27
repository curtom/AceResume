import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { JobsModule } from '../jobs/jobs.module.js';

@Module({
  imports: [JobsModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, AuthGuard, RateLimitService],
  exports: [AuthService, AuthGuard, RateLimitService],
})
export class AuthModule {}
