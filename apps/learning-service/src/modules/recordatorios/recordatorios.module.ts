import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { CorreoRecordatorioService } from './correo.service.js';
import { RecordatoriosService } from './recordatorios.service.js';
import { RelojDeRecordatorios } from './reloj.js';

@Module({
  providers: [
    RecordatoriosService,
    CorreoRecordatorioService,
    RelojDeRecordatorios,
    IdentityCliente,
  ],
  exports: [RecordatoriosService],
})
export class RecordatoriosModule {}
