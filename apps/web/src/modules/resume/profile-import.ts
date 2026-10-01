import type { Profile, ProfileEntry } from '@aceresume/contracts';
import { ResumeSectionSchema, textToRichText, type ResumeSection } from '@aceresume/resume-schema';

export type ProfileImportSource = Profile | ProfileEntry;

export function applyProfileImport(
  section: ResumeSection,
  source: ProfileImportSource,
  entryIndex?: number,
): { section: ResumeSection; targetRole?: string | null } {
  const next: ResumeSection = JSON.parse(JSON.stringify(section));
  if (next.type === 'basic' && !('type' in source)) {
    next.content = {
      ...next.content,
      fullName: source.fullName,
      email: source.email,
      phone: source.phone,
      location: source.location,
      customFields: source.customFields.map((field) => ({ ...field })),
    };
    return { section: ResumeSectionSchema.parse(next), targetRole: source.targetRole };
  }
  if (next.type === 'summary' && !('type' in source)) {
    next.content.body = textToRichText(source.selfEvaluation);
    return { section: ResumeSectionSchema.parse(next) };
  }
  if (entryIndex === undefined || !('type' in source) || !('entries' in next.content)) {
    throw new Error('个人资料类型与目标简历条目不匹配。');
  }
  const current = next.content.entries[entryIndex];
  if (!current || next.type !== source.type) {
    throw new Error('个人资料类型与目标简历条目不匹配。');
  }
  const base = { id: current.id, sortOrder: current.sortOrder };
  if (next.type === 'education' && source.type === 'education') {
    next.content.entries[entryIndex] = {
      ...base,
      school: source.content.school,
      major: source.content.major,
      degree: source.content.degree,
      startDate: source.content.startDate,
      endDate: source.content.endDate,
      isCurrent: source.content.isCurrent,
      description: textToRichText(source.content.description),
    };
  } else if (next.type === 'experience' && source.type === 'experience') {
    next.content.entries[entryIndex] = {
      ...base,
      organization: source.content.organization,
      position: source.content.position,
      location: null,
      startDate: source.content.startDate,
      endDate: source.content.endDate,
      isCurrent: source.content.isCurrent,
      description: textToRichText(
        [
          ...source.content.responsibilities,
          ...source.content.outcomes,
          source.content.skills.length ? `相关技能：${source.content.skills.join('、')}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    };
  } else if (next.type === 'project' && source.type === 'project') {
    next.content.entries[entryIndex] = {
      ...base,
      name: source.content.name,
      role: source.content.role,
      technologies: source.content.technologies,
      url: source.content.url,
      startDate: source.content.startDate,
      endDate: source.content.endDate,
      isCurrent: source.content.isCurrent,
      description: textToRichText(
        [source.content.background, ...source.content.responsibilities, ...source.content.outcomes]
          .filter(Boolean)
          .join('\n'),
      ),
    };
  } else if (next.type === 'campus' && source.type === 'campus') {
    next.content.entries[entryIndex] = {
      ...base,
      organization: source.content.organization,
      role: source.content.role,
      startDate: source.content.startDate,
      endDate: source.content.endDate,
      isCurrent: source.content.isCurrent,
      description: textToRichText(source.content.description),
    };
  } else if (next.type === 'skill' && source.type === 'skill') {
    next.content.entries[entryIndex] = {
      ...base,
      category: source.content.category,
      name: source.content.name,
      proficiency: source.content.proficiency,
      description: textToRichText(source.content.description),
    };
  } else {
    throw new Error('个人资料类型与目标简历条目不匹配。');
  }
  return { section: ResumeSectionSchema.parse(next) };
}
