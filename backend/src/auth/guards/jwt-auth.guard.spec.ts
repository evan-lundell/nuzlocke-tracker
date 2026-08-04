import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth.constants';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  interface FakeRequest {
    cookies: Record<string, string>;
    method: string;
    headers: { origin?: string; referer?: string };
    user?: unknown;
  }

  const buildContext = (
    cookies: Record<string, string>,
    overrides: Partial<Pick<FakeRequest, 'method' | 'headers'>> = {},
  ) => {
    const request: FakeRequest = {
      cookies,
      method: overrides.method ?? 'GET',
      headers: overrides.headers ?? {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  });

  afterEach(() => {
    delete process.env.FRONTEND_ORIGIN;
  });

  it('allows the request and attaches the payload when the cookie holds a valid token', async () => {
    const payload = { sub: 'user-1', email: 'ash@pallet.town' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const context = buildContext({ [AUTH_COOKIE_NAME]: 'valid.jwt.token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest<{ user?: unknown }>().user).toBe(
      payload,
    );
  });

  it('throws UnauthorizedException when the cookie is missing', async () => {
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the token fails verification', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('expired'));
    const context = buildContext({ [AUTH_COOKIE_NAME]: 'bad.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  describe('CSRF origin check on non-idempotent requests', () => {
    it('allows a GET request through without checking Origin/Referer at all', async () => {
      const payload = { sub: 'user-1', email: 'ash@pallet.town' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      const context = buildContext(
        { [AUTH_COOKIE_NAME]: 'valid.jwt.token' },
        { method: 'GET', headers: { origin: 'http://evil.example.com' } },
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('allows a POST request whose Origin matches FRONTEND_ORIGIN', async () => {
      const payload = { sub: 'user-1', email: 'ash@pallet.town' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      const context = buildContext(
        { [AUTH_COOKIE_NAME]: 'valid.jwt.token' },
        { method: 'POST', headers: { origin: 'http://localhost:5173' } },
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('allows a POST request with no Origin header but a matching Referer', async () => {
      const payload = { sub: 'user-1', email: 'ash@pallet.town' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      const context = buildContext(
        { [AUTH_COOKIE_NAME]: 'valid.jwt.token' },
        { method: 'POST', headers: { referer: 'http://localhost:5173/run/1' } },
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('rejects a POST request whose Origin does not match FRONTEND_ORIGIN', async () => {
      const context = buildContext(
        { [AUTH_COOKIE_NAME]: 'valid.jwt.token' },
        { method: 'POST', headers: { origin: 'http://evil.example.com' } },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('rejects a POST request with neither Origin nor Referer', async () => {
      const context = buildContext(
        { [AUTH_COOKIE_NAME]: 'valid.jwt.token' },
        { method: 'POST' },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
