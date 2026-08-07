import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PartyService } from './party.service';
import { AddPartyMembershipDto } from './dto/add-party-membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('runs/:runId/party')
@UseGuards(JwtAuthGuard)
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Body() dto: AddPartyMembershipDto,
  ) {
    return this.partyService.create(user.sub, runId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    return this.partyService.findAllForRun(user.sub, runId);
  }

  @Delete(':encounterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('runId') runId: string,
    @Param('encounterId') encounterId: string,
  ) {
    return this.partyService.remove(user.sub, runId, encounterId);
  }
}
