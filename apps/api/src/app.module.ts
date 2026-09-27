import { Module } from '@nestjs/common';
import { EnvironmentModule } from './bootstrap/environment.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { DatabaseModule } from './infrastructure/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { ResumesModule } from './resumes/resumes.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AiModule } from './ai/ai.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    HealthModule,
    JobsModule,
    AuthModule,
    ProfilesModule,
    TemplatesModule,
    ResumesModule,
    ExportsModule,
    DocumentsModule,
    AiModule,
    AdminModule,
  ],
})
export class AppModule {}
