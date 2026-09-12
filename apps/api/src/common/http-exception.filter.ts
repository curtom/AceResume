import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError } from '@aceresume/contracts';
import { AppException } from './app.exception.js';

type RequestWithId = { requestId?: string };
type Response = { status: (status: number) => { json: (body: ApiError) => void } };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ApiError = {
      code: exception instanceof AppException ? exception.code : this.codeFor(status),
      message: exception instanceof AppException ? exception.message : this.messageFor(status),
      ...(exception instanceof AppException && exception.details
        ? { details: exception.details }
        : {}),
      requestId: request.requestId ?? '00000000-0000-0000-0000-000000000000',
    };
    response.status(status).json(body);
  }

  private codeFor(status: number): ApiError['code'] {
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_FAILED';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHENTICATED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'DEPENDENCY_UNAVAILABLE';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
    return 'INTERNAL_ERROR';
  }

  private messageFor(status: number): string {
    return status >= 500 ? '服务暂时不可用，请稍后重试。' : '请求未能完成。';
  }
}
