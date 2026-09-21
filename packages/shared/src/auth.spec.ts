import { LARGO_MINIMO_PASSWORD, loginSchema, passwordNuevoSchema } from './auth.js';

describe('loginSchema', () => {
  it('normaliza el email a minúsculas y sin espacios', () => {
    const resultado = loginSchema.parse({ email: '  Admin@Plataforma.CL ', password: 'x' });

    expect(resultado.email).toBe('admin@plataforma.cl');
  });

  it('rechaza un email inválido', () => {
    const resultado = loginSchema.safeParse({ email: 'sin-arroba', password: 'x' });

    expect(resultado.success).toBe(false);
  });

  it('exige una contraseña no vacía', () => {
    const resultado = loginSchema.safeParse({ email: 'admin@plataforma.cl', password: '' });

    expect(resultado.success).toBe(false);
  });
});

describe('passwordNuevoSchema', () => {
  it(`rechaza contraseñas de menos de ${LARGO_MINIMO_PASSWORD} caracteres`, () => {
    expect(passwordNuevoSchema.safeParse('corta').success).toBe(false);
  });

  it('acepta una contraseña que cumple el largo mínimo', () => {
    expect(passwordNuevoSchema.safeParse('a'.repeat(LARGO_MINIMO_PASSWORD)).success).toBe(true);
  });
});
