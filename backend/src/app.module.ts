import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [PrismaModule, GamesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
