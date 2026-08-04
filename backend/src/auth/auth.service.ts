import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types/jwt-payload.type';
import { OAuthProfileInput } from './types/oauth-profile.type';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  findOrCreateUser(input: OAuthProfileInput): Promise<User> {
    return this.findOrCreateUserAttempt(input, /* allowRetry */ true);
  }

  private async findOrCreateUserAttempt(
    input: OAuthProfileInput,
    allowRetry: boolean,
  ): Promise<User> {
    const {
      provider,
      providerAccountId,
      email,
      emailVerified,
      displayName,
      avatarUrl,
    } = input;

    const existingAccount = await this.prisma.authAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    if (existingAccount) {
      return existingAccount.user;
    }

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!existingUser) {
        return await this.prisma.user.create({
          data: {
            email,
            displayName,
            avatarUrl,
            authAccounts: { create: { provider, providerAccountId } },
          },
        });
      }

      if (!emailVerified) {
        throw new ConflictException(
          'An account already exists for this email under a different sign-in method.',
        );
      }

      await this.prisma.authAccount.create({
        data: { provider, providerAccountId, userId: existingUser.id },
      });
      return existingUser;
    } catch (error) {
      if (
        allowRetry &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        // A concurrent request won the race, but on *either* the AuthAccount
        // (provider, providerAccountId) constraint or the User.email one —
        // e.g. two different providers signing in as the same brand-new
        // email at once. Re-running the lookups from scratch (rather than
        // assuming which constraint fired) resolves correctly either way;
        // allowRetry=false bounds this to a single retry.
        return this.findOrCreateUserAttempt(input, false);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  signToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }
}
