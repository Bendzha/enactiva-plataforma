import { cabecerasInternas } from './contexto-interno.js';

describe('contexto que viaja entre servicios', () => {
  it('reenvía el token del usuario y el id de la petición', () => {
    const cabeceras = cabecerasInternas({ tokenAcceso: 'jwt-abc', requestId: 'req-1' });

    expect(cabeceras).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-abc',
      'x-request-id': 'req-1',
    });
  });

  it('omite lo que no hay en vez de mandar cabeceras vacías', () => {
    expect(cabecerasInternas({ tokenAcceso: null, requestId: null })).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('nunca manda la empresa: el otro servicio la saca de los claims del token', () => {
    // Si el empresaId viajara como dato, un servicio podría pedir datos de otra empresa
    // simplemente cambiándolo (ADR-0007).
    const cabeceras = cabecerasInternas({ tokenAcceso: 'jwt-abc', requestId: 'req-1' });

    expect(Object.keys(cabeceras)).toEqual(['Content-Type', 'Authorization', 'x-request-id']);
  });
});
