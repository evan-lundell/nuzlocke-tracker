import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AuthModule } from '../auth/auth.module';
import { RunsModule } from '../runs/runs.module';

@Module({
  imports: [AuthModule, RunsModule],
  controllers: [EncountersController],
  providers: [EncountersService],
})
export class EncountersModule {}
