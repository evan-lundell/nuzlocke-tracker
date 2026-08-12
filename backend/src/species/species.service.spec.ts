import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesService } from './species.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SpeciesService', () => {
  let service: SpeciesService;
  let prisma: { species: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { species: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpeciesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SpeciesService>(SpeciesService);
  });

  describe('findAll', () => {
    it('returns all species ordered by pokedex number', async () => {
      const species = [{ id: '1', name: 'Bulbasaur', pokedexNumber: 1 }];
      prisma.species.findMany.mockResolvedValue(species);

      await expect(service.findAll()).resolves.toBe(species);
      expect(prisma.species.findMany).toHaveBeenCalledWith({
        orderBy: { pokedexNumber: 'asc' },
      });
    });
  });
});
