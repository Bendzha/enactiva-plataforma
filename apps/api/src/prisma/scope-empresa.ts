import { ForbiddenException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { CLS_SESION, type SesionActual } from '../common/sesion.js';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Modelos cuyos datos pertenecen a una empresa, y el campo que la identifica.
 * Al agregar un modelo nuevo con `empresaId` hay que registrarlo aquí, o sus datos
 * quedarán visibles entre empresas (ADR-0003).
 */
export const MODELOS_ACOTADOS: Record<string, 'empresaId' | 'id'> = {
  Usuario: 'empresaId',
  Empresa: 'id',
};

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

interface ArgsConsulta {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
}

/**
 * Cliente de Prisma que acota automáticamente las consultas a la empresa de quien hace la petición.
 * El equipo ENACTIVA (rol ADMIN_ENACTIVA) no se acota: ve todas las empresas del piloto.
 */
export function crearClienteAcotado(cliente: PrismaClient, cls: ClsService) {
  return cliente.$extends({
    name: 'scope-empresa',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const campo = model ? MODELOS_ACOTADOS[model] : undefined;
          if (!campo) {
            return query(args);
          }

          const sesion = cls.get<SesionActual | undefined>(CLS_SESION);
          if (!sesion) {
            // Fuera de una petición HTTP no hay a quién acotar: se prefiere fallar antes que filtrar.
            throw new Error(
              `Consulta acotada por empresa sin sesión en contexto (${model}.${operation}). ` +
                'Usa el cliente sin acotar solo donde corresponda.',
            );
          }

          if (sesion.roles.includes('ADMIN_ENACTIVA')) {
            return query(args);
          }

          if (!sesion.empresaId) {
            throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
          }

          const argsConsulta = (args ?? {}) as ArgsConsulta;
          const filtroEmpresa = { [campo]: sesion.empresaId };

          if (OPERACIONES_CON_WHERE.has(operation)) {
            // El filtro se agrega dentro de AND y no en el primer nivel: así findUnique conserva
            // arriba su campo único (Prisma lo exige) y de todas formas queda acotado.
            const where = argsConsulta.where ?? {};
            const andPrevio = Array.isArray(where.AND)
              ? (where.AND as Record<string, unknown>[])
              : where.AND
                ? [where.AND as Record<string, unknown>]
                : [];
            argsConsulta.where = { ...where, AND: [...andPrevio, filtroEmpresa] };
          }

          if (OPERACIONES_QUE_CREAN.has(operation)) {
            if (campo === 'id') {
              // Crear empresas es exclusivo del equipo ENACTIVA.
              throw new ForbiddenException('No puedes crear registros de otra empresa');
            }
            if (Array.isArray(argsConsulta.data)) {
              argsConsulta.data = argsConsulta.data.map((fila) => ({ ...fila, ...filtroEmpresa }));
            } else if (argsConsulta.data) {
              argsConsulta.data = { ...argsConsulta.data, ...filtroEmpresa };
            }
            if (argsConsulta.create) {
              argsConsulta.create = { ...argsConsulta.create, ...filtroEmpresa };
            }
          }

          return query(argsConsulta);
        },
      },
    },
  });
}

export type ClienteAcotado = ReturnType<typeof crearClienteAcotado>;
