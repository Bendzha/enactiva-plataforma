import { DIMENSIONES, ETAPAS_CURSO, MOMENTOS, ROLES } from './enums.js';

describe('enums del dominio', () => {
  it('mantiene los 4 roles confirmados por la clienta', () => {
    expect(ROLES).toEqual(['ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE']);
  });

  it('mantiene las 3 dimensiones y los 3 momentos de medición', () => {
    expect(DIMENSIONES).toHaveLength(3);
    expect(MOMENTOS).toEqual(['DIAGNOSTICO', 'INTERMEDIO', 'MONITOREO']);
  });

  it('mantiene la estructura fija de curso: diagnóstico, clase y monitoreo', () => {
    expect(ETAPAS_CURSO).toEqual(['DIAGNOSTICO', 'CLASE', 'MONITOREO']);
  });
});
