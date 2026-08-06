import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('runs/:runId/encounters')
@UseGuards(JwtAuthGuard)
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Body() dto: CreateEncounterDto,
  ) {
    return this.encountersService.create(user.sub, runId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    return this.encountersService.findAllForRun(user.sub, runId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Param('id') id: string,
  ) {
    return this.encountersService.findOneForRun(user.sub, runId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.encountersService.update(user.sub, runId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Param('id') id: string,
  ) {
    return this.encountersService.remove(user.sub, runId, id);
  }
}
