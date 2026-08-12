import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PokemonType, Prisma, Species } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RunOwnershipService } from '../runs/run-ownership.service';
import { RulesService } from '../rules/rules.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';
import { isPartyEligible } from '../party/party-eligibility';
import {
  effectiveType,
  hasTypeClash,
  TYPE_LOCK_RULE_KEY,
} from '../party/type-lock';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runOwnership: RunOwnershipService,
    private readonly rulesService: RulesService,
  ) {}

  async create(userId: string, runId: string, dto: CreateEncounterDto) {
    const run = await this.runOwnership.assertOwnership(userId, runId);

    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
    });
    if (!route || route.gameId !== run.gameId) {
      throw new NotFoundException(
        `Route ${dto.routeId} not found for this run's game`,
      );
    }

    let species: Species | null = null;
    if (dto.speciesId) {
      species = await this.prisma.species.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new NotFoundException(`Species ${dto.speciesId} not found`);
      }
    }
    if (dto.lockedType !== undefined) {
      this.assertValidLockedType(species, dto.lockedType);
    }

    try {
      return await this.prisma.encounter.create({
        data: {
          runId,
          routeId: dto.routeId,
          speciesId: dto.speciesId,
          label: dto.label,
          order: dto.order ?? route.order,
          status: dto.status,
          nickname: dto.nickname,
          vitalStatus: dto.vitalStatus,
          lockedType: dto.lockedType,
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
    await this.runOwnership.assertOwnership(userId, runId);
    return this.prisma.encounter.findMany({
      where: { runId },
      orderBy: { order: 'asc' },
      include: { species: true, route: true },
    });
  }

  async findOneForRun(userId: string, runId: string, id: string) {
    await this.runOwnership.assertOwnership(userId, runId);
    return this.findEncounterOrThrow(runId, id);
  }

  async update(
    userId: string,
    runId: string,
    id: string,
    dto: UpdateEncounterDto,
  ) {
    await this.runOwnership.assertOwnership(userId, runId);
    const existing = await this.findEncounterOrThrow(runId, id);

    let species = existing.species;
    if (dto.speciesId) {
      species = await this.prisma.species.findUnique({
        where: { id: dto.speciesId },
      });
      if (!species) {
        throw new NotFoundException(`Species ${dto.speciesId} not found`);
      }
    }
    if (dto.lockedType !== undefined) {
      this.assertValidLockedType(species, dto.lockedType, existing.lockedType);
    }

    const speciesChanged =
      dto.speciesId !== undefined && dto.speciesId !== existing.speciesId;
    if (speciesChanged) {
      // Evolving a species already in the party can silently change its
      // type-lock effective type (e.g. a single-typed Pokémon evolving into
      // a different single type) — re-check the same invariant PartyService
      // enforces on add, since this update path bypasses it entirely.
      await this.assertPartyTypeLockAllowsSpeciesChange(
        runId,
        id,
        species,
        dto.lockedType ?? existing.lockedType,
      );
    }

    try {
      const updated = await this.prisma.encounter.update({
        where: { id },
        data: dto,
        include: { species: true, route: true },
      });
      if (!isPartyEligible(updated)) {
        await this.prisma.partyMembership.deleteMany({
          where: { encounterId: id },
        });
      }
      return updated;
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
    await this.runOwnership.assertOwnership(userId, runId);
    await this.findEncounterOrThrow(runId, id);
    await this.prisma.partyMembership.deleteMany({
      where: { encounterId: id },
    });
    await this.prisma.encounter.delete({ where: { id } });
  }

  private assertValidLockedType(
    species: Pick<Species, 'typePrimary' | 'typeSecondary'> | null,
    lockedType: PokemonType,
    existingLockedType?: PokemonType | null,
  ) {
    if (!species || !species.typeSecondary) {
      throw new BadRequestException(
        'A locked type can only be set for a dual-typed species',
      );
    }
    if (
      lockedType !== species.typePrimary &&
      lockedType !== species.typeSecondary
    ) {
      throw new BadRequestException(
        `Locked type must be one of this species' types (${species.typePrimary}, ${species.typeSecondary})`,
      );
    }
    if (existingLockedType && existingLockedType !== lockedType) {
      throw new BadRequestException(
        'Locked type is permanent once set and cannot be changed',
      );
    }
  }

  private async assertPartyTypeLockAllowsSpeciesChange(
    runId: string,
    encounterId: string,
    species: Species | null,
    lockedType: PokemonType | null,
  ) {
    const membership = await this.prisma.partyMembership.findUnique({
      where: { encounterId },
    });
    if (!membership) return; // not currently in the party — nothing to protect

    if (
      !(await this.rulesService.isRuleActiveForRun(runId, TYPE_LOCK_RULE_KEY))
    ) {
      return;
    }
    if (!species) return; // unknown species — can't determine a type to check

    const newType = effectiveType({ lockedType }, species);
    if (!newType) {
      throw new BadRequestException(
        'This evolution is dual-typed — choose a locked type before it can stay in the party (type-lock rule)',
      );
    }

    const otherPartyMembers = await this.prisma.partyMembership.findMany({
      where: { runId, encounterId: { not: encounterId } },
      include: { encounter: { include: { species: true } } },
    });
    if (hasTypeClash(newType, otherPartyMembers)) {
      throw new ConflictException(
        `Party already has a ${newType.toLowerCase()}-type Pokémon (type-lock rule)`,
      );
    }
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
