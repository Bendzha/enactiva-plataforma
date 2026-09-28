import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { NivelAdmin, Rol } from '@enactiva/shared';
import { TTL_ESTADO_SESION_MS } from './constantes.js';

/**
 * Estado real de la persona, leído de identity-service y no del token.
 * El token dice quién es (`sub`); los roles, el nivel, la empresa y si sigue activa se
 * consultan, porque pueden haber cambiado después de que el token se firmó (ADR-0007, D2).
 */
export interface EstadoSesion {
  usuarioId: string;
  roles: Rol[];
  nivelAdmin: NivelAdmin | null;
  empresaId: string | null;
  activo: boolean;
}

/** Cómo obtiene un servicio el estado de una sesión. identity lo lee de su base; el resto lo pide. */
export interface ProveedorEstadoSesion {
  cargar(usuarioId: string): Promise<EstadoSesion | null>;
}

export const PROVEEDOR_ESTADO_SESION = 'PROVEEDOR_ESTADO_SESION';

export interface OpcionesCacheEstadoSesion {
  ttlMs?: number;
  /** Inyectable para poder probar el vencimiento sin esperar 30 segundos reales. */
  ahora?: () => number;
}

interface Entrada {
  expiraEn: number;
  valor: Promise<EstadoSesion | null>;
}

/**
 * Caché en memoria del estado de sesión, con vida corta (ADR-0007, decisión D2).
 *
 * Guarda la promesa y no el resultado: si llegan veinte peticiones del mismo usuario al mismo
 * tiempo, todas esperan la misma llamada en vez de disparar veinte. Si la llamada falla, la
 * entrada se descarta para no cachear un error transitorio.
 */
@Injectable()
export class CacheEstadoSesion {
  private readonly entradas = new Map<string, Entrada>();
  private readonly ttlMs: number;
  private readonly ahora: () => number;

  constructor(
    private readonly fuente: ProveedorEstadoSesion,
    opciones: OpcionesCacheEstadoSesion = {},
  ) {
    this.ttlMs = opciones.ttlMs ?? TTL_ESTADO_SESION_MS;
    this.ahora = opciones.ahora ?? Date.now;
  }

  async obtener(usuarioId: string): Promise<EstadoSesion | null> {
    const guardada = this.entradas.get(usuarioId);
    if (guardada && guardada.expiraEn > this.ahora()) {
      return guardada.valor;
    }

    const valor = this.fuente.cargar(usuarioId);
    this.entradas.set(usuarioId, { expiraEn: this.ahora() + this.ttlMs, valor });

    try {
      return await valor;
    } catch (error) {
      this.entradas.delete(usuarioId);
      throw error;
    }
  }

  /**
   * Borra lo cacheado. El servicio que desactiva a alguien puede llamar a esto para que el
   * cambio surta efecto al instante en su propio proceso, sin esperar los 30 segundos.
   */
  invalidar(usuarioId?: string): void {
    if (usuarioId === undefined) {
      this.entradas.clear();
      return;
    }
    this.entradas.delete(usuarioId);
  }
}

/**
 * Proveedor de relleno para los servicios que todavía no tienen de dónde leer la sesión
 * (fase M0). Falla de forma ruidosa y explícita: preferimos un 503 evidente antes que un
 * servicio que deje pasar peticiones autenticadas sin verificar nada.
 */
@Injectable()
export class ProveedorEstadoSesionNoDisponible implements ProveedorEstadoSesion {
  cargar(): Promise<EstadoSesion | null> {
    throw new ServiceUnavailableException(
      'Este servicio todavía no sabe consultar el estado de sesión (se conecta en la fase M1)',
    );
  }
}
