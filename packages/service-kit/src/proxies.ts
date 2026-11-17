import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

/**
 * Cuántos saltos de `X-Forwarded-For` puede creerse un proceso.
 *
 * El gateway recibe la petición del navegador, o del proxy que haya delante; los demás servicios
 * la reciben **siempre del gateway**, así que confían en un salto más que él (ADR-0007).
 *
 * Sin esto Express ignora la cabecera y `req.ip` es la dirección de quien abrió el socket: el
 * gateway. El proxy ya la manda —`xfwd: true`—, pero nadie la leía, así que la IP que guardaba
 * la auditoría era la del gateway y el límite de intentos de login contaba los intentos de todo
 * el mundo como si vinieran de una sola IP.
 */
export function saltosDeConfianza(proxiesExternos: number, esElGateway: boolean): number {
  return esElGateway ? proxiesExternos : proxiesExternos + 1;
}

/**
 * Deja la aplicación leyendo `X-Forwarded-For` hasta donde se pueda confiar.
 *
 * Con cero saltos no se toca nada: Express se queda con la dirección del socket, que es lo
 * correcto cuando no hay ningún intermediario. Creerle a la cabecera más saltos de los que hay
 * es peor que no creerle ninguno, porque cualquiera la escribe y se inventa su IP.
 */
export function confiarEnProxies(
  app: { getHttpAdapter(): { getInstance(): { set(clave: string, valor: unknown): void } } },
  proxiesExternos: number,
  { esElGateway = false }: { esElGateway?: boolean } = {},
): void {
  const saltos = saltosDeConfianza(proxiesExternos, esElGateway);
  if (saltos > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', saltos);
  }
}

/**
 * Lo mismo, pero para los servicios que montan `ServiceKitModule`.
 *
 * Va como provider y no en el `main.ts` de cada uno para que los e2e levanten exactamente la
 * misma configuración que corre en el servidor: si esto viviera en el arranque, los tests
 * probarían una aplicación que lee la cabecera de otra forma.
 */
@Injectable()
export class ConfiguradorDeProxies implements OnApplicationBootstrap {
  constructor(
    private readonly adaptadores: HttpAdapterHost,
    private readonly proxiesExternos: number,
  ) {}

  onApplicationBootstrap(): void {
    const adaptador = this.adaptadores.httpAdapter;
    if (!adaptador) return;

    confiarEnProxies({ getHttpAdapter: () => adaptador }, this.proxiesExternos);
  }
}
