import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@aceresume/config';
import {
  AiTaskSchema,
  type AiTask,
  type CreateAiTaskRequest,
  type DecideAiSuggestionRequest,
} from '@aceresume/contracts';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import { AppException } from '../common/app.exception.js';
import { QueueService } from '../jobs/queue.service.js';
import { ResumesService } from '../resumes/resumes.service.js';
import { AiRepository } from './ai.repository.js';

const DEFAULT_PROMPT_VERSION = 'resume-writing-v2';
const SUPPORTED_SECTIONS = new Set(['experience', 'project', 'campus']);

@Injectable()
export class AiService {
  constructor(
    @Inject(AiRepository) private readonly repository: AiRepository,
    @Inject(QueueService) private readonly queues: QueueService,
    @Inject(ResumesService) private readonly resumes: ResumesService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  async create(userId: string, input: CreateAiTaskRequest): Promise<AiTask> {
    const resume = await this.resumes.get(userId, input.resumeId);
    if (resume.version !== input.baseVersion)
      throw new AppException(
        'RESUME_VERSION_CONFLICT',
        HttpStatus.CONFLICT,
        '简历已在其他位置更新，请刷新后重新生成建议。',
      );
    const section = resume.document.sections.find((item) => item.id === input.sectionId);
    if (!section || !SUPPORTED_SECTIONS.has(section.type))
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '当前模块暂不支持 AI 写作建议。',
      );
    if (section.type !== input.contentType)
      throw new AppException(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        '输出内容类型与目标简历模块不一致。',
      );
    if (
      !(await this.repository.sourcesBelongToUser(
        userId,
        input.sources.documentIds,
        input.sources.profileEntryIds,
      ))
    )
      throw new AppException(
        'AI_SOURCE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        '所选来源不存在、尚未解析完成或不属于当前用户。',
      );
    const runtime = await this.repository.runtimeConfiguration(userId);
    const provider =
      this.environment.AI_PROVIDER === 'mock'
        ? 'mock'
        : runtime.model?.provider === 'mock'
          ? 'mock'
          : 'qwen';
    const hasConfiguredSecret = Boolean(
      runtime.model?.secretCiphertext || this.environment.DASHSCOPE_API_KEY,
    );
    if (runtime.model && !runtime.model.isEnabled)
      throw new AppException(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        'AI Provider 当前已由管理员停用。',
      );
    if (provider === 'qwen' && !hasConfiguredSecret)
      throw new AppException(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Qwen Provider 尚未配置服务端密钥。',
      );
    const task = await this.repository.createTask({
      id: randomUUID(),
      userId,
      provider,
      model:
        provider === 'mock'
          ? 'mock-resume-writer-v1'
          : (runtime.model?.chatModel ?? this.environment.AI_CHAT_MODEL),
      promptVersion: runtime.prompt
        ? `${runtime.prompt.key}-v${runtime.prompt.version}`
        : DEFAULT_PROMPT_VERSION,
      request: input,
    });
    if (!task) throw new Error('AI task insert failed.');
    await this.queues.generateAi(task.id);
    return this.get(userId, task.id);
  }

  async get(userId: string, id: string): Promise<AiTask> {
    const result = await this.repository.findTask(userId, id);
    if (!result) throw this.notFound();
    return AiTaskSchema.parse({
      id: result.task.id,
      resumeId: result.task.resumeId,
      sectionId: result.task.sectionId,
      baseVersion: result.task.baseVersion,
      status: result.task.status,
      progress: result.task.progress,
      provider: result.task.provider,
      model: result.task.model,
      promptVersion: result.task.promptVersion,
      errorCode: result.task.errorCode,
      errorMessage: result.task.errorMessage,
      suggestions: result.generations.map((generation) => ({
        ...generation.suggestion,
        decision: generation.decision,
        editedText: generation.editedText,
        appliedAt: generation.appliedAt?.toISOString() ?? null,
      })),
      createdAt: result.task.createdAt.toISOString(),
      updatedAt: result.task.updatedAt.toISOString(),
    });
  }

  async events(userId: string, id: string, afterSequence: number) {
    if (!(await this.repository.findTask(userId, id))) throw this.notFound();
    return this.repository.listEvents(userId, id, afterSequence);
  }

  async accept(
    userId: string,
    taskId: string,
    generationId: string,
    input: DecideAiSuggestionRequest,
  ) {
    const record = await this.repository.findGeneration(userId, taskId, generationId);
    if (!record) throw this.notFound();
    const suggestion = record.generation.suggestion;
    if (
      suggestion.supportStatus !== 'supported' ||
      suggestion.missingFacts.length ||
      suggestion.riskFlags.includes('unsupported_number') ||
      suggestion.riskFlags.includes('unsupported_entity') ||
      suggestion.riskFlags.includes('source_conflict')
    )
      throw new AppException(
        'AI_UNSUPPORTED_CLAIM',
        HttpStatus.CONFLICT,
        '该建议存在未解决的事实风险，不能直接写入。',
      );
    if (!(await this.repository.citationOwnershipIsValid(userId, generationId, suggestion)))
      throw new AppException(
        'AI_SOURCE_FORBIDDEN',
        HttpStatus.FORBIDDEN,
        '建议引用校验失败，不能写入简历。',
      );
    const accepted =
      record.generation.decision === 'pending'
        ? await this.repository.acceptGeneration(userId, generationId, input.editedText)
        : record.generation;
    if (!accepted || accepted.decision === 'rejected')
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, '该建议已经处理。');
    if (accepted.appliedAt) return this.resumes.get(userId, record.task.resumeId);
    const updated = await this.resumes.applyAiSuggestion(
      userId,
      record.task.resumeId,
      input.baseVersion,
      suggestion.patch,
      input.editedText ?? suggestion.text,
    );
    await this.repository.markApplied(userId, taskId, generationId, updated.version);
    await this.repository.completeIfDecided(userId, taskId);
    return updated;
  }

  async reject(userId: string, taskId: string, generationId: string): Promise<AiTask> {
    const record = await this.repository.findGeneration(userId, taskId, generationId);
    if (!record) throw this.notFound();
    if (record.generation.decision === 'accepted')
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, '已接受的建议不能忽略。');
    if (record.generation.decision === 'pending')
      await this.repository.rejectGeneration(userId, generationId);
    await this.repository.completeIfDecided(userId, taskId);
    return this.get(userId, taskId);
  }

  private notFound() {
    return new AppException('AI_TASK_NOT_FOUND', HttpStatus.NOT_FOUND, 'AI 任务或建议不存在。');
  }
}
