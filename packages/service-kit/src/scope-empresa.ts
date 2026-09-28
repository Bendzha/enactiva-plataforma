import { ForbiddenException } from '@nestjs/common';
import type { SesionActual } from './sesion.js';

/** Campo que identifica la empresa dueña de las filas de un modelo. */
export type CampoEmpresa = 'empresaId' | 'id';

/**
 * Modelos cuyos datos pertenecen a una empresa, y el campo que la identifica.
 * Cada servicio declara el suyo. Al agregar un modelo con `empresaId` hay que registrarlo, o sus
 * datos quedarán visibles entre empresas (ADR-0003).
 */
export type ModelosAcotados = Record<string, CampoEmpresa>;

const OPERACIONES_CON_WHERE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

const OPERACIONES_QUE_CREAN = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

export interface ArgsConsulta {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
}

export interface ParametrosAcotar {
  modelo: string | undefined;
  operacion: string;
  args: ArgsConsulta;
  sesion: SesionActual | undefined;
  modelos: ModelosAcotados;
}

/**
 * Agrega el filtro por empresa a los argumentos de una consulta de Prisma.
 *
 * Esta es la **regla**, y vive en un solo lugar a propósito: si cada servicio la reimplementara,
 * bastaría con que uno la escribiera mal para filtrar datos de una empresa a otra. Cada servicio
 * solo la conecta a su cliente Prisma dentro de `$extends`, en unas pocas líneas, porque los tipos
 * del cliente generado son distintos en cada base.
 *
 * El equipo ENACTIVA (rol ADMIN_ENACTIVA) no se acota: ve todas las empresas del piloto.
 */
export function acotarArgs({
  modelo,
  operacion,
  args,
  sesion,
  modelos,
}: ParametrosAcotar): ArgsConsulta {
  const campo = modelo ? modelos[modelo] : undefined;
  if (!campo) {
    return args;
  }

  if (!sesion) {
    // Fuera de una petición HTTP no hay a quién acotar: se prefiere fallar antes que filtrar.
    throw new Error(
      `Consulta acotada por empresa sin sesión en contexto (${modelo}.${operacion}). ` +
        'Usa el cliente sin acotar solo donde corresponda.',
    );
  }

  if (sesion.roles.includes('ADMIN_ENACTIVA')) {
    return args;
  }

  if (!sesion.empresaId) {
    throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
  }

  const filtroEmpresa = { [campo]: sesion.empresaId };
  const acotados: ArgsConsulta = { ...args };

  if (OPERACIONES_CON_WHERE.has(operacion)) {
    // El filtro se agrega dentro de AND y no en el primer nivel: así findUnique conserva arriba
    // su campo único (Prisma lo exige) y de todas formas queda acotado.
    const where = acotados.where ?? {};
    const andPrevio = Array.isArray(where.AND)
      ? (where.AND as Record<string, unknown>[])
      : where.AND
        ? [where.AND as Record<string, unknown>]
        : [];
    acotados.where = { ...where, AND: [...andPrevio, filtroEmpresa] };
  }

  if (OPERACIONES_QUE_CREAN.has(operacion)) {
    if (campo === 'id') {
      // Crear empresas es exclusivo del equipo ENACTIVA.
      throw new ForbiddenException('No puedes crear registros de otra empresa');
    }
    if (Array.isArray(acotados.data)) {
      acotados.data = acotados.data.map((fila) => ({ ...fila, ...filtroEmpresa }));
    } else if (acotados.data) {
      acotados.data = { ...acotados.data, ...filtroEmpresa };
    }
    if (acotados.create) {
      acotados.create = { ...acotados.create, ...filtroEmpresa };
    }
  }

  return acotados;
}
