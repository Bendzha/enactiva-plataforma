import { describe, expect, it, vi } from 'vitest';
import { confiarEnProxies, saltosDeConfianza } from './proxies.js';

/** Un doble de la aplicación Nest: solo interesa qué `set` recibe Express. */
function appFalsa() {
  const set = vi.fn();
  return { set, app: { getHttpAdapter: () => ({ getInstance: () => ({ set }) }) } };
}

describe('Confianza en X-Forwarded-For', () => {
  describe('cuántos saltos se creen', () => {
    it('sin proxy externo, los servicios confían solo en el gateway', () => {
      // El gateway habla directo con el navegador; identity, learning, matching y auth reciben
      // la petición del gateway, que ya agregó la cabecera.
      expect(saltosDeConfianza(0, true)).toBe(0);
      expect(saltosDeConfianza(0, false)).toBe(1);
    });

    it('con un Nginx delante, todos suman ese salto', () => {
      expect(saltosDeConfianza(1, true)).toBe(1);
      expect(saltosDeConfianza(1, false)).toBe(2);
    });
  });

  it('sin nada delante, el gateway no toca la configuración', () => {
    // Creerle a la cabecera cuando no hay quien la escriba deja que cualquiera invente su IP, y
    // con eso se salta el límite de intentos de login, que cuenta por IP.
    const { set, app } = appFalsa();

    confiarEnProxies(app, 0, { esElGateway: true });

    expect(set).not.toHaveBeenCalled();
  });

  it('un servicio detrás del gateway sí confía en un salto', () => {
    const { set, app } = appFalsa();

    confiarEnProxies(app, 0);

    expect(set).toHaveBeenCalledWith('trust proxy', 1);
  });

  it('con un proxy externo, el gateway confía en uno y los servicios en dos', () => {
    const gateway = appFalsa();
    const servicio = appFalsa();

    confiarEnProxies(gateway.app, 1, { esElGateway: true });
    confiarEnProxies(servicio.app, 1);

    expect(gateway.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(servicio.set).toHaveBeenCalledWith('trust proxy', 2);
  });
});
