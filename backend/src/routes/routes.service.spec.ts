import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoutesService', () => {
  let service: RoutesService;
  let prisma: {
    route: { findUnique: jest.Mock };
    routeSpecies: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      route: { findUnique: jest.fn() },
      routeSpecies: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
  });

  describe('findSpeciesForRoute', () => {
    it('throws NotFoundException when the route does not exist', async () => {
      prisma.route.findUnique.mockResolvedValue(null);

      await expect(service.findSpeciesForRoute('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.routeSpecies.findMany).not.toHaveBeenCalled();
    });

    it('returns route species with species included for an existing route', async () => {
      const route = { id: 'route-1' };
      const routeSpecies = [
        {
          id: 'rs1',
          routeId: 'route-1',
          species: { id: 's1', name: 'Bulbasaur' },
        },
      ];
      prisma.route.findUnique.mockResolvedValue(route);
      prisma.routeSpecies.findMany.mockResolvedValue(routeSpecies);

      await expect(service.findSpeciesForRoute('route-1')).resolves.toBe(
        routeSpecies,
      );
      expect(prisma.routeSpecies.findMany).toHaveBeenCalledWith({
        where: { routeId: 'route-1' },
        include: { species: true },
      });
    });
  });
});
