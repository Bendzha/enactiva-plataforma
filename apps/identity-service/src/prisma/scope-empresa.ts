import {
  acotarArgs,
  CLS_SESION,
  type ModelosAcotados,
  type SesionActual,
} from '@enactiva/service-kit';
import type { ClsService } from 'nestjs-cls';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Modelos de este servicio cuyos datos pertenecen a una empresa, y el campo que la identifica.
 * Al agregar un modelo nuevo con `empresaId` hay que registrarlo aquí, o sus datos quedarán
 * visibles entre empresas (ADR-0003).
 */
export const MODELOS_ACOTADOS: ModelosAcotados = {
  Usuario: 'empresaId',
  Empresa: 'id',
  Area: 'empresaId',
};

/**
 * Conecta la regla de acotado por empresa al cliente Prisma de este servicio.
 *
 * La regla vive en `@enactiva/service-kit` para que no pueda divergir entre servicios; aquí solo
 * se enchufa, porque los tipos del cliente generado son propios de cada base (ADR-0007).
 */
export function crearClienteAcotado(cliente: PrismaClient, cls: ClsService) {
  return cliente.$extends({
    name: 'scope-empresa',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const acotados = acotarArgs({
            modelo: model,
            operacion: operation,
            args: (args ?? {}) as Record<string, never>,
            sesion: cls.get<SesionActual | undefined>(CLS_SESION),
            modelos: MODELOS_ACOTADOS,
          });

          return query(acotados as typeof args);
        },
      },
    },
  });
}

export type ClienteAcotado = ReturnType<typeof crearClienteAcotado>;
