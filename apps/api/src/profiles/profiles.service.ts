import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EducationContentSchema,
  ExperienceContentSchema,
  ProjectContentSchema,
  SkillContentSchema,
  type CreateProfileEntryRequest,
  type Profile,
  type ProfileEntry,
  type ProfileEntryContent,
  type ProfileEntryPage,
  type ProfileEntryType,
  type ProfileSnapshot,
  type ReorderProfileEntriesRequest,
  type UpdateProfileEntryRequest,
  type UpdateProfileRequest,
} from '@aceresume/contracts';
import { AppException } from '../common/app.exception.js';
import { ProfileVersionConflictError, ProfilesRepository } from './profiles.repository.js';

@Injectable()
export class ProfilesService {
  constructor(@Inject(ProfilesRepository) private readonly repository: ProfilesRepository) {}

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.repository.getProfile(userId);
    if (!profile) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, '个人资料不存在。');
    return this.mapProfile(profile);
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<Profile> {
    const profile = await this.repository.updateProfile(userId, input);
    if (!profile) throw this.conflict();
    return this.mapProfile(profile);
  }

  async listEntries(
    userId: string,
    type: ProfileEntryType,
    page: number,
    pageSize: number,
  ): Promise<ProfileEntryPage> {
    const result = await this.repository.listEntries(userId, type, page, pageSize);
    return {
      items: result.items.map((entry) => this.mapEntry(entry)),
      page,
      pageSize,
      total: result.total,
    };
  }

  async createEntry(userId: string, input: CreateProfileEntryRequest): Promise<ProfileEntry> {
    this.validateTimeline(input.content);
    const profile = await this.repository.getProfile(userId);
    if (!profile) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, '个人资料不存在。');
    const entry = await this.repository.createEntry(userId, profile.id, input);
    if (!entry) throw new Error('Profile entry insert failed.');
    return this.mapEntry(entry);
  }

  async updateEntry(
    userId: string,
    id: string,
    input: UpdateProfileEntryRequest,
  ): Promise<ProfileEntry> {
    const current = await this.repository.findEntry(userId, id);
    if (!current) throw this.notFound();
    const content = this.parseContent(current.type, input.content);
    this.validateTimeline(content);
    const entry = await this.repository.updateEntry(userId, id, input.baseVersion, content);
    if (!entry) throw this.conflict();
    return this.mapEntry(entry);
  }

  async deleteEntry(userId: string, id: string): Promise<{ message: string }> {
    if (!(await this.repository.deleteEntry(userId, id))) throw this.notFound();
    return { message: '资料条目已删除。' };
  }

  async reorderEntries(
    userId: string,
    input: ReorderProfileEntriesRequest,
  ): Promise<ProfileEntry[]> {
    try {
      return (
        await this.repository.reorderEntries(userId, input.type, input.orderedIds, input.versions)
      ).map((entry) => this.mapEntry(entry));
    } catch (error: unknown) {
      if (error instanceof ProfileVersionConflictError) throw this.conflict();
      throw error;
    }
  }

  async createSnapshot(userId: string, entryIds: string[]): Promise<ProfileSnapshot> {
    const [profile, entries] = await Promise.all([
      this.getProfile(userId),
      this.repository.getEntriesByIds(userId, entryIds),
    ]);
    if (entries.length !== new Set(entryIds).size) throw this.notFound();
    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      profile,
      entries: entries.map((entry) => this.mapEntry(entry)),
    };
  }

  private parseContent(type: ProfileEntryType, content: ProfileEntryContent): ProfileEntryContent {
    const schemas = {
      education: EducationContentSchema,
      project: ProjectContentSchema,
      experience: ExperienceContentSchema,
      skill: SkillContentSchema,
    };
    const result = schemas[type].safeParse(content);
    if (!result.success)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '资料字段与条目类型不匹配。',
      );
    return result.data;
  }

  private validateTimeline(content: ProfileEntryContent): void {
    if (!('startDate' in content)) return;
    if (content.isCurrent && content.endDate !== null)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '进行中的经历不能填写结束时间。',
      );
    if (!content.isCurrent && content.endDate === null)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '非进行中的经历必须填写结束时间。',
      );
    if (content.endDate && content.endDate < content.startDate)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '结束时间不能早于开始时间。',
      );
  }

  private mapProfile(
    profile: NonNullable<Awaited<ReturnType<ProfilesRepository['getProfile']>>>,
  ): Profile {
    return {
      id: profile.id,
      fullName: profile.fullName,
      targetRole: profile.targetRole,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      website: profile.website,
      summary: profile.summary,
      version: profile.version,
      schemaVersion: 1,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapEntry(
    entry: NonNullable<Awaited<ReturnType<ProfilesRepository['findEntry']>>>,
  ): ProfileEntry {
    return {
      id: entry.id,
      type: entry.type,
      content: entry.content,
      sortOrder: entry.sortOrder,
      version: entry.version,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  private conflict(): AppException {
    return new AppException(
      'PROFILE_VERSION_CONFLICT',
      HttpStatus.CONFLICT,
      '资料已在其他位置更新，请刷新后重试。',
    );
  }
  private notFound(): AppException {
    return new AppException('PROFILE_ENTRY_NOT_FOUND', HttpStatus.NOT_FOUND, '资料条目不存在。');
  }
}
