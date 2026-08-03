import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.game.findMany({ orderBy: { name: 'asc' } });
  }

  async findRoutesForGame(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }
    return this.prisma.route.findMany({
      where: { gameId },
      orderBy: { order: 'asc' },
    });
  }
}
