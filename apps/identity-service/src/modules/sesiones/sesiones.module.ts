import { Module } from '@nestjs/common';
import { InvitacionesModule } from '../invitaciones/invitaciones.module.js';
import { SesionesController } from './sesiones.controller.js';
import { SesionesService } from './sesiones.service.js';

@Module({
  imports: [InvitacionesModule],
  controllers: [SesionesController],
  providers: [SesionesService],
  exports: [SesionesService],
})
export class SesionesModule {}
