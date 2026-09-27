import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { TemplateDefinition } from '@aceresume/resume-schema';
import { DatabaseService } from '../infrastructure/database.service.js';
import { templateVersions, templates } from '../infrastructure/schema.js';

@Injectable()
export class TemplatesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async insertBuiltIns(definitions: readonly TemplateDefinition[]): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      for (const definition of definitions) {
        await transaction
          .insert(templates)
          .values({
            id: definition.id,
            name: definition.name,
            description: definition.description,
            category: definition.category,
            layout: definition.layout,
            isPublic: true,
          })
          .onConflictDoNothing();
        await transaction
          .insert(templateVersions)
          .values({
            id: definition.versionId,
            templateId: definition.id,
            version: definition.version,
            status: 'published',
            definition,
            publishedAt: new Date(),
          })
          .onConflictDoNothing();
      }
    });
  }

  async listPublished(): Promise<TemplateDefinition[]> {
    const rows = await this.database.db
      .select({ definition: templateVersions.definition })
      .from(templateVersions)
      .innerJoin(templates, eq(templateVersions.templateId, templates.id))
      .where(eq(templateVersions.status, 'published'))
      .orderBy(asc(templates.createdAt));
    return rows.map((row) => row.definition);
  }

  async findVersion(
    versionId: string,
    publishedOnly: boolean,
  ): Promise<TemplateDefinition | undefined> {
    const [row] = await this.database.db
      .select({ definition: templateVersions.definition })
      .from(templateVersions)
      .where(
        publishedOnly
          ? and(eq(templateVersions.id, versionId), eq(templateVersions.status, 'published'))
          : eq(templateVersions.id, versionId),
      )
      .limit(1);
    return row?.definition;
  }
}
