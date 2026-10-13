/**
 * Métricas de intereses declarados (acta 2026-09-29).
 *
 * En la reunión quedó dicho que las métricas de abajo del panel se encenderían cuando la gente
 * registrara sus intereses. Con el Slice 4 ya hay datos, así que aquí están.
 *
 * Son **agregados**: cuánta gente, cuántos temas, dónde falta quien enseñe. Nunca dicen quién
 * declaró qué, porque para decidir dónde invertir en formación basta el número (Ley 21.719).
 */

/** Cuánta gente ofrece y cuánta busca un mismo tema. */
export interface TemaDemanda {
  temaId: string;
  nombre: string;
  puedenEnsenar: number;
  quierenAprender: number;
}

/** Cuántas filas de cada lista se devuelven: lo justo para leer de una mirada. */
export const MAXIMO_TEMAS_DESTACADOS = 5;

export interface MetricasIntereses {
  personasActivas: number;
  /** Personas activas que ya declararon al menos un tema. */
  personasConPerfil: number;
  temas: number;
  declaraciones: number;
  /**
   * Temas que alguien quiere aprender y **nadie** de la empresa declaró que puede enseñar.
   * Es la métrica que contesta dónde hay que traer formación de afuera.
   */
  brechas: TemaDemanda[];
  masOfrecidos: TemaDemanda[];
  masBuscados: TemaDemanda[];
}

export interface InteresesDeEmpresa {
  empresaId: string;
  nombre: string;
  personasActivas: number;
  personasConPerfil: number;
  temas: number;
  declaraciones: number;
  /** Cuántos temas de esa empresa nadie puede enseñar todavía. */
  brechas: number;
}

export interface MetricasGlobales {
  personasActivas: number;
  personasConPerfil: number;
  temas: number;
  declaraciones: number;
  empresas: InteresesDeEmpresa[];
}
