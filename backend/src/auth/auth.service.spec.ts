import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthProfileInput } from './types/oauth-profile.type';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    authAccount: { findUnique: jest.Mock; create: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let jwtService: { signAsync: jest.Mock };

  const input: OAuthProfileInput = {
    provider: 'google',
    providerAccountId: 'google-123',
    email: 'ash@pallet.town',
    emailVerified: true,
    displayName: 'Ash Ketchum',
    avatarUrl: 'https://example.com/ash.png',
  };

  beforeEach(async () => {
    prisma = {
      authAccount: { findUnique: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('findOrCreateUser', () => {
    it('returns the existing user when the AuthAccount already exists', async () => {
      const user = { id: 'user-1', email: input.email };
      prisma.authAccount.findUnique.mockResolvedValue({ user });

      await expect(service.findOrCreateUser(input)).resolves.toBe(user);
      expect(prisma.authAccount.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: input.provider,
            providerAccountId: input.providerAccountId,
          },
        },
        include: { user: true },
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('creates a new User+AuthAccount when neither exists', async () => {
      const created = { id: 'user-2', email: input.email };
      prisma.authAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(created);

      await expect(service.findOrCreateUser(input)).resolves.toBe(created);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          authAccounts: {
            create: {
              provider: input.provider,
              providerAccountId: input.providerAccountId,
            },
          },
        },
      });
    });

    it('links a new AuthAccount to an existing user when the email is verified', async () => {
      const existingUser = { id: 'user-3', email: input.email };
      prisma.authAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(service.findOrCreateUser(input)).resolves.toBe(existingUser);
      expect(prisma.authAccount.create).toHaveBeenCalledWith({
        data: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          userId: existingUser.id,
        },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the email exists but is unverified, without writing anything', async () => {
      const existingUser = { id: 'user-4', email: input.email };
      prisma.authAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.findOrCreateUser({ ...input, emailVerified: false }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.authAccount.create).not.toHaveBeenCalled();
    });

    it('recovers from a concurrent race on the AuthAccount constraint by retrying', async () => {
      // Same (provider, providerAccountId) signs in twice at once: both see
      // no existing AuthAccount/User, the loser's user.create violates the
      // AuthAccount unique constraint, and retrying finds the winner's row.
      const user = { id: 'user-5', email: input.email };
      prisma.authAccount.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.findOrCreateUser(input)).resolves.toBe(user);
      expect(prisma.authAccount.findUnique).toHaveBeenCalledTimes(2);
    });

    it('recovers from a concurrent race on the User.email constraint by retrying', async () => {
      // Two different providers sign in as the same brand-new email at
      // once: the loser's user.create violates User.email (not the
      // AuthAccount constraint, since its own AuthAccount was never
      // created), so a fetch scoped only to the AuthAccount key would find
      // nothing. Retrying re-runs both lookups and finds the now-existing
      // user by email instead.
      const existingUser = { id: 'user-6', email: input.email };
      prisma.authAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.findOrCreateUser(input)).resolves.toBe(existingUser);
      expect(prisma.authAccount.create).toHaveBeenCalledWith({
        data: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          userId: existingUser.id,
        },
      });
    });

    it('does not retry a second time if the race recovery attempt also throws P2002', async () => {
      prisma.authAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.findOrCreateUser(input)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
      expect(prisma.authAccount.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the user when found', async () => {
      const user = { id: 'user-1', email: input.email };
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.findById('user-1')).resolves.toBe(user);
    });
  });

  describe('signToken', () => {
    it('signs a JWT payload from the user id and email', async () => {
      const user = { id: 'user-1', email: input.email };
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      await expect(service.signToken(user as never)).resolves.toBe(
        'signed.jwt.token',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });
  });
});
