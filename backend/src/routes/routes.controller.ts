import { Controller, Get, Param } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get(':id/species')
  findSpecies(@Param('id') id: string) {
    return this.routesService.findSpeciesForRoute(id);
  }
}
