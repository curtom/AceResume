import {
  AdminAuditPageSchema,
  AdminModelConfigSchema,
  AdminMonitoringSchema,
  AdminPromptListSchema,
  AdminPromptTestResultSchema,
  AdminTemplateListSchema,
  AdminUserPageSchema,
  MessageDataSchema,
  createApiSuccessSchema,
  type AdminActivatePrompt,
  type AdminAuditPage,
  type AdminCreatePrompt,
  type AdminModelConfig,
  type AdminMonitoring,
  type AdminPromptTestResult,
  type AdminPromptVersion,
  type AdminSaveTemplate,
  type AdminTemplateVersion,
  type AdminUpdateModelConfig,
  type AdminUpdateUserStatus,
  type AdminUserPage,
} from '@aceresume/contracts';
import type { TemplateDefinition } from '@aceresume/resume-schema';
import { http } from './http';

const usersResponse = createApiSuccessSchema(AdminUserPageSchema);
const templatesResponse = createApiSuccessSchema(AdminTemplateListSchema);
const modelResponse = createApiSuccessSchema(AdminModelConfigSchema);
const promptsResponse = createApiSuccessSchema(AdminPromptListSchema);
const promptTestResponse = createApiSuccessSchema(AdminPromptTestResultSchema);
const monitoringResponse = createApiSuccessSchema(AdminMonitoringSchema);
const auditResponse = createApiSuccessSchema(AdminAuditPageSchema);
const messageResponse = createApiSuccessSchema(MessageDataSchema);

export async function listAdminUsers(search = '', page = 1): Promise<AdminUserPage> {
  return usersResponse.parse(
    (await http.get('/admin/users', { params: { search, page, pageSize: 20 } })).data,
  ).data;
}
export async function updateAdminUserStatus(id: string, input: AdminUpdateUserStatus) {
  return messageResponse.parse((await http.put(`/admin/users/${id}/status`, input)).data).data;
}
export async function listAdminTemplates(): Promise<AdminTemplateVersion[]> {
  return templatesResponse.parse((await http.get('/admin/templates')).data).data.items;
}
export async function testAdminTemplate(definition: TemplateDefinition) {
  return (await http.post('/admin/templates/test', definition)).data.data as {
    valid: true;
    htmlBytes: number;
  };
}
export async function saveAdminTemplate(input: AdminSaveTemplate, versionId?: string) {
  const response = versionId
    ? await http.put(`/admin/templates/versions/${versionId}`, input)
    : await http.post('/admin/templates/versions', input);
  return messageResponse.parse(response.data).data;
}
export async function changeAdminTemplateStatus(
  versionId: string,
  status: 'publish' | 'retire',
  input: { password: string; reason: string },
) {
  return messageResponse.parse(
    (await http.post(`/admin/templates/versions/${versionId}/${status}`, input)).data,
  ).data;
}
export async function getAdminModelConfig(): Promise<AdminModelConfig> {
  return modelResponse.parse((await http.get('/admin/model-config')).data).data;
}
export async function updateAdminModelConfig(
  input: AdminUpdateModelConfig,
): Promise<AdminModelConfig> {
  return modelResponse.parse((await http.put('/admin/model-config', input)).data).data;
}
export async function listAdminPrompts(): Promise<AdminPromptVersion[]> {
  return promptsResponse.parse((await http.get('/admin/prompts')).data).data.items;
}
export async function testAdminPrompt(content: string): Promise<AdminPromptTestResult> {
  return promptTestResponse.parse((await http.post('/admin/prompts/test', { content })).data).data;
}
export async function createAdminPrompt(input: AdminCreatePrompt) {
  return (await http.post('/admin/prompts', input)).data.data as { id: string; version: number };
}
export async function activateAdminPrompt(id: string, input: AdminActivatePrompt) {
  return messageResponse.parse((await http.post(`/admin/prompts/${id}/activate`, input)).data).data;
}
export async function getAdminMonitoring(): Promise<AdminMonitoring> {
  return monitoringResponse.parse((await http.get('/admin/monitoring')).data).data;
}
export async function listAdminAudit(page = 1): Promise<AdminAuditPage> {
  return auditResponse.parse(
    (await http.get('/admin/audit-logs', { params: { page, pageSize: 30, search: '' } })).data,
  ).data;
}
