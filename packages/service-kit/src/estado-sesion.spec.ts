import {
  CacheEstadoSesion,
  ProveedorEstadoSesionNoDisponible,
  type EstadoSesion,
  type ProveedorEstadoSesion,
} from './estado-sesion.js';

const ACTIVO: EstadoSesion = {
  usuarioId: 'u-1',
  roles: ['RRHH'],
  nivelAdmin: null,
  empresaId: 'empresa-1',
  activo: true,
};

class ProveedorFalso implements ProveedorEstadoSesion {
  llamadas = 0;
  respuesta: EstadoSesion | null = ACTIVO;
  error: Error | null = null;
  /** Permite dejar una llamada en el aire para probar la concurrencia. */
  resolver: ((estado: EstadoSesion | null) => void) | null = null;

  cargar(): Promise<EstadoSesion | null> {
    this.llamadas += 1;
    if (this.error) return Promise.reject(this.error);
    if (this.resolver !== null) {
      return new Promise((resolve) => {
        this.resolver = resolve;
      });
    }
    return Promise.resolve(this.respuesta);
  }
}

describe('caché del estado de sesión', () => {
  let reloj: number;
  let proveedor: ProveedorFalso;
  let cache: CacheEstadoSesion;

  beforeEach(() => {
    reloj = 1_000;
    proveedor = new ProveedorFalso();
    cache = new CacheEstadoSesion(proveedor, { ttlMs: 30_000, ahora: () => reloj });
  });

  it('consulta una sola vez dentro de la ventana de caché', async () => {
    await cache.obtener('u-1');
    reloj += 29_999;
    await cache.obtener('u-1');

    expect(proveedor.llamadas).toBe(1);
  });

  it('vuelve a consultar cuando la caché vence', async () => {
    await cache.obtener('u-1');
    reloj += 30_001;
    await cache.obtener('u-1');

    expect(proveedor.llamadas).toBe(2);
  });

  it('cachea por usuario y no mezcla a dos personas', async () => {
    await cache.obtener('u-1');
    await cache.obtener('u-2');

    expect(proveedor.llamadas).toBe(2);
  });

  it('varias peticiones a la vez comparten una sola consulta', async () => {
    proveedor.resolver = () => {};
    const primera = cache.obtener('u-1');
    const segunda = cache.obtener('u-1');
    proveedor.resolver?.(ACTIVO);

    await expect(primera).resolves.toEqual(ACTIVO);
    await expect(segunda).resolves.toEqual(ACTIVO);
    expect(proveedor.llamadas).toBe(1);
  });

  it('un error no queda cacheado: la siguiente petición reintenta', async () => {
    proveedor.error = new Error('identity no responde');
    await expect(cache.obtener('u-1')).rejects.toThrow('identity no responde');

    proveedor.error = null;
    await expect(cache.obtener('u-1')).resolves.toEqual(ACTIVO);
    expect(proveedor.llamadas).toBe(2);
  });

  it('una cuenta desactivada se recuerda como desactivada', async () => {
    proveedor.respuesta = { ...ACTIVO, activo: false };

    await expect(cache.obtener('u-1')).resolves.toMatchObject({ activo: false });
  });

  it('invalidar deja que el cambio surta efecto al instante', async () => {
    await cache.obtener('u-1');
    cache.invalidar('u-1');
    await cache.obtener('u-1');

    expect(proveedor.llamadas).toBe(2);
  });

  it('invalidar sin argumentos limpia todo', async () => {
    await cache.obtener('u-1');
    await cache.obtener('u-2');
    cache.invalidar();
    await cache.obtener('u-1');
    await cache.obtener('u-2');

    expect(proveedor.llamadas).toBe(4);
  });
});

describe('proveedor de relleno de la fase M0', () => {
  it('falla de forma explícita en vez de dejar pasar la petición', () => {
    expect(() => new ProveedorEstadoSesionNoDisponible().cargar()).toThrow(/fase M1/);
  });
});
