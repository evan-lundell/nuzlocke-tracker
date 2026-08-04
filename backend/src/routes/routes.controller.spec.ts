import { Test, TestingModule } from '@nestjs/testing';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

describe('RoutesController', () => {
  let controller: RoutesController;
  let service: { findSpeciesForRoute: jest.Mock };

  beforeEach(async () => {
    service = { findSpeciesForRoute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutesController],
      providers: [{ provide: RoutesService, useValue: service }],
    }).compile();

    controller = module.get<RoutesController>(RoutesController);
  });

  describe('findSpecies', () => {
    it('delegates to RoutesService.findSpeciesForRoute with the route id', async () => {
      const routeSpecies = [{ id: 'rs1', species: { id: 's1' } }];
      service.findSpeciesForRoute.mockResolvedValue(routeSpecies);

      await expect(controller.findSpecies('route-1')).resolves.toBe(
        routeSpecies,
      );
      expect(service.findSpeciesForRoute).toHaveBeenCalledWith('route-1');
    });
  });
});
