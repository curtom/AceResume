import { Module } from '@nestjs/common';
import { EnvironmentModule } from './bootstrap/environment.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({ imports: [EnvironmentModule, HealthModule, JobsModule] })
export class AppModule {}
