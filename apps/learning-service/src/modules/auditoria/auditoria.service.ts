import { Injectable, Logger } from '@nestjs/common';
import type { AccionAuditoria, Rol } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Evento de auditoría (Ley 21.719). Regla: `camposModificados` lleva NOMBRES de campos,
 * nunca sus valores; el registro no debe contener datos personales en claro.
 */
export interface EventoAuditoria {
  accion: AccionAuditoria;
  entidad: string;
  entidadId?: string | null;
  actorId?: string | null;
  actorRol?: Rol | null;
  empresaId?: string | null;
  camposModificados?: string[];
  ip?: string | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: EventoAuditoria): Promise<void> {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          accion: evento.accion,
          entidad: evento.entidad,
          entidadId: evento.entidadId ?? null,
          actorId: evento.actorId ?? null,
          actorRol: evento.actorRol ?? null,
          empresaId: evento.empresaId ?? null,
          camposModificados: evento.camposModificados ?? [],
          ip: evento.ip ?? null,
        },
      });
    } catch (error) {
      // Nunca romper la operación del usuario por un fallo al auditar, pero sí dejar rastro.
      this.logger.error(
        `No se pudo registrar la auditoría (${evento.accion} ${evento.entidad})`,
        error,
      );
    }
  }
}
