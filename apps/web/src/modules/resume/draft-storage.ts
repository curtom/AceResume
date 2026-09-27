import { ResumeDocumentSchema, type ResumeDocument } from '@aceresume/resume-schema';

export type ResumeDraft = {
  resumeId: string;
  baseVersion: number;
  document: ResumeDocument;
  updatedAt: string;
};
const DATABASE_NAME = 'aceresume-local';
const STORE_NAME = 'resume-drafts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'resumeId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}
export async function readResumeDraft(resumeId: string): Promise<ResumeDraft | null> {
  const value: unknown = await transact('readonly', (store) => store.get(resumeId));
  if (
    !value ||
    typeof value !== 'object' ||
    !('baseVersion' in value) ||
    !('updatedAt' in value) ||
    !('document' in value)
  )
    return null;
  const document = ResumeDocumentSchema.safeParse(value.document);
  return document.success &&
    typeof value.baseVersion === 'number' &&
    typeof value.updatedAt === 'string'
    ? {
        resumeId,
        baseVersion: value.baseVersion,
        updatedAt: value.updatedAt,
        document: document.data,
      }
    : null;
}
export async function writeResumeDraft(draft: ResumeDraft): Promise<void> {
  await transact('readwrite', (store) => store.put(draft));
}
export async function deleteResumeDraft(resumeId: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(resumeId));
}
