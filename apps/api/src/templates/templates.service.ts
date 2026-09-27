import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { TemplateList } from '@aceresume/contracts';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@aceresume/resume-schema';
import { BUILT_IN_TEMPLATES } from '@aceresume/template-engine';
import { TemplatesRepository } from './templates.repository.js';

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(@Inject(TemplatesRepository) private readonly repository: TemplatesRepository) {}

  async onModuleInit(): Promise<void> {
    await this.repository.insertBuiltIns(BUILT_IN_TEMPLATES);
  }

  async list(): Promise<TemplateList> {
    const definitions = await this.repository.listPublished();
    return {
      items: definitions.map((definition) => TemplateDefinitionSchema.parse(definition)),
    };
  }

  async getDefinition(versionId: string): Promise<TemplateDefinition | undefined> {
    const definition = await this.repository.findVersion(versionId, false);
    return definition ? TemplateDefinitionSchema.parse(definition) : undefined;
  }

  async getPublishedDefinition(versionId: string): Promise<TemplateDefinition | undefined> {
    const definition = await this.repository.findVersion(versionId, true);
    return definition ? TemplateDefinitionSchema.parse(definition) : undefined;
  }
}
