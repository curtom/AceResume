import {
  createApiSuccessSchema,
  MessageDataSchema,
  ResumeDetailSchema,
  ResumePageSchema,
  type CreateResumeRequest,
  type ResumeDetail,
  type ResumePage,
  type ResumeStatus,
  type SaveResumeRequest,
  type UpdateResumeRequest,
} from '@aceresume/contracts';
import { http } from './http';

const detailResponse = createApiSuccessSchema(ResumeDetailSchema);
const pageResponse = createApiSuccessSchema(ResumePageSchema);
const messageResponse = createApiSuccessSchema(MessageDataSchema);

export async function listResumes(status: ResumeStatus, page = 1): Promise<ResumePage> {
  return pageResponse.parse(
    (await http.get('/resumes', { params: { status, page, pageSize: 12 } })).data,
  ).data;
}
export async function getResume(id: string): Promise<ResumeDetail> {
  return detailResponse.parse((await http.get(`/resumes/${id}`)).data).data;
}
export async function createResume(input: CreateResumeRequest): Promise<ResumeDetail> {
  return detailResponse.parse((await http.post('/resumes', input)).data).data;
}
export async function updateResume(id: string, input: UpdateResumeRequest): Promise<ResumeDetail> {
  return detailResponse.parse((await http.put(`/resumes/${id}`, input)).data).data;
}
export async function duplicateResume(id: string, name?: string): Promise<ResumeDetail> {
  return detailResponse.parse(
    (await http.post(`/resumes/${id}/duplicate`, name ? { name } : {})).data,
  ).data;
}
export async function setResumeArchived(
  id: string,
  baseVersion: number,
  archived: boolean,
): Promise<ResumeDetail> {
  return detailResponse.parse(
    (await http.post(`/resumes/${id}/${archived ? 'archive' : 'unarchive'}`, { baseVersion })).data,
  ).data;
}
export async function saveResume(id: string, input: SaveResumeRequest): Promise<ResumeDetail> {
  return detailResponse.parse((await http.put(`/resumes/${id}/document`, input)).data).data;
}
export async function uploadResumeAvatar(
  id: string,
  baseVersion: number,
  file: File,
): Promise<ResumeDetail> {
  const form = new FormData();
  form.append('file', file);
  form.append('baseVersion', String(baseVersion));
  return detailResponse.parse((await http.put(`/resumes/${id}/avatar`, form)).data).data;
}
export async function removeResumeAvatar(id: string, baseVersion: number): Promise<ResumeDetail> {
  return detailResponse.parse(
    (await http.delete(`/resumes/${id}/avatar`, { data: { baseVersion } })).data,
  ).data;
}
export async function deleteResume(id: string): Promise<string> {
  return messageResponse.parse((await http.delete(`/resumes/${id}`)).data).data.message;
}
