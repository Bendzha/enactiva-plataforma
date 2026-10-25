import { Module } from '@nestjs/common';
import { ClientesInternos } from '../../clientes.js';
import { DecisionService } from './decision.service.js';
import { MazoController } from './mazo.controller.js';
import { MazoService } from './mazo.service.js';

@Module({
  controllers: [MazoController],
  providers: [MazoService, DecisionService, ClientesInternos],
})
export class MazoModule {}
