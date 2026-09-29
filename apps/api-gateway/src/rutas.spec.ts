import { esRutaInterna, rutaPara } from './rutas.js';

describe('enrutamiento del gateway', () => {
  it('manda cada prefijo a su servicio', () => {
    expect(rutaPara('/auth/login')?.servicio).toBe('auth-service');
    expect(rutaPara('/identity/empresas')?.servicio).toBe('identity-service');
    expect(rutaPara('/learning/cursos')?.servicio).toBe('learning-service');
    expect(rutaPara('/matching/mazo')?.servicio).toBe('matching-service');
  });

  it('acepta el prefijo sin nada más detrás', () => {
    expect(rutaPara('/identity')?.servicio).toBe('identity-service');
  });

  it('no confunde un prefijo con el comienzo de otra palabra', () => {
    expect(rutaPara('/authentication')).toBeNull();
    expect(rutaPara('/identityfalsa/empresas')).toBeNull();
  });

  it('no conoce las rutas sin prefijo', () => {
    expect(rutaPara('/empresas')).toBeNull();
    expect(rutaPara('/')).toBeNull();
  });

  it('quita el prefijo salvo en /auth', () => {
    // auth-service expone sus rutas bajo @Controller('auth'), y la cookie de refresh está
    // acotada a Path=/auth: si el gateway lo quitara, dejaría de viajar.
    expect(rutaPara('/auth/login')?.quitarPrefijo).toBe(false);
    expect(rutaPara('/identity/empresas')?.quitarPrefijo).toBe(true);
  });
});

describe('rutas internas', () => {
  it('reconoce cualquier intento de alcanzar /interno', () => {
    expect(esRutaInterna('/identity/interno/sesiones/login')).toBe(true);
    expect(esRutaInterna('/interno/sesiones/actual')).toBe(true);
    expect(esRutaInterna('/identity/interno')).toBe(true);
    expect(esRutaInterna('/learning/algo/interno/otra')).toBe(true);
  });

  it('ignora la query al decidir', () => {
    expect(esRutaInterna('/identity/empresas?filtro=interno')).toBe(false);
  });

  it('no se confunde con una palabra que solo contiene "interno"', () => {
    expect(esRutaInterna('/identity/internos')).toBe(false);
    expect(esRutaInterna('/identity/empresas/interno-algo')).toBe(false);
  });
});
