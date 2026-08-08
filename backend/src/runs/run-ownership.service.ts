import { Injectable, NotFoundException } from '@nestjs/common';
import { Run } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RunOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnership(userId: string, runId: string): Promise<Run> {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId },
    });
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    return run;
  }
}
