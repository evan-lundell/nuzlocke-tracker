import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Profile } from 'passport-github2';
import { GithubStrategy } from './github.strategy';
import { AuthService } from '../auth.service';

describe('GithubStrategy', () => {
  let strategy: GithubStrategy;
  let authService: { findOrCreateUser: jest.Mock };

  beforeEach(async () => {
    authService = { findOrCreateUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<GithubStrategy>(GithubStrategy);
  });

  describe('validate', () => {
    it('maps the GitHub profile onto AuthService.findOrCreateUser, selecting the primary email', async () => {
      const user = { id: 'user-1' };
      authService.findOrCreateUser.mockResolvedValue(user);
      const profile = {
        id: 42,
        username: 'ashketchum',
        displayName: 'Ash Ketchum',
        emails: [
          { value: 'secondary@pallet.town', primary: false, verified: true },
          { value: 'ash@pallet.town', primary: true, verified: true },
        ],
        photos: [{ value: 'https://example.com/ash.png' }],
      } as unknown as Profile;

      await expect(
        strategy.validate('access', 'refresh', profile),
      ).resolves.toBe(user);
      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'github',
        providerAccountId: '42',
        email: 'ash@pallet.town',
        emailVerified: true,
        displayName: 'Ash Ketchum',
        avatarUrl: 'https://example.com/ash.png',
      });
    });

    it('falls back to the first email when none is marked primary', async () => {
      authService.findOrCreateUser.mockResolvedValue({ id: 'user-1' });
      const profile = {
        id: 42,
        username: 'ashketchum',
        displayName: 'Ash Ketchum',
        emails: [{ value: 'only@pallet.town', verified: false }],
      } as unknown as Profile;

      await strategy.validate('access', 'refresh', profile);
      expect(authService.findOrCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'only@pallet.town',
          emailVerified: false,
        }),
      );
    });

    it('throws UnauthorizedException when the profile has no email', async () => {
      const profile = {
        id: 42,
        username: 'ashketchum',
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
