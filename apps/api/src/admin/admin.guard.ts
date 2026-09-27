import { CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/app.exception.js';
import type { CurrentUser } from '../auth/auth.service.js';

type AdminRequest = { user?: CurrentUser };

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.user?.role !== 'admin')
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, '需要管理员权限。');
    return true;
  }
}
