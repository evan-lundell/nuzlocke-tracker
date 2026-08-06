import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Run } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, runId: string, dto: CreateEncounterDto) {
    const run = await this.assertRunOwnership(userId, runId);

    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
    });
    if (!route || route.gameId !== run.gameId) {
      throw new NotFoundException(
        `Route ${dto.routeId} not found for this run's game`,
      );
    }

    if (dto.speciesId) {
      const species = await this.prisma.species.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new NotFoundException(`Species ${dto.speciesId} not found`);
      }
    }

    try {
      return await this.prisma.encounter.create({
        data: {
          runId,
          routeId: dto.routeId,
          speciesId: dto.speciesId,
          label: dto.label,
          order: dto.order ?? route.order,
          caught: dto.caught,
          nickname: dto.nickname,
          vitalStatus: dto.vitalStatus,
        },
        include: { species: true, route: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          `An encounter labeled "${dto.label ?? 'Wild Encounter'}" already exists for this route`,
        );
      }
      throw error;
    }
  }

  async findAllForRun(userId: string, runId: string) {
    await this.assertRunOwnership(userId, runId);
    return this.prisma.encounter.findMany({
      where: { runId },
      orderBy: { order: 'asc' },
      include: { species: true, route: true },
    });
  }

  async findOneForRun(userId: string, runId: string, id: string) {
    await this.assertRunOwnership(userId, runId);
    return this.findEncounterOrThrow(runId, id);
  }

  async update(
    userId: string,
    runId: string,
    id: string,
    dto: UpdateEncounterDto,
  ) {
    await this.assertRunOwnership(userId, runId);
    const existing = await this.findEncounterOrThrow(runId, id);

    if (dto.speciesId) {
      const species = await this.prisma.species.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new NotFoundException(`Species ${dto.speciesId} not found`);
      }
    }

    try {
      return await this.prisma.encounter.update({
        where: { id },
        data: dto,
        include: { species: true, route: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          `An encounter labeled "${dto.label ?? existing.label}" already exists for this route`,
        );
      }
      throw error;
    }
  }

  async remove(userId: string, runId: string, id: string) {
    await this.assertRunOwnership(userId, runId);
    await this.findEncounterOrThrow(runId, id);
    await this.prisma.encounter.delete({ where: { id } });
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

  private async findEncounterOrThrow(runId: string, id: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id, runId },
      include: { species: true, route: true },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter ${id} not found`);
    }
    return encounter;
  }
}
