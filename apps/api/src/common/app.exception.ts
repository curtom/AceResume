import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ApiError } from '@aceresume/contracts';

export class AppException extends HttpException {
  constructor(
    readonly code: ApiError['code'],
    status: HttpStatus,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
