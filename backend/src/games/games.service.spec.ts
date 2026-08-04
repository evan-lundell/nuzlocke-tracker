import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GamesService } from './games.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamesService', () => {
  let service: GamesService;
  let prisma: {
    game: { findMany: jest.Mock; findUnique: jest.Mock };
    route: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      game: { findMany: jest.fn(), findUnique: jest.fn() },
      route: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GamesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  describe('findAll', () => {
    it('returns games ordered by name', async () => {
      const games = [{ id: '1', identifier: 'leafgreen', name: 'LeafGreen' }];
      prisma.game.findMany.mockResolvedValue(games);

      await expect(service.findAll()).resolves.toBe(games);
      expect(prisma.game.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findRoutesForGame', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.findRoutesForGame('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.route.findMany).not.toHaveBeenCalled();
    });

    it('returns routes for an existing game ordered by order', async () => {
      const game = { id: 'game-1' };
      const routes = [
        { id: 'r1', order: 0 },
        { id: 'r2', order: 1 },
      ];
      prisma.game.findUnique.mockResolvedValue(game);
      prisma.route.findMany.mockResolvedValue(routes);

      await expect(service.findRoutesForGame('game-1')).resolves.toBe(routes);
      expect(prisma.route.findMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1' },
        orderBy: { order: 'asc' },
      });
    });
  });
});
