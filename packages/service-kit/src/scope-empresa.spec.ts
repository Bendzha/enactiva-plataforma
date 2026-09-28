import { ForbiddenException } from '@nestjs/common';
import { acotarArgs, type ModelosAcotados } from './scope-empresa.js';
import type { SesionActual } from './sesion.js';

const MODELOS: ModelosAcotados = { Usuario: 'empresaId', Empresa: 'id', Area: 'empresaId' };

const RRHH: SesionActual = {
  usuarioId: 'u-1',
  roles: ['RRHH'],
  nivelAdmin: null,
  empresaId: 'empresa-1',
  ip: null,
};

const ADMIN: SesionActual = {
  usuarioId: 'a-1',
  roles: ['ADMIN_ENACTIVA'],
  nivelAdmin: 'PRINCIPAL',
  empresaId: null,
  ip: null,
};

function acotar(
  operacion: string,
  args: Record<string, unknown>,
  sesion: SesionActual | undefined = RRHH,
) {
  return acotarArgs({ modelo: 'Usuario', operacion, args, sesion, modelos: MODELOS });
}

describe('acotado por empresa', () => {
  it('no toca los modelos que no pertenecen a una empresa', () => {
    const args = { where: { id: 'x' } };
    const resultado = acotarArgs({
      modelo: 'RegistroAuditoria',
      operacion: 'findMany',
      args,
      sesion: RRHH,
      modelos: MODELOS,
    });

    expect(resultado).toBe(args);
  });

  it('agrega el filtro de empresa a las consultas', () => {
    const resultado = acotar('findMany', { where: { estado: 'ACTIVO' } });

    expect(resultado.where).toEqual({
      estado: 'ACTIVO',
      AND: [{ empresaId: 'empresa-1' }],
    });
  });

  it('en findUnique deja el campo único arriba y el filtro dentro de AND', () => {
    // Prisma exige el campo único en el primer nivel; si el filtro lo reemplazara, reventaría.
    const resultado = acotar('findUnique', { where: { email: 'a@b.cl' } });

    expect(resultado.where).toEqual({
      email: 'a@b.cl',
      AND: [{ empresaId: 'empresa-1' }],
    });
  });

  it('conserva un AND previo, venga como objeto o como arreglo', () => {
    const conObjeto = acotar('findMany', { where: { AND: { estado: 'ACTIVO' } } });
    expect(conObjeto.where?.AND).toEqual([{ estado: 'ACTIVO' }, { empresaId: 'empresa-1' }]);

    const conArreglo = acotar('findMany', { where: { AND: [{ estado: 'ACTIVO' }] } });
    expect(conArreglo.where?.AND).toEqual([{ estado: 'ACTIVO' }, { empresaId: 'empresa-1' }]);
  });

  it('funciona cuando la consulta no traía where', () => {
    expect(acotar('findMany', {}).where).toEqual({ AND: [{ empresaId: 'empresa-1' }] });
  });

  it('el equipo ENACTIVA no se acota: ve todas las empresas del piloto', () => {
    const args = { where: { estado: 'ACTIVO' } };
    expect(acotar('findMany', args, ADMIN)).toBe(args);
  });

  it('sin sesión en contexto falla en vez de devolver datos de todos', () => {
    expect(() =>
      acotarArgs({
        modelo: 'Usuario',
        operacion: 'findMany',
        args: {},
        sesion: undefined,
        modelos: MODELOS,
      }),
    ).toThrow(/sin sesión en contexto/i);
  });

  it('una cuenta sin empresa que no es de ENACTIVA no puede consultar', () => {
    const sinEmpresa: SesionActual = { ...RRHH, empresaId: null };
    expect(() => acotar('findMany', {}, sinEmpresa)).toThrow(ForbiddenException);
  });

  it('al crear, fija la empresa de quien hace la petición', () => {
    const resultado = acotar('create', { data: { email: 'a@b.cl', empresaId: 'empresa-ajena' } });

    expect(resultado.data).toEqual({ email: 'a@b.cl', empresaId: 'empresa-1' });
  });

  it('al crear varias filas, fija la empresa en todas', () => {
    const resultado = acotar('createMany', {
      data: [{ email: 'a@b.cl' }, { email: 'c@d.cl', empresaId: 'empresa-ajena' }],
    });

    expect(resultado.data).toEqual([
      { email: 'a@b.cl', empresaId: 'empresa-1' },
      { email: 'c@d.cl', empresaId: 'empresa-1' },
    ]);
  });

  it('en upsert acota el where y también lo que se crea', () => {
    const resultado = acotar('upsert', {
      where: { email: 'a@b.cl' },
      create: { email: 'a@b.cl' },
      data: { nombre: 'Ana' },
    });

    expect(resultado.where?.AND).toEqual([{ empresaId: 'empresa-1' }]);
    expect(resultado.create).toEqual({ email: 'a@b.cl', empresaId: 'empresa-1' });
  });

  it('nadie fuera de ENACTIVA puede crear una empresa', () => {
    expect(() =>
      acotarArgs({
        modelo: 'Empresa',
        operacion: 'create',
        args: { data: { nombre: 'Ajena' } },
        sesion: RRHH,
        modelos: MODELOS,
      }),
    ).toThrow(ForbiddenException);
  });

  it('no modifica el objeto original de argumentos', () => {
    const args = { where: { estado: 'ACTIVO' } };
    acotar('findMany', args);

    expect(args).toEqual({ where: { estado: 'ACTIVO' } });
  });
});
