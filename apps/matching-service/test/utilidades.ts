import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { EstadoSesion, ProveedorEstadoSesion } from '@enactiva/service-kit';
import type { ContextoAfinidad, TallerAbierto } from '@enactiva/shared';

/**
 * matching-service no es dueño de casi nada: los talleres son de learning y los perfiles de
 * identity. En los tests esas dos puertas se reemplazan por dobles, para no depender de que
 * otros dos procesos estén levantados.
 *
 * Lo que sí se prueba de verdad es todo lo que es de este servicio: el orden del mazo, qué sale
 * y qué no, el aislamiento entre empresas y qué pasa al decidir una tarjeta.
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

/** Doble de learning e identity: responde lo que el test haya preparado. */
export class ClientesInternosFalsos {
  talleres: TallerAbierto[] = [];
  contexto: ContextoAfinidad = { personas: [], declaraciones: [], temas: [] };
  /** Lo que devuelve la inscripción; un test puede hacerla fallar como si el cupo se llenara. */
  alInscribir: () => Promise<unknown> = () => Promise.resolve({});
  inscripciones: string[] = [];

  talleresAbiertos(): Promise<TallerAbierto[]> {
    return Promise.resolve(this.talleres);
  }

  contextoAfinidad(
    personas: readonly string[],
    temas: readonly string[],
  ): Promise<ContextoAfinidad> {
    // Se comporta como identity: solo devuelve lo que se pidió y existe para esa empresa.
    return Promise.resolve({
      personas: this.contexto.personas.filter((persona) => personas.includes(persona.id)),
      declaraciones: this.contexto.declaraciones.filter(
        (declaracion) =>
          personas.includes(declaracion.usuarioId) && temas.includes(declaracion.temaId),
      ),
      temas: this.contexto.temas.filter((tema) => temas.includes(tema.id)),
    });
  }

  inscribir(tallerId: string): Promise<unknown> {
    this.inscripciones.push(tallerId);
    return this.alInscribir();
  }
}

export function tokenDe(app: INestApplication, usuarioId: string): string {
  return app.get(JwtService).sign({ sub: usuarioId });
}

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
