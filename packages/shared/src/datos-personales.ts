/**
 * Exportación y supresión de los datos de una persona (Ley 21.719, SPEC §3.7).
 *
 * Los datos de alguien están repartidos en tres bases que no se ven entre sí (ADR-0007), así que
 * ni exportar ni suprimir se pueden resolver en un solo servicio: el gateway le pregunta a cada
 * uno por separado y junta las respuestas.
 */

/** Lo que cada servicio entrega sobre la persona que lo pide. */
export interface DatosDeServicio {
  servicio: string;
  /** Las tablas de ese servicio, cada una con sus filas. */
  contenido: Record<string, unknown[]>;
}

export interface ExportacionDatos {
  generadoAt: string;
  usuarioId: string;
  /**
   * Qué se exportó y qué no. Dicho en el archivo mismo, no en un correo aparte: quien lo abre
   * tiene que poder entender qué tiene en la mano.
   */
  aviso: string;
  servicios: DatosDeServicio[];
}

/** Lo que cada servicio borró o anonimizó. */
export interface SupresionDeServicio {
  servicio: string;
  /** Cuántas filas se fueron, por tabla. */
  borrado: Record<string, number>;
  /** Lo que se conserva y por qué: es parte de la respuesta, no una omisión. */
  conservado: string[];
}

export interface ResultadoSupresion {
  suprimidoAt: string;
  usuarioId: string;
  servicios: SupresionDeServicio[];
}

/** Frase que hay que escribir para confirmar. Un botón solo es muy poco para algo irreversible. */
export const CONFIRMACION_SUPRESION = 'ELIMINAR MI CUENTA';
