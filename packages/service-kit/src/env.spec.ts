import { z } from 'zod';
import { crearEnv, esquemaEnvBase } from './env.js';

const esquema = esquemaEnvBase.extend({
  PORT_PRUEBA: z.coerce.number().int().positive().default(3100),
  OBLIGATORIA: z.string().min(1),
});

describe('configuración de un servicio', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = original;
  });

  it('aplica los valores por defecto cuando la variable no está', () => {
    process.env.OBLIGATORIA = 'algo';
    const { env } = crearEnv(esquema, '.env');

    expect(env().PORT_PRUEBA).toBe(3100);
    expect(env().WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('trata una variable vacía como ausente', () => {
    // `PORT_PRUEBA=` en el .env no debe terminar en un puerto 0.
    process.env.OBLIGATORIA = 'algo';
    process.env.PORT_PRUEBA = '';
    process.env.WEB_ORIGIN = '   ';
    const { env } = crearEnv(esquema, '.env');

    expect(env().PORT_PRUEBA).toBe(3100);
    expect(env().WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('falla al arrancar si falta algo obligatorio, diciendo qué y dónde corregirlo', () => {
    delete process.env.OBLIGATORIA;
    const { env } = crearEnv(esquema, 'el .env de la raíz');

    expect(() => env()).toThrow(/el \.env de la raíz.*OBLIGATORIA/s);
  });

  it('valida una sola vez y deja el resultado en caché', () => {
    process.env.OBLIGATORIA = 'algo';
    const { env, limpiarCacheEnv } = crearEnv(esquema, '.env');

    expect(env().OBLIGATORIA).toBe('algo');
    process.env.OBLIGATORIA = 'cambiada';
    expect(env().OBLIGATORIA).toBe('algo');

    limpiarCacheEnv();
    expect(env().OBLIGATORIA).toBe('cambiada');
  });
});
