import { Controller, Get } from '@nestjs/common';
import { SpeciesService } from './species.service';

@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get()
  findAll() {
    return this.speciesService.findAll();
  }
}
