import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RunOwnershipService } from '../runs/run-ownership.service';
import { AddPartyMembershipDto } from './dto/add-party-membership.dto';
import { isPartyEligible } from './party-eligibility';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const MAX_PARTY_SIZE = 6;

@Injectable()
export class PartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runOwnership: RunOwnershipService,
  ) {}

  async create(userId: string, runId: string, dto: AddPartyMembershipDto) {
    await this.runOwnership.assertOwnership(userId, runId);

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: dto.encounterId, runId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter ${dto.encounterId} not found for this run`,
      );
    }
    if (!isPartyEligible(encounter)) {
      throw new BadRequestException(
        'Only a caught, non-dead encounter can be added to the party',
      );
    }

    const partySize = await this.prisma.partyMembership.count({
      where: { runId },
    });
    if (partySize >= MAX_PARTY_SIZE) {
      throw new ConflictException(
        `Party is already at the maximum of ${MAX_PARTY_SIZE}`,
      );
    }

    try {
      return await this.prisma.partyMembership.create({
        data: { runId, encounterId: dto.encounterId },
        include: { encounter: { include: { species: true, route: true } } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          `Encounter ${dto.encounterId} is already in the party`,
        );
      }
      throw error;
    }
  }

  async findAllForRun(userId: string, runId: string) {
    await this.runOwnership.assertOwnership(userId, runId);
    return this.prisma.partyMembership.findMany({
      where: { runId },
      include: { encounter: { include: { species: true, route: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, runId: string, encounterId: string) {
    await this.runOwnership.assertOwnership(userId, runId);
    const membership = await this.prisma.partyMembership.findFirst({
      where: { encounterId, runId },
    });
    if (!membership) {
      throw new NotFoundException(
        `Encounter ${encounterId} is not in the party for this run`,
      );
    }
    await this.prisma.partyMembership.delete({ where: { id: membership.id } });
  }
}
