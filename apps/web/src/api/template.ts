import {
  createApiSuccessSchema,
  TemplateListSchema,
  type TemplateSummary,
} from '@aceresume/contracts';
import { http } from './http';

const responseSchema = createApiSuccessSchema(TemplateListSchema);

export async function listTemplates(): Promise<TemplateSummary[]> {
  return responseSchema.parse((await http.get('/templates')).data).data.items;
}
