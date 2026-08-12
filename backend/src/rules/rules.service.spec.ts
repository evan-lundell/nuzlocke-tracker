import { Test, TestingModule } from '@nestjs/testing';
import { RulesService } from './rules.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RulesService', () => {
  let service: RulesService;
  let prisma: {
    rule: { findMany: jest.Mock };
    runRule: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      rule: { findMany: jest.fn() },
      runRule: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RulesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RulesService>(RulesService);
  });

  describe('findAllForUser', () => {
    it("returns built-in and the user's own custom rules, ordered by name", async () => {
      const rules = [{ id: '1', name: 'Type-lock' }];
      prisma.rule.findMany.mockResolvedValue(rules);

      await expect(service.findAllForUser('user-1')).resolves.toBe(rules);
      expect(prisma.rule.findMany).toHaveBeenCalledWith({
        where: { OR: [{ createdById: null }, { createdById: 'user-1' }] },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('isRuleActiveForRun', () => {
    it('returns true when a matching RunRule exists', async () => {
      prisma.runRule.findFirst.mockResolvedValue({ id: 'rr-1' });

      await expect(
        service.isRuleActiveForRun('run-1', 'type-lock'),
      ).resolves.toBe(true);
      expect(prisma.runRule.findFirst).toHaveBeenCalledWith({
        where: { runId: 'run-1', rule: { key: 'type-lock' } },
      });
    });

    it('returns false when no matching RunRule exists', async () => {
      prisma.runRule.findFirst.mockResolvedValue(null);

      await expect(
        service.isRuleActiveForRun('run-1', 'type-lock'),
      ).resolves.toBe(false);
    });
  });
});
