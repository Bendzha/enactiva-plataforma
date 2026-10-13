import {
  DIMENSIONES,
  ESTADOS_EMPRESA,
  ESTADOS_USUARIO,
  NIVELES_ADMIN,
  NIVELES_DOMINIO,
  ROLES,
  TIPOS_INTERES,
} from '@enactiva/shared';
import {
  Dimension,
  EstadoEmpresa,
  EstadoUsuario,
  NivelAdmin,
  NivelDominio,
  Rol,
  TipoInteres,
} from '../generated/prisma/enums.js';

/**
 * El vocabulario del dominio está escrito dos veces: en `packages/shared` (que usan la API y la
 * web) y en el `schema.prisma` de esta base. Si se separaran, la web ofrecería un valor que la
 * base rechaza y el error aparecería recién en producción.
 *
 * Este test vivía en el monolito y se perdió al migrar a microservicios (ADR-0007); vuelve aquí,
 * que es donde están los enums de Postgres.
 */
describe('los enums compartidos coinciden con los de la base', () => {
  const casos: [string, readonly string[], Record<string, string>][] = [
    ['Rol', ROLES, Rol],
    ['NivelAdmin', NIVELES_ADMIN, NivelAdmin],
    ['EstadoEmpresa', ESTADOS_EMPRESA, EstadoEmpresa],
    ['EstadoUsuario', ESTADOS_USUARIO, EstadoUsuario],
    ['Dimension', DIMENSIONES, Dimension],
    ['TipoInteres', TIPOS_INTERES, TipoInteres],
    ['NivelDominio', NIVELES_DOMINIO, NivelDominio],
  ];

  it.each(casos)('%s', (_nombre, compartido, enPrisma) => {
    expect([...compartido].sort()).toEqual(Object.values(enPrisma).sort());
  });
});
