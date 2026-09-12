import { CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService, type CurrentUser } from './auth.service.js';

type AuthenticatedRequest = { headers: { authorization?: string }; user?: CurrentUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    request.user = await this.authService.verifyAccessToken(
      scheme === 'Bearer' ? (token ?? '') : '',
    );
    return true;
  }
}
