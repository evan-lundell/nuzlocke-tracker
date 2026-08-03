import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

describe('GamesController', () => {
  let controller: GamesController;
  let service: { findAll: jest.Mock; findRoutesForGame: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn(), findRoutesForGame: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [{ provide: GamesService, useValue: service }],
    }).compile();

    controller = module.get<GamesController>(GamesController);
  });

  describe('findAll', () => {
    it('delegates to GamesService.findAll', async () => {
      const games = [{ id: '1', identifier: 'leafgreen' }];
      service.findAll.mockResolvedValue(games);

      await expect(controller.findAll()).resolves.toBe(games);
    });
  });

  describe('findRoutes', () => {
    it('delegates to GamesService.findRoutesForGame with the game id', async () => {
      const routes = [{ id: 'r1', identifier: 'pallet-town' }];
      service.findRoutesForGame.mockResolvedValue(routes);

      await expect(controller.findRoutes('game-1')).resolves.toBe(routes);
      expect(service.findRoutesForGame).toHaveBeenCalledWith('game-1');
    });
  });
});
