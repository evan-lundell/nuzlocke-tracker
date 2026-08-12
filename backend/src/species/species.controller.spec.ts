import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';

describe('SpeciesController', () => {
  let controller: SpeciesController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpeciesController],
      providers: [{ provide: SpeciesService, useValue: service }],
    }).compile();

    controller = module.get<SpeciesController>(SpeciesController);
  });

  describe('findAll', () => {
    it('delegates to SpeciesService.findAll', async () => {
      const species = [{ id: '1', name: 'Bulbasaur' }];
      service.findAll.mockResolvedValue(species);

      await expect(controller.findAll()).resolves.toBe(species);
    });
  });
});
