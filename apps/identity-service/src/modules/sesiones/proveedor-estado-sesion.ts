import { Injectable } from '@nestjs/common';
import type { EstadoSesion, ProveedorEstadoSesion } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * identity-service es el único servicio que lee el estado de sesión de su propia base, sin
 * llamar a nadie: las tablas de usuarios son suyas (ADR-0007, decisión D1).
 *
 * Usa el cliente SIN acotar a propósito: en el momento en que el guard pregunta todavía no hay
 * sesión en el contexto, que es justamente lo que se está resolviendo.
 */
@Injectable()
export class ProveedorEstadoSesionLocal implements ProveedorEstadoSesion {
  constructor(private readonly prisma: PrismaService) {}

  async cargar(usuarioId: string): Promise<EstadoSesion | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        estado: true,
        empresaId: true,
        nivelAdmin: true,
        roles: { select: { rol: true } },
      },
    });

    if (!usuario) {
      return null;
    }

    return {
      usuarioId: usuario.id,
      roles: usuario.roles.map((fila) => fila.rol),
      nivelAdmin: usuario.nivelAdmin,
      empresaId: usuario.empresaId,
      activo: usuario.estado === 'ACTIVO',
    };
  }
}
