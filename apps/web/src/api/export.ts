import {
  createApiSuccessSchema,
  ExportJobSchema,
  type CreateExportRequest,
  type ExportJob,
} from '@aceresume/contracts';
import { http } from './http';

const responseSchema = createApiSuccessSchema(ExportJobSchema);

export async function createExport(
  resumeId: string,
  input: CreateExportRequest,
): Promise<ExportJob> {
  return responseSchema.parse((await http.post(`/resumes/${resumeId}/exports`, input)).data).data;
}

export async function getExport(id: string): Promise<ExportJob> {
  return responseSchema.parse((await http.get(`/exports/${id}`)).data).data;
}

export async function downloadExport(job: ExportJob): Promise<void> {
  const response = await http.get<Blob>(`/exports/${job.id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = job.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
