import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { PrismaService } from '../prisma/prisma.service';
import { RunOwnershipService } from '../runs/run-ownership.service';
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
    partyMembership: { deleteMany: jest.Mock };
  };
  let runOwnership: { assertOwnership: jest.Mock };

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
      partyMembership: { deleteMany: jest.fn() },
    };
    runOwnership = {
      assertOwnership: jest
        .fn()
        .mockResolvedValue({ id: 'run-1', gameId: 'g-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncountersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RunOwnershipService, useValue: runOwnership },
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
          caught: undefined,
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
          caught: undefined,
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
        service.update('user-1', 'run-1', 'enc-1', { caught: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the encounter does not belong to the run', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { caught: true }),
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
      const updated = { id: 'enc-1', caught: true, vitalStatus: 'ALIVE' };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { caught: true }),
      ).resolves.toBe(updated);
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'enc-1' },
        data: { caught: true },
        include: { species: true, route: true },
      });
      expect(prisma.partyMembership.deleteMany).not.toHaveBeenCalled();
    });

    it('removes any party membership when the update makes the encounter unfit for the party', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      const updated = { id: 'enc-1', caught: true, vitalStatus: 'DEAD' };
      prisma.encounter.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'run-1', 'enc-1', { vitalStatus: 'DEAD' }),
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
        service.update('user-1', 'run-1', 'enc-1', { caught: true }),
      ).rejects.toThrow(
        'An encounter labeled "Wild Encounter" already exists for this route',
      );
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
