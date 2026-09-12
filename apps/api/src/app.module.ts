import { Module } from '@nestjs/common';
import { EnvironmentModule } from './bootstrap/environment.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { DatabaseModule } from './infrastructure/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';

@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    HealthModule,
    JobsModule,
    AuthModule,
    ProfilesModule,
  ],
})
export class AppModule {}
