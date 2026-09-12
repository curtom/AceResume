import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from './auth.service.js';

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser =>
    context.switchToHttp().getRequest<{ user: CurrentUser }>().user,
);
