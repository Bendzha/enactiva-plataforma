import { ESTADOS_EMPRESA, ESTADOS_USUARIO, NIVELES_ADMIN, ROLES } from '@enactiva/shared';
import { EstadoEmpresa, EstadoUsuario, NivelAdmin, Rol } from '../generated/prisma/enums.js';

// Si alguien cambia un enum en schema.prisma y no lo refleja en packages/shared
// (o al revés), estos tests fallan antes de que la web muestre valores inexistentes.
describe('enums de @enactiva/shared vs. los de Prisma', () => {
  it('Rol coincide en valores y orden', () => {
    expect(Object.values(Rol)).toEqual([...ROLES]);
  });

  it('NivelAdmin coincide', () => {
    expect(Object.values(NivelAdmin)).toEqual([...NIVELES_ADMIN]);
  });

  it('EstadoEmpresa coincide', () => {
    expect(Object.values(EstadoEmpresa)).toEqual([...ESTADOS_EMPRESA]);
  });

  it('EstadoUsuario coincide', () => {
    expect(Object.values(EstadoUsuario)).toEqual([...ESTADOS_USUARIO]);
  });

  // Dimension, Momento y EtapaCurso viven por ahora solo en shared:
  // entran al esquema de Prisma en el MVP 1 (cursos y mediciones).
});
