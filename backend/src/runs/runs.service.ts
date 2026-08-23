import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRunDto } from './dto/create-run.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRunDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: dto.gameId },
    });
    if (!game) {
      throw new NotFoundException(`Game ${dto.gameId} not found`);
    }

    const rules = [
      ...new Map((dto.rules ?? []).map((rule) => [rule.ruleId, rule])).values(),
    ];
    const ruleIds = rules.map((rule) => rule.ruleId);
    if (ruleIds.length > 0) {
      await this.assertRulesSelectable(userId, ruleIds);
    }

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: { userId, gameId: dto.gameId, name: dto.name },
      });
      if (rules.length > 0) {
        await tx.runRule.createMany({
          data: rules.map(({ ruleId, config }) => ({
            runId: run.id,
            ruleId,
            config: config as Prisma.InputJsonValue | undefined,
          })),
        });
      }
      return tx.run.findUniqueOrThrow({
        where: { id: run.id },
        include: { game: true, runRules: { include: { rule: true } } },
      });
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.run.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { game: true, runRules: { include: { rule: true } } },
    });
  }

  async findOneForUser(userId: string, runId: string) {
    const run = await this.prisma.run.findFirst({
      where: { id: runId, userId },
      include: { game: true, runRules: { include: { rule: true } } },
    });
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    return run;
  }

  private async assertRulesSelectable(userId: string, ruleIds: string[]) {
    const rules = await this.prisma.rule.findMany({
      where: {
        id: { in: ruleIds },
        OR: [{ createdById: null }, { createdById: userId }],
      },
    });
    const foundIds = new Set(rules.map((rule) => rule.id));
    const notSelectable = ruleIds.filter((id) => !foundIds.has(id));
    if (notSelectable.length > 0) {
      throw new BadRequestException(
        `Rule(s) not selectable: ${notSelectable.join(', ')}`,
      );
    }
  }
}
