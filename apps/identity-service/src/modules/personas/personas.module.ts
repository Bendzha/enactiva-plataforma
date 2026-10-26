import { Module } from '@nestjs/common';
import { AreasService } from './areas.service.js';
import { DestinatariosInternoController } from './destinatarios-interno.controller.js';
import { ImportacionService } from './importacion.service.js';
import { PersonasController } from './personas.controller.js';
import { PersonasService } from './personas.service.js';

@Module({
  controllers: [PersonasController, DestinatariosInternoController],
  providers: [PersonasService, AreasService, ImportacionService],
})
export class PersonasModule {}
