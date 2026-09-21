import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '../generated/prisma/client.js';
import { crearClienteAcotado, type ClienteAcotado } from './scope-empresa.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Cliente acotado a la empresa de quien hace la petición: es el que deben usar los módulos
   * que manejan datos de empresas. El cliente sin acotar (this) queda para auth, auditoría y
   * tareas del equipo ENACTIVA (ADR-0003).
   */
  readonly acotado: ClienteAcotado;

  constructor(cls: ClsService) {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
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
