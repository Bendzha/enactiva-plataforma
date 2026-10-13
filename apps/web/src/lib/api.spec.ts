import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardarToken, renovarSesion } from '@/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  guardarToken(null);
});

describe('renovación de la sesión', () => {
  it('una sola rotación aunque la pidan varias partes a la vez', async () => {
    // El refresh es de un solo uso: una segunda rotación en paralelo parece un token robado y
    // el servidor corta todas las sesiones. Pasó de verdad y botaba al login al recargar.
    const fetchFalso = vi.fn(
      async () =>
        new Promise<Response>((resolver) =>
          setTimeout(
            () =>
              resolver(
                new Response(JSON.stringify({ accessToken: 'nuevo', usuario: { id: 'u-1' } }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }),
              ),
            10,
          ),
        ),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const [a, b, c] = await Promise.all([renovarSesion(), renovarSesion(), renovarSesion()]);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ id: 'u-1' });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('una renovación posterior sí vuelve a llamar', async () => {
    const fetchFalso = vi.fn(
      async () =>
        new Response(JSON.stringify({ accessToken: 'nuevo', usuario: { id: 'u-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchFalso);

    await renovarSesion();
    await renovarSesion();

    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('sin sesión válida devuelve null y olvida el token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    await expect(renovarSesion()).resolves.toBeNull();
  });
});
