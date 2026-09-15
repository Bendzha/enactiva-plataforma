import { COSTO_BCRYPT, hashPassword, verificarPassword } from './password.js';

describe('password', () => {
  it('genera un hash bcrypt con el costo del ADR-0003, distinto del texto plano', async () => {
    const hash = await hashPassword('una-clave-de-prueba');

    expect(hash).not.toContain('una-clave-de-prueba');
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${COSTO_BCRYPT}\\$`));
  });

  it('verifica la contraseña correcta y rechaza una incorrecta', async () => {
    const hash = await hashPassword('una-clave-de-prueba');

    await expect(verificarPassword('una-clave-de-prueba', hash)).resolves.toBe(true);
    await expect(verificarPassword('otra-clave', hash)).resolves.toBe(false);
  });
});
