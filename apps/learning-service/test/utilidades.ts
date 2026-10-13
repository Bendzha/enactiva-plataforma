import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { EstadoSesion, ProveedorEstadoSesion } from '@enactiva/service-kit';
import { IdentityCliente } from '../src/identity.cliente.js';

/**
 * Este servicio no tiene usuarios ni temas: se los pregunta a identity-service por HTTP
 * (ADR-0007). En los tests esas dos puertas se reemplazan por dobles, para no depender de que
 * otro proceso esté levantado. Lo que sí se prueba de verdad es todo lo que es de este servicio:
 * el cupo, las fechas, el aislamiento entre empresas y los permisos.
 *
 * La llamada real a identity se verifica a mano en el navegador, con los servicios corriendo.
 */
export class ProveedorEstadoSesionFalso implements ProveedorEstadoSesion {
  private readonly personas = new Map<string, EstadoSesion>();

  agregar(estado: EstadoSesion): EstadoSesion {
    this.personas.set(estado.usuarioId, estado);
    return estado;
  }

  cargar(usuarioId: string): Promise<EstadoSesion | null> {
    return Promise.resolve(this.personas.get(usuarioId) ?? null);
  }
}

/** Catálogo de temas falso: responde como identity, acotado a lo que el test declaró. */
export class IdentityClienteFalso {
  private readonly temas = new Map<string, string>();

  agregarTema(id: string, nombre: string): string {
    this.temas.set(id, nombre);
    return id;
  }

  temasPorIds(ids: readonly string[]): Promise<Map<string, string>> {
    const encontrados = new Map<string, string>();
    for (const id of new Set(ids)) {
      const nombre = this.temas.get(id);
      if (nombre) encontrados.set(id, nombre);
    }
    return Promise.resolve(encontrados);
  }
}

export type IdentityFalso = IdentityClienteFalso & IdentityCliente;

export function tokenDe(app: INestApplication, usuarioId: string): string {
  return app.get(JwtService).sign({ sub: usuarioId });
}

/** Una fecha a N días de hoy, para no escribir fechas fijas que caducan. */
export function enDias(dias: number, hora = 10): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha.toISOString();
}

export const ALMACEN_SIN_LIMITE = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};
