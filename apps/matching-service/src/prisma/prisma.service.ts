import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { crearClienteAcotado, type ClienteAcotado } from './scope-empresa.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Cliente acotado a la empresa de quien hace la petición. Todo lo de este servicio pertenece
   * a una empresa, así que el cliente sin acotar (this) solo se usa para la auditoría.
   */
  readonly acotado: ClienteAcotado;

  constructor(cls: ClsService) {
    super({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL_MATCHING }) });
    this.acotado = crearClienteAcotado(this, cls);
  }

  // Conecta al iniciar para fallar temprano si la base no está disponible.
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
