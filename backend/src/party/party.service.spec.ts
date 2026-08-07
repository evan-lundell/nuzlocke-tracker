import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PartyService } from './party.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

describe('PartyService', () => {
  let service: PartyService;
  let prisma: {
    run: { findFirst: jest.Mock };
    encounter: { findFirst: jest.Mock };
    partyMembership: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  const duplicateError = () =>
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    prisma = {
      run: { findFirst: jest.fn() },
      encounter: { findFirst: jest.fn() },
      partyMembership: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PartyService>(PartyService);
  });

  describe('create', () => {
    it('throws NotFoundException when the run does not exist or is not owned by the user', async () => {
      prisma.run.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.run.findFirst).toHaveBeenCalledWith({
        where: { id: 'run-1', userId: 'user-1' },
      });
    });

    it('throws NotFoundException when the encounter does not belong to the run', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.encounter.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
        where: { id: 'enc-1', runId: 'run-1' },
      });
    });

    it('throws BadRequestException when the encounter has not been caught', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        caught: false,
        vitalStatus: 'ALIVE',
      });

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the encounter is dead', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        caught: true,
        vitalStatus: 'DEAD',
      });

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the party membership for a caught, alive encounter', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        caught: true,
        vitalStatus: 'ALIVE',
      });
      const membership = { id: 'mem-1', runId: 'run-1', encounterId: 'enc-1' };
      prisma.partyMembership.create.mockResolvedValue(membership);

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).resolves.toBe(membership);
      expect(prisma.partyMembership.create).toHaveBeenCalledWith({
        data: { runId: 'run-1', encounterId: 'enc-1' },
        include: { encounter: { include: { species: true, route: true } } },
      });
    });

    it('throws ConflictException when the encounter is already in the party', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.encounter.findFirst.mockResolvedValue({
        id: 'enc-1',
        caught: true,
        vitalStatus: 'ALIVE',
      });
      prisma.partyMembership.create.mockRejectedValue(duplicateError());

      await expect(
        service.create('user-1', 'run-1', { encounterId: 'enc-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllForRun', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      prisma.run.findFirst.mockResolvedValue(null);

      await expect(service.findAllForRun('user-1', 'run-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns party memberships for the run ordered by createdAt asc', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      const memberships = [{ id: 'mem-1' }];
      prisma.partyMembership.findMany.mockResolvedValue(memberships);

      await expect(service.findAllForRun('user-1', 'run-1')).resolves.toBe(
        memberships,
      );
      expect(prisma.partyMembership.findMany).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
        include: { encounter: { include: { species: true, route: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the run is not owned by the user', async () => {
      prisma.run.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'run-1', 'enc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the encounter is not in the party for this run', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.partyMembership.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'run-1', 'enc-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.partyMembership.findFirst).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1', runId: 'run-1' },
      });
    });

    it('deletes the party membership', async () => {
      prisma.run.findFirst.mockResolvedValue({ id: 'run-1' });
      prisma.partyMembership.findFirst.mockResolvedValue({ id: 'mem-1' });
      prisma.partyMembership.delete.mockResolvedValue({ id: 'mem-1' });

      await service.remove('user-1', 'run-1', 'enc-1');
      expect(prisma.partyMembership.delete).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
      });
    });
  });
});
