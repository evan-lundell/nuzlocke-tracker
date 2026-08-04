import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findSpeciesForRoute(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }
    return this.prisma.routeSpecies.findMany({
      where: { routeId },
      include: { species: true },
    });
  }
}
