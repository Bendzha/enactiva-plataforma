import { Injectable, Logger } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CorreoRecordatorioService } from './correo.service.js';

const UNA_HORA_MS = 60 * 60 * 1000;
const UN_DIA_MS = 24 * UNA_HORA_MS;

/** Las dos ventanas, en orden: la de una hora manda primero porque es la más urgente. */
const VENTANAS = [
  { momento: 'UNA_HORA' as const, desde: 0, hasta: UNA_HORA_MS },
  { momento: 'VEINTICUATRO_HORAS' as const, desde: UNA_HORA_MS, hasta: UN_DIA_MS },
];

export interface ResumenEnvio {
  revisados: number;
  correos: number;
}

/**
 * Los recordatorios por correo que pidió la clienta en la reunión del 2026-09-29.
 *
 * Dos por taller: uno el día antes, para reorganizar la agenda, y otro una hora antes, que es
 * el que de verdad hace que la gente llegue.
 *
 * Las ventanas no se solapan a propósito. Un taller publicado media hora antes de ocurrir entra
 * solo en la de una hora: recibir "mañana tienes un taller" treinta minutos antes de empezarlo
 * sería peor que no recibir nada.
 */
@Injectable()
export class RecordatoriosService {
  private readonly logger = new Logger(RecordatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoRecordatorioService,
    private readonly identity: IdentityCliente,
  ) {}

  /**
   * Revisa las dos ventanas y manda lo que falte.
   *
   * Usa el cliente sin acotar: lo llama un reloj, no una persona, así que no hay empresa en
   * contexto de la cual acotar. Recorre todas las empresas a propósito —los recordatorios son
   * de todo el piloto— y cada correo va solo a quien está inscrito en ese taller.
   */
  async enviarPendientes(ahora = new Date()): Promise<ResumenEnvio> {
    let revisados = 0;
    let correos = 0;

    for (const ventana of VENTANAS) {
      const talleres = await this.prisma.taller.findMany({
        where: {
          inicioAt: {
            gt: new Date(ahora.getTime() + ventana.desde),
            lte: new Date(ahora.getTime() + ventana.hasta),
          },
          recordatorios: { none: { momento: ventana.momento } },
        },
        include: { inscripciones: { select: { usuarioId: true } } },
      });

      for (const taller of talleres) {
        revisados += 1;
        const enviados = await this.recordarTaller(taller, ventana.momento);
        correos += enviados;
      }
    }

    if (correos > 0) {
      this.logger.log(`Recordatorios enviados: ${correos} correos de ${revisados} talleres`);
    }
    return { revisados, correos };
  }

  private async recordarTaller(
    taller: {
      id: string;
      empresaId: string;
      capacitadorId: string;
      nombre: string;
      ubicacion: string;
      inicioAt: Date;
      inscripciones: { usuarioId: string }[];
    },
    momento: 'UNA_HORA' | 'VEINTICUATRO_HORAS',
  ): Promise<number> {
    const inscritos = taller.inscripciones.map((inscripcion) => inscripcion.usuarioId);
    const destinatarios = await this.identity.destinatarios([taller.capacitadorId, ...inscritos]);

    let enviados = 0;
    for (const persona of destinatarios) {
      const salio = await this.correo.enviar({
        para: persona.email,
        nombre: persona.nombre,
        tallerNombre: taller.nombre,
        ubicacion: taller.ubicacion,
        inicioAt: taller.inicioAt,
        esInminente: momento === 'UNA_HORA',
        dicta: persona.id === taller.capacitadorId,
        inscritos: inscritos.length,
      });
      if (salio) enviados += 1;
    }

    /**
     * Se anota aunque no haya salido ningún correo: un taller sin inscritos no tiene a quién
     * recordarle nada, y si no quedara anotado el reloj lo revisaría otra vez cada cinco
     * minutos hasta que ocurriera.
     */
    await this.prisma.recordatorioTaller.create({
      data: { empresaId: taller.empresaId, tallerId: taller.id, momento, enviados },
    });

    return enviados;
  }
}
