import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { RunOwnershipService } from './run-ownership.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RunsController],
  providers: [RunsService, RunOwnershipService],
  exports: [RunOwnershipService],
})
export class RunsModule {}
