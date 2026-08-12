import { Module } from '@nestjs/common';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { AuthModule } from '../auth/auth.module';
import { RunsModule } from '../runs/runs.module';
import { RulesModule } from '../rules/rules.module';

@Module({
  imports: [AuthModule, RunsModule, RulesModule],
  controllers: [PartyController],
  providers: [PartyService],
})
export class PartyModule {}
