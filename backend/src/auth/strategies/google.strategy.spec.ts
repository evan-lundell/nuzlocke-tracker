import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Profile } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let authService: { findOrCreateUser: jest.Mock };

  beforeEach(async () => {
    authService = { findOrCreateUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  describe('validate', () => {
    it('maps the Google profile onto AuthService.findOrCreateUser', async () => {
      const user = { id: 'user-1' };
      authService.findOrCreateUser.mockResolvedValue(user);
      const profile = {
        id: 'google-123',
        displayName: 'Ash Ketchum',
        emails: [{ value: 'ash@pallet.town', verified: true }],
        photos: [{ value: 'https://example.com/ash.png' }],
      } as Profile;

      await expect(
        strategy.validate('access', 'refresh', profile),
      ).resolves.toBe(user);
      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'google',
        providerAccountId: 'google-123',
        email: 'ash@pallet.town',
        emailVerified: true,
        displayName: 'Ash Ketchum',
        avatarUrl: 'https://example.com/ash.png',
      });
    });

    it('throws UnauthorizedException when the profile has no email', async () => {
      const profile = {
        id: 'google-123',
        displayName: 'Ash Ketchum',
        emails: [],
      } as unknown as Profile;

      await expect(
        strategy.validate('access', 'refresh', profile),
      ).rejects.toThrow(UnauthorizedException);
      expect(authService.findOrCreateUser).not.toHaveBeenCalled();
    });
  });
});
