import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GamesModule } from './games/games.module';
import { RoutesModule } from './routes/routes.module';

@Module({
  imports: [PrismaModule, GamesModule, RoutesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
