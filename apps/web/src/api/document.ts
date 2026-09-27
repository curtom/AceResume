import {
  ConfirmDocumentImportResultSchema,
  DocumentDetailSchema,
  DocumentPageSchema,
  DocumentSummarySchema,
  MessageDataSchema,
  createApiSuccessSchema,
  type ConfirmDocumentImportRequest,
  type ConfirmDocumentImportResult,
  type DocumentDetail,
  type DocumentPage,
  type DocumentPurpose,
  type DocumentSummary,
} from '@aceresume/contracts';
import { http } from './http';

const pageResponse = createApiSuccessSchema(DocumentPageSchema);
const summaryResponse = createApiSuccessSchema(DocumentSummarySchema);
const detailResponse = createApiSuccessSchema(DocumentDetailSchema);
const confirmResponse = createApiSuccessSchema(ConfirmDocumentImportResultSchema);
const messageResponse = createApiSuccessSchema(MessageDataSchema);

export async function listDocuments(page = 1): Promise<DocumentPage> {
  return pageResponse.parse((await http.get('/documents', { params: { page, pageSize: 12 } })).data)
    .data;
}
export async function getDocument(id: string): Promise<DocumentDetail> {
  return detailResponse.parse((await http.get(`/documents/${id}`)).data).data;
}
export async function uploadDocument(
  file: File,
  purpose: DocumentPurpose,
): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', purpose);
  return summaryResponse.parse((await http.post('/documents', form)).data).data;
}
export async function confirmImport(
  id: string,
  input: ConfirmDocumentImportRequest,
): Promise<ConfirmDocumentImportResult> {
  return confirmResponse.parse((await http.post(`/documents/${id}/confirm-import`, input)).data)
    .data;
}
export async function reparseDocument(id: string): Promise<DocumentSummary> {
  return summaryResponse.parse((await http.post('/documents/' + id + '/reparse')).data).data;
}
export async function deleteDocument(id: string): Promise<string> {
  return messageResponse.parse((await http.delete(`/documents/${id}`)).data).data.message;
}
export async function downloadDocument(document: DocumentSummary): Promise<void> {
  const response = await http.get<Blob>(`/documents/${document.id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
