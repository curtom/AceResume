import { Module } from '@nestjs/common';
import { ObjectStorageAdapter } from '../adapters/object-storage.adapter.js';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ResumesModule } from '../resumes/resumes.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsRepository } from './documents.repository.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [AuthModule, JobsModule, ProfilesModule, ResumesModule],
  controllers: [DocumentsController],
  providers: [DocumentsRepository, DocumentsService, ObjectStorageAdapter],
})
export class DocumentsModule {}
