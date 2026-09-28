import { resolverRequestId } from './request-id.js';

describe('identificador de petición entre servicios', () => {
  it('genera uno cuando la petición no trae ninguno', () => {
    const id = resolverRequestId({});

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reutiliza el que viene, para poder seguir la petición entre servicios', () => {
    expect(resolverRequestId({ 'x-request-id': 'abc-123' })).toBe('abc-123');
  });

  it('toma el primero si llega repetido', () => {
    expect(resolverRequestId({ 'x-request-id': ['primero', 'segundo'] })).toBe('primero');
  });

  it('descarta un valor vacío y genera uno nuevo', () => {
    expect(resolverRequestId({ 'x-request-id': '   ' })).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('limpia caracteres que permitirían inyectar una línea falsa en el log', () => {
    const id = resolverRequestId({ 'x-request-id': 'abc\n[ERROR] sesión robada' });

    expect(id).not.toContain('\n');
    expect(id).toBe('abcERRORsesinrobada');
  });

  it('recorta valores absurdamente largos', () => {
    expect(resolverRequestId({ 'x-request-id': 'a'.repeat(500) })).toHaveLength(64);
  });
});
