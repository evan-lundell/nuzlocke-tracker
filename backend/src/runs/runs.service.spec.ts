import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RunsService } from './runs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RunsService', () => {
  let service: RunsService;
  let prisma: {
    game: { findUnique: jest.Mock };
    rule: { findMany: jest.Mock };
    run: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    run: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
    runRule: { createMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      run: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
      runRule: { createMany: jest.fn() },
    };
    prisma = {
      game: { findUnique: jest.fn() },
      rule: { findMany: jest.fn() },
      run: { findMany: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RunsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RunsService>(RunsService);
  });

  describe('create', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', { gameId: 'missing-game' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a run with no rules when rules is omitted', async () => {
      prisma.game.findUnique.mockResolvedValue({ id: 'game-1' });
      tx.run.create.mockResolvedValue({ id: 'run-1' });
      const run = { id: 'run-1', runRules: [] };
      tx.run.findUniqueOrThrow.mockResolvedValue(run);

      await expect(
        service.create('user-1', { gameId: 'game-1', name: 'My Run' }),
      ).resolves.toBe(run);
      expect(tx.run.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', gameId: 'game-1', name: 'My Run' },
      });
      expect(tx.runRule.createMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a ruleId does not exist', async () => {
      prisma.game.findUnique.mockResolvedValue({ id: 'game-1' });
      prisma.rule.findMany.mockResolvedValue([]);

      await expect(
        service.create('user-1', {
          gameId: 'game-1',
          rules: [{ ruleId: 'rule-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a rule is not visible to the user, without distinguishing why', async () => {
      prisma.game.findUnique.mockResolvedValue({ id: 'game-1' });
      // The query itself scopes to visible rules, so a rule owned by
      // someone else simply never comes back here.
      prisma.rule.findMany.mockResolvedValue([]);

      await expect(
        service.create('user-1', {
          gameId: 'game-1',
          rules: [{ ruleId: 'rule-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.rule.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['rule-1'] },
          OR: [{ createdById: null }, { createdById: 'user-1' }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a run and its RunRule rows for deduped, selectable rules', async () => {
      prisma.game.findUnique.mockResolvedValue({ id: 'game-1' });
      prisma.rule.findMany.mockResolvedValue([
        { id: 'rule-1', createdById: null },
        { id: 'rule-2', createdById: 'user-1' },
      ]);
      tx.run.create.mockResolvedValue({ id: 'run-1' });
      const run = { id: 'run-1', runRules: [] };
      tx.run.findUniqueOrThrow.mockResolvedValue(run);

      await expect(
        service.create('user-1', {
          gameId: 'game-1',
          rules: [
            { ruleId: 'rule-1' },
            { ruleId: 'rule-2', config: { mode: 'PRIMARY' } },
            { ruleId: 'rule-1' },
          ],
        }),
      ).resolves.toBe(run);
      expect(tx.runRule.createMany).toHaveBeenCalledWith({
        data: [
          { runId: 'run-1', ruleId: 'rule-1', config: undefined },
          { runId: 'run-1', ruleId: 'rule-2', config: { mode: 'PRIMARY' } },
        ],
      });
    });
  });

  describe('findAllForUser', () => {
    it('returns runs for the user ordered by startedAt desc', async () => {
      const runs = [{ id: 'run-1' }];
      prisma.run.findMany.mockResolvedValue(runs);

      await expect(service.findAllForUser('user-1')).resolves.toBe(runs);
      expect(prisma.run.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { startedAt: 'desc' },
        include: { game: true, runRules: { include: { rule: true } } },
      });
    });
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when the run does not exist', async () => {
      prisma.run.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForUser('user-1', 'missing-run'),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes the query to the run id and user id, not filtering in memory', async () => {
      prisma.run.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser('user-1', 'run-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.run.findFirst).toHaveBeenCalledWith({
        where: { id: 'run-1', userId: 'user-1' },
        include: { game: true, runRules: { include: { rule: true } } },
      });
    });

    it('returns the run when it belongs to the user', async () => {
      const run = { id: 'run-1', userId: 'user-1' };
      prisma.run.findFirst.mockResolvedValue(run);

      await expect(service.findOneForUser('user-1', 'run-1')).resolves.toBe(
        run,
      );
    });
  });
});
