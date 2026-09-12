import {
  ProfileEntryPageSchema,
  ProfileEntrySchema,
  ProfileSchema,
  ProfileSnapshotSchema,
  type CreateProfileEntryRequest,
  type Profile,
  type ProfileEntry,
  type ProfileEntryPage,
  type ProfileEntryType,
  type ReorderProfileEntriesRequest,
  type UpdateProfileEntryRequest,
  type UpdateProfileRequest,
} from '@aceresume/contracts';
import { http } from './http';

export async function getProfile(): Promise<Profile> {
  return ProfileSchema.parse((await http.get('/profile')).data.data);
}
export async function updateProfile(input: UpdateProfileRequest): Promise<Profile> {
  return ProfileSchema.parse((await http.put('/profile', input)).data.data);
}
export async function listEntries(type: ProfileEntryType, page = 1): Promise<ProfileEntryPage> {
  return ProfileEntryPageSchema.parse(
    (await http.get('/profile/entries', { params: { type, page, pageSize: 20 } })).data.data,
  );
}
export async function createEntry(input: CreateProfileEntryRequest): Promise<ProfileEntry> {
  return ProfileEntrySchema.parse((await http.post('/profile/entries', input)).data.data);
}
export async function updateEntry(
  id: string,
  input: UpdateProfileEntryRequest,
): Promise<ProfileEntry> {
  return ProfileEntrySchema.parse((await http.put(`/profile/entries/${id}`, input)).data.data);
}
export async function deleteEntry(id: string): Promise<void> {
  await http.delete(`/profile/entries/${id}`);
}
export async function reorderEntries(input: ReorderProfileEntriesRequest): Promise<ProfileEntry[]> {
  return ProfileEntrySchema.array().parse(
    (await http.post('/profile/entries/reorder', input)).data.data,
  );
}
export async function createSnapshot(entryIds: string[]) {
  return ProfileSnapshotSchema.parse(
    (await http.post('/profile/snapshot', { entryIds })).data.data,
  );
}
