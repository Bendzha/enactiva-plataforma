import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module.js';
import { RecuperacionController } from './recuperacion.controller.js';
import { RecuperacionService } from './recuperacion.service.js';

@Module({
  imports: [CorreoModule],
  controllers: [RecuperacionController],
  providers: [RecuperacionService],
})
export class RecuperacionModule {}
