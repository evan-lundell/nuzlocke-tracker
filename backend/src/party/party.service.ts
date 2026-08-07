import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Run } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPartyMembershipDto } from './dto/add-party-membership.dto';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PartyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, runId: string, dto: AddPartyMembershipDto) {
    await this.assertRunOwnership(userId, runId);

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: dto.encounterId, runId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter ${dto.encounterId} not found for this run`,
      );
    }
    if (!encounter.caught || encounter.vitalStatus !== 'ALIVE') {
      throw new BadRequestException(
        'Only a caught, alive encounter can be added to the party',
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
    await this.assertRunOwnership(userId, runId);
    return this.prisma.partyMembership.findMany({
      where: { runId },
      include: { encounter: { include: { species: true, route: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, runId: string, encounterId: string) {
    await this.assertRunOwnership(userId, runId);
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

  private async assertRunOwnership(
    userId: string,
    runId: string,
  ): Promise<Run> {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId },
    });
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    return run;
  }
}
