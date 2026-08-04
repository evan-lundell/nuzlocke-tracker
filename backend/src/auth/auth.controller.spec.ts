import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { OAuthCallbackRequest } from './types/authenticated-request.type';

describe('AuthController', () => {
  let controller: AuthController;
  let service: { findById: jest.Mock; signToken: jest.Mock };
  let res: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    redirect: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
  };

  beforeEach(() => {
    service = { findById: jest.fn(), signToken: jest.fn() };
    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    // Instantiated directly rather than through Test.createTestingModule:
    // the route guards (JwtAuthGuard, AuthGuard('google'/'github')) pull in
    // real Passport/JWT dependencies that a bare testing module can't
    // resolve, and guard behavior itself is covered by jwt-auth.guard.spec.ts.
    controller = new AuthController(service as unknown as AuthService);
  });

  const asRequest = (user: object) =>
    ({ user }) as unknown as OAuthCallbackRequest;
  const asResponse = () => res as unknown as Response;

  describe('googleCallback', () => {
    it('signs a token, sets the auth cookie, and redirects to the frontend', async () => {
      const user = { id: 'user-1', email: 'ash@pallet.town' };
      service.signToken.mockResolvedValue('signed.jwt.token');
      process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

      await controller.googleCallback(asRequest(user), asResponse());

      expect(service.signToken).toHaveBeenCalledWith(user);
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'signed.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173');
    });
  });

  describe('githubCallback', () => {
    it('signs a token, sets the auth cookie, and redirects to the frontend', async () => {
      const user = { id: 'user-2', email: 'misty@cerulean.city' };
      service.signToken.mockResolvedValue('another.jwt.token');

      await controller.githubCallback(asRequest(user), asResponse());

      expect(service.signToken).toHaveBeenCalledWith(user);
      expect(res.cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'another.jwt.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.redirect).toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('delegates to AuthService.findById with the payload subject', async () => {
      const user = { id: 'user-1' };
      service.findById.mockResolvedValue(user);

      await expect(
        controller.me({ sub: 'user-1', email: 'ash@pallet.town' }),
      ).resolves.toBe(user);
      expect(service.findById).toHaveBeenCalledWith('user-1');
    });
  });

  describe('logout', () => {
    it('clears the auth cookie and responds 204', () => {
      controller.logout(asResponse());

      expect(res.clearCookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
