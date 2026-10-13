import { DIMENSIONES, NIVELES_DOMINIO, ROLES, TIPOS_INTERES } from './enums.js';

describe('enums del dominio', () => {
  it('mantiene los 4 roles confirmados por la clienta', () => {
    expect(ROLES).toEqual(['ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE']);
  });

  it('mantiene las 3 dimensiones que se declaran en el perfil', () => {
    expect(DIMENSIONES).toEqual(['HABILIDAD', 'CONTENIDO', 'ACTITUD']);
  });

  // Los momentos de medición y las etapas del curso se eliminaron el 2026-10-13 (ADR-0010):
  // la clienta pidió "sólo conectar y convocar". Si alguien los vuelve a necesitar, es una
  // decisión nueva, no un enum que quedó dando vueltas.
  it('declara enseñar o aprender, con un nivel', () => {
    expect(TIPOS_INTERES).toEqual(['ENSENAR', 'APRENDER']);
    expect(NIVELES_DOMINIO).toEqual(['BASICO', 'INTERMEDIO', 'AVANZADO']);
  });
});
