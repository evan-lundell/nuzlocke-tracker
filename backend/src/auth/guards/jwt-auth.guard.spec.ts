import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth.constants';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  const buildContext = (cookies: Record<string, string>) => {
    const request: { cookies: Record<string, string>; user?: unknown } = {
      cookies,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
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
});
