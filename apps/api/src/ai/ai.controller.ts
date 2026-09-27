import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateAiTaskRequestSchema,
  DecideAiSuggestionRequestSchema,
  type CreateAiTaskRequest,
  type DecideAiSuggestionRequest,
} from '@aceresume/contracts';
import { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUserParam } from '../auth/current-user.decorator.js';
import type { CurrentUser } from '../auth/auth.service.js';
import { RateLimitService } from '../auth/rate-limit.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AiService } from './ai.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('ai/tasks')
export class AiController {
  constructor(
    @Inject(AiService) private readonly service: AiService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建受控 AI 简历建议任务' })
  async create(
    @CurrentUserParam() user: CurrentUser,
    @Body(new ZodValidationPipe(CreateAiTaskRequestSchema)) input: CreateAiTaskRequest,
  ) {
    await this.rateLimit.consume('ai-create', user.id, 12, 60);
    return this.service.create(user.id, input);
  }

  @Get(':id')
  get(@CurrentUserParam() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user.id, id);
  }

  @Sse(':id/events')
  @Header('Cache-Control', 'no-cache')
  events(
    @CurrentUserParam() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('after') after = '0',
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let persistedSequence = Number.isFinite(Number(after)) ? Math.max(0, Number(after)) : 0;
      let streamSequence = persistedSequence;
      const emit = async () => {
        try {
          const events = await this.service.events(user.id, id, persistedSequence);
          if (events.length) {
            for (const event of events) {
              persistedSequence = event.sequence;
              streamSequence = Math.max(streamSequence + 1, event.sequence);
              subscriber.next({ id: String(streamSequence), type: event.type, data: event });
            }
          } else {
            streamSequence += 1;
            subscriber.next({
              id: String(streamSequence),
              type: 'heartbeat',
              data: {
                sequence: streamSequence,
                type: 'heartbeat',
                data: {},
                createdAt: new Date().toISOString(),
              },
            });
          }
        } catch (error: unknown) {
          subscriber.error(error);
        }
      };
      void emit();
      const timer = setInterval(() => void emit(), 2_000);
      return () => clearInterval(timer);
    });
  }

  @Post(':taskId/generations/:generationId/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUserParam() user: CurrentUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('generationId', ParseUUIDPipe) generationId: string,
    @Body(new ZodValidationPipe(DecideAiSuggestionRequestSchema))
    input: DecideAiSuggestionRequest,
  ) {
    return this.service.accept(user.id, taskId, generationId, input);
  }

  @Post(':taskId/generations/:generationId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUserParam() user: CurrentUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('generationId', ParseUUIDPipe) generationId: string,
  ) {
    return this.service.reject(user.id, taskId, generationId);
  }
}
