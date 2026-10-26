import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { AgendaService } from './agenda.service.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { TalleresController } from './talleres.controller.js';
import { TalleresInternoController } from './talleres-interno.controller.js';
import { TalleresService } from './talleres.service.js';

@Module({
  controllers: [TalleresController, TalleresInternoController],
  providers: [TalleresService, DisponibilidadService, AgendaService, IdentityCliente],
})
export class TalleresModule {}
