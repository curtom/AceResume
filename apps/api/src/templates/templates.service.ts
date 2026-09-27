import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { TemplateList } from '@aceresume/contracts';
import { TemplateDefinitionSchema, type TemplateDefinition } from '@aceresume/resume-schema';
import { BUILT_IN_TEMPLATES, getTemplateDefinition } from '@aceresume/template-engine';
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
      items: definitions.map((definition) => {
        const parsed = TemplateDefinitionSchema.parse(definition);
        return {
          id: parsed.id,
          version: parsed.version,
          versionId: parsed.versionId,
          name: parsed.name,
          description: parsed.description,
          category: parsed.category,
          layout: parsed.layout,
          supportedLocales: parsed.supportedLocales,
          supportedSections: parsed.supportedSections,
          defaultTheme: parsed.defaultTheme,
          pagination: parsed.pagination,
          visualStyle: parsed.visualStyle,
        };
      }),
    };
  }

  getDefinition(versionId: string): TemplateDefinition | undefined {
    return getTemplateDefinition(versionId);
  }
}
