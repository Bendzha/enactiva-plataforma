import { Module } from '@nestjs/common';
import { AreasService } from './areas.service.js';
import { PersonasController } from './personas.controller.js';
import { PersonasService } from './personas.service.js';

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, AreasService],
})
export class PersonasModule {}
