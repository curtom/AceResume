import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { TemplatesModule } from '../templates/templates.module.js';
import { ResumesController } from './resumes.controller.js';
import { ResumesRepository } from './resumes.repository.js';
import { ResumesService } from './resumes.service.js';

@Module({
  imports: [AuthModule, ProfilesModule, TemplatesModule],
  controllers: [ResumesController],
  providers: [ResumesRepository, ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
