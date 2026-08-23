import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { PrismaService } from '../prisma/prisma.service';
import { RunOwnershipService } from '../runs/run-ownership.service';
import { RulesService } from '../rules/rules.service';
import { Prisma } from '../../generated/prisma/client';

describe('EncountersService', () => {
  let service: EncountersService;
  let prisma: {
    route: { findUnique: jest.Mock };
    species: { findUnique: jest.Mock };
    encounter: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    partyMembership: {
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let runOwnership: { assertOwnership: jest.Mock };
  let rulesService: { isRuleActiveForRun: jest.Mock; getRunRule: jest.Mock };

  const duplicateError = () =>
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    prisma = {
      route: { findUnique: jest.fn() },
      species: { findUnique: jest.fn() },
      encounter: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      partyMembership: {
        deleteMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };
    runOwnership = {
      assertOwnership: jest
        .fn()
        .mockResolvedValue({ id: 'run-1', gameId: 'g-1' }),
    };
    rulesService = {
      isRuleActiveForRun: jest.fn().mockResolvedValue(false),
      getRunRule: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncountersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RunOwnershipService, useValue: runOwnership },
        { provide: RulesService, useValue: rulesService },
      ],
    }).compile();

    service = module.get<EncountersService>(EncountersService);
  });

  describe('create', () => {
    it('throws NotFoundException when the run does not exist or is not owned by the user', async () => {
      runOwnership.assertOwnership.mockRejectedValue(
        new NotFoundException('Run run-1 not found'),
      );

      await expect(
        service.create('user-1', 'run-1', { routeId: 'route-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(runOwnership.assertOwnership).toHaveBeenCalledWith(
        'user-1',
        'run-1',
      );
    });

    it("throws NotFoundException when the route doesn't belong to the run's game", async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-2',
        order: 3,
      });

      await expect(
        service.create('user-1', 'run-1', { routeId: 'route-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when speciesId does not exist', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 3,
      });
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', 'run-1', {
          routeId: 'route-1',
          speciesId: 'species-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("defaults order to the route's order when omitted", async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 7,
      });
      const encounter = { id: 'enc-1' };
      prisma.encounter.create.mockResolvedValue(encounter);

      await expect(
        service.create('user-1', 'run-1', { routeId: 'route-1' }),
      ).resolves.toBe(encounter);
      expect(prisma.encounter.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-1',
          routeId: 'route-1',
          speciesId: undefined,
          label: undefined,
          order: 7,
          status: undefined,
          nickname: undefined,
          vitalStatus: undefined,
        },
        include: { species: true, route: true },
      });
    });

    it('uses the provided order instead of the default', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 7,
      });
      const encounter = { id: 'enc-1' };
      prisma.encounter.create.mockResolvedValue(encounter);

      await expect(
        service.create('user-1', 'run-1', { routeId: 'route-1', order: 7.5 }),
      ).resolves.toBe(encounter);
      expect(prisma.encounter.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-1',
          routeId: 'route-1',
          speciesId: undefined,
          label: undefined,
          order: 7.5,
          status: undefined,
          nickname: undefined,
          vitalStatus: undefined,
        },
        include: { species: true, route: true },
      });
    });

    it('throws ConflictException when the (run, route, label) combination already exists', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 1,
      });
      prisma.encounter.create.mockRejectedValue(duplicateError());

      await expect(
        service.create('user-1', 'run-1', { routeId: 'route-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when lockedType is set for a single-typed species', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 1,
      });
      prisma.species.findUnique.mockResolvedValue({
        id: 'species-1',
        typePrimary: 'FIRE',
        typeSecondary: null,
      });

      await expect(
        service.create('user-1', 'run-1', {
          routeId: 'route-1',
          speciesId: 'species-1',
          lockedType: 'FIRE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when lockedType isn't one of the species' types", async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 1,
      });
      prisma.species.findUnique.mockResolvedValue({
        id: 'species-1',
        typePrimary: 'FIRE',
        typeSecondary: 'FLYING',
      });

      await expect(
        service.create('user-1', 'run-1', {
          routeId: 'route-1',
          speciesId: 'species-1',
          lockedType: 'WATER',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the encounter with lockedType for a dual-typed species', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        gameId: 'g-1',
        order: 1,
      });
      prisma.species.findUnique.mockResolvedValue({
        id: 'species-1',
        typePrimary: 'FIRE',
        typeSecondary: 'FLYING',
      });
      const encounter = { id: 'enc-1' };
      prisma.encounter.create.mockResolvedValue(encounter);

      await expect(
        service.create('user-1', 'run-1', {
          routeId: 'route-1',
          speciesId: 'species-1',
          lockedType: 'FLYING',
        }),
      ).resolves.toBe(encounter);
      expect(prisma.encounter.create).toHaveBeenCalledWith({
        data: {
          runId: 'run-1',
          routeId: 'route-1',
          speciesId: 'species-1',
          label: undefined,
          order: 1,
          status: undefined,
          nickname: undefined,
          vitalStatus: undefined,
          lockedType: 'FLYING',
        },
        include: { species: true, route: true },
      });
    });
  });

  describe('findAllForRun', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      runOwnership.assertOwnership.mockRejectedValue(
        new NotFoundException('Run run-1 not found'),
      );

      await expect(service.findAllForRun('user-1', 'run-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns encounters for the run ordered by order asc', async () => {
      const encounters = [{ id: 'enc-1' }];
      prisma.encounter.findMany.mockResolvedValue(encounters);

      await expect(service.findAllForRun('user-1', 'run-1')).resolves.toBe(
        encounters,
      );
      expect(prisma.encounter.findMany).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
        orderBy: { order: 'asc' },
        include: { species: true, route: true },
      });
    });
  });

  describe('findOneForRun', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      runOwnership.assertOwnership.mockRejectedValue(
        new NotFoundException('Run run-1 not found'),
      );

      await expect(
        service.findOneForRun('user-1', 'run-1', 'enc-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the encounter does not belong to the run', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForRun('user-1', 'run-1', 'enc-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
        where: { id: 'enc-1', runId: 'run-1' },
        include: { species: true, route: true },
      });
    });

    it('returns the encounter when found', async () => {
      const encounter = { id: 'enc-1' };
      prisma.encounter.findFirst.mockResolvedValue(encounter);

      await expect(
        service.findOneForRun('user-1', 'run-1', 'enc-1'),
      ).resolves.toBe(encounter);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      runOwnership.assertOwnership.mockRejectedValue(
        new NotFoundException('Run run-1 not found'),
      );

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { status: 'CAUGHT' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the encounter does not belong to the run', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { status: 'CAUGHT' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the new speciesId does not exist', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', {
          speciesId: 'species-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the encounter', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      const updated = { id: 'enc-1', status: 'CAUGHT', vitalStatus: 'ALIVE' };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { status: 'CAUGHT' }),
      ).resolves.toBe(updated);
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'enc-1' },
        data: { status: 'CAUGHT' },
        include: { species: true, route: true },
      });
      expect(prisma.partyMembership.deleteMany).not.toHaveBeenCalled();
    });

    it('removes any party membership when the update makes the encounter unfit for the party', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      const updated = { id: 'enc-1', status: 'CAUGHT', vitalStatus: 'DEAD' };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { vitalStatus: 'DEAD' }),
      ).resolves.toBe(updated);
      expect(prisma.partyMembership.deleteMany).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
      });
    });

    it('removes any party membership when the status changes to MISSED', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      const updated = { id: 'enc-1', status: 'MISSED', vitalStatus: null };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { status: 'MISSED' }),
      ).resolves.toBe(updated);
      expect(prisma.partyMembership.deleteMany).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
      });
    });

    it('throws ConflictException when relabeling collides with an existing encounter', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.encounter.update.mockRejectedValue(duplicateError());

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { label: 'Static' }),
      ).rejects.toThrow(ConflictException);
    });

    it('falls back to the existing label in the conflict message when the update omits one', async () => {
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        label: 'Wild Encounter',
      });
      prisma.encounter.update.mockRejectedValue(duplicateError());

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { status: 'CAUGHT' }),
      ).rejects.toThrow(
        'An encounter labeled "Wild Encounter" already exists for this route',
      );
    });

    it('throws BadRequestException when lockedType is set for a single-typed species', async () => {
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        lockedType: null,
        species: { typePrimary: 'FIRE', typeSecondary: null },
      });

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { lockedType: 'FIRE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when changing an already-set lockedType', async () => {
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        lockedType: 'FIRE',
        species: { typePrimary: 'FIRE', typeSecondary: 'FLYING' },
      });

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { lockedType: 'FLYING' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows re-submitting the same lockedType value', async () => {
      const existing = {
        id: 'enc-1',
        lockedType: 'FIRE',
        species: { typePrimary: 'FIRE', typeSecondary: 'FLYING' },
      };
      prisma.encounter.findFirst.mockResolvedValue(existing);
      const updated = { ...existing };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { lockedType: 'FIRE' }),
      ).resolves.toBe(updated);
    });

    it('sets lockedType for a dual-typed species when not previously set', async () => {
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        lockedType: null,
        species: { typePrimary: 'FIRE', typeSecondary: 'FLYING' },
      });
      const updated = { id: 'enc-1', lockedType: 'FLYING' };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { lockedType: 'FLYING' }),
      ).resolves.toBe(updated);
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'enc-1' },
        data: { lockedType: 'FLYING' },
        include: { species: true, route: true },
      });
    });

    describe('changing species (evolution) on a party member with type-lock active', () => {
      it('skips the check when the encounter is not currently in the party', async () => {
        prisma.encounter.findFirst.mockResolvedValue({
          id: 'enc-1',
          speciesId: 'species-old',
          lockedType: null,
          species: { typePrimary: 'ELECTRIC', typeSecondary: null },
        });
        prisma.species.findUnique.mockResolvedValue({
          id: 'species-new',
          typePrimary: 'WATER',
          typeSecondary: null,
        });
        const updated = { id: 'enc-1' };
        prisma.encounter.update.mockResolvedValue(updated);

        await expect(
          service.update('user-1', 'run-1', 'enc-1', {
            speciesId: 'species-new',
          }),
        ).resolves.toBe(updated);
        expect(rulesService.isRuleActiveForRun).not.toHaveBeenCalled();
      });

      it('skips the check when type-lock is not active on the run', async () => {
        prisma.encounter.findFirst.mockResolvedValue({
          id: 'enc-1',
          speciesId: 'species-old',
          lockedType: null,
          species: { typePrimary: 'ELECTRIC', typeSecondary: null },
        });
        prisma.partyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
        rulesService.isRuleActiveForRun.mockResolvedValue(false);
        prisma.species.findUnique.mockResolvedValue({
          id: 'species-new',
          typePrimary: 'WATER',
          typeSecondary: null,
        });
        const updated = { id: 'enc-1' };
        prisma.encounter.update.mockResolvedValue(updated);

        await expect(
          service.update('user-1', 'run-1', 'enc-1', {
            speciesId: 'species-new',
          }),
        ).resolves.toBe(updated);
        expect(prisma.partyMembership.findMany).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when evolving into a dual-typed species with no lockedType', async () => {
        prisma.encounter.findFirst.mockResolvedValue({
          id: 'enc-1',
          speciesId: 'species-old',
          lockedType: null,
          species: { typePrimary: 'ELECTRIC', typeSecondary: null },
        });
        prisma.partyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
        rulesService.isRuleActiveForRun.mockResolvedValue(true);
        prisma.species.findUnique.mockResolvedValue({
          id: 'species-new',
          typePrimary: 'WATER',
          typeSecondary: 'FLYING',
        });

        await expect(
          service.update('user-1', 'run-1', 'enc-1', {
            speciesId: 'species-new',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws ConflictException when the evolved effective type clashes with another party member', async () => {
        prisma.encounter.findFirst.mockResolvedValue({
          id: 'enc-1',
          speciesId: 'species-old',
          lockedType: null,
          species: { typePrimary: 'ELECTRIC', typeSecondary: null },
        });
        prisma.partyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
        rulesService.isRuleActiveForRun.mockResolvedValue(true);
        prisma.species.findUnique.mockResolvedValue({
          id: 'species-new',
          typePrimary: 'WATER',
          typeSecondary: null,
        });
        prisma.partyMembership.findMany.mockResolvedValue([
          {
            encounter: {
              lockedType: null,
              species: { typePrimary: 'WATER', typeSecondary: null },
            },
          },
        ]);

        await expect(
          service.update('user-1', 'run-1', 'enc-1', {
            speciesId: 'species-new',
          }),
        ).rejects.toThrow(ConflictException);
        expect(prisma.partyMembership.findMany).toHaveBeenCalledWith({
          where: { runId: 'run-1', encounterId: { not: 'enc-1' } },
          include: { encounter: { include: { species: true } } },
        });
      });

      it('allows the evolution when the effective type does not clash', async () => {
        prisma.encounter.findFirst.mockResolvedValue({
          id: 'enc-1',
          speciesId: 'species-old',
          lockedType: null,
          species: { typePrimary: 'ELECTRIC', typeSecondary: null },
        });
        prisma.partyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
        rulesService.isRuleActiveForRun.mockResolvedValue(true);
        prisma.species.findUnique.mockResolvedValue({
          id: 'species-new',
          typePrimary: 'WATER',
          typeSecondary: null,
        });
        prisma.partyMembership.findMany.mockResolvedValue([]);
        const updated = { id: 'enc-1' };
        prisma.encounter.update.mockResolvedValue(updated);

        await expect(
          service.update('user-1', 'run-1', 'enc-1', {
            speciesId: 'species-new',
          }),
        ).resolves.toBe(updated);
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      runOwnership.assertOwnership.mockRejectedValue(
        new NotFoundException('Run run-1 not found'),
      );

      await expect(service.remove('user-1', 'run-1', 'enc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the encounter does not belong to the run', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'run-1', 'enc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes any party membership before deleting the encounter', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.encounter.delete.mockResolvedValue({ id: 'enc-1' });

      await service.remove('user-1', 'run-1', 'enc-1');
      expect(prisma.partyMembership.deleteMany).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
      });
      expect(prisma.encounter.delete).toHaveBeenCalledWith({
        where: { id: 'enc-1' },
      });
    });
  });
});
