import { Module } from '@nestjs/common';
import { ClientesInternos } from '../../clientes.js';
import { PuntuacionController } from './puntuacion.controller.js';
import { PuntuacionService } from './puntuacion.service.js';

@Module({
  controllers: [PuntuacionController],
  providers: [PuntuacionService, ClientesInternos],
})
export class PuntuacionModule {}
