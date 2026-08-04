import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getFrontendOrigins } from '../../config/frontend-origins';
import { AUTH_COOKIE_NAME } from '../auth.constants';
import { AuthenticatedRequest } from '../types/authenticated-request.type';
import { JwtPayload } from '../types/jwt-payload.type';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The JWT lives in a cookie, which browsers attach automatically —
    // including to cross-site requests a malicious page could trigger. For
    // non-idempotent methods, also require the request to actually be
    // coming from the frontend (Origin, falling back to Referer) as a
    // lightweight CSRF defense.
    if (!SAFE_METHODS.has(request.method)) {
      this.assertTrustedOrigin(request);
    }

    const token: unknown = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException();
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private assertTrustedOrigin(request: AuthenticatedRequest): void {
    const origin = this.getRequestOrigin(request);
    if (!origin || !getFrontendOrigins().includes(origin)) {
      throw new ForbiddenException('Request origin is not trusted.');
    }
  }

  private getRequestOrigin(request: AuthenticatedRequest): string | undefined {
    const originHeader = this.firstHeaderValue(request.headers.origin);
    if (originHeader) {
      return originHeader;
    }

    const refererHeader = this.firstHeaderValue(request.headers.referer);
    if (!refererHeader) {
      return undefined;
    }
    try {
      return new URL(refererHeader).origin;
    } catch {
      return undefined;
    }
  }

  private firstHeaderValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
