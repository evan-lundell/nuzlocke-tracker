import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string) {
    return this.prisma.rule.findMany({
      where: { OR: [{ createdById: null }, { createdById: userId }] },
      orderBy: { name: 'asc' },
    });
  }

  async isRuleActiveForRun(runId: string, key: string): Promise<boolean> {
    const runRule = await this.prisma.runRule.findFirst({
      where: { runId, rule: { key } },
    });
    return runRule !== null;
  }
}
