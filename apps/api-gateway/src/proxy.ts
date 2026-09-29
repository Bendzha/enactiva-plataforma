import { Logger } from '@nestjs/common';
import { CABECERA_REQUEST_ID, resolverRequestId } from '@enactiva/service-kit';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env } from './config/env.js';
import { esRutaInterna, RUTAS, type RutaGateway } from './rutas.js';

const logger = new Logger('Gateway');

function destinoDe(ruta: RutaGateway): string {
  const config = env();
  switch (ruta.servicio) {
    case 'auth-service':
      return config.URL_AUTH_SERVICE;
    case 'identity-service':
      return config.URL_IDENTITY_SERVICE;
    case 'learning-service':
      return config.URL_LEARNING_SERVICE;
    default:
      return config.URL_MATCHING_SERVICE;
  }
}

/**
 * Corta cualquier intento de llegar a `/interno/*` desde afuera (ADR-0007).
 *
 * Va antes de los proxies para que ni siquiera se abra la conexión al servicio.
 */
export function bloquearRutasInternas(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (esRutaInterna(req.url)) {
      logger.warn(`Intento de alcanzar una ruta interna desde afuera: ${req.method} ${req.url}`);
      res.status(404).json({ mensaje: 'No encontrado' });
      return;
    }
    next();
  };
}

/**
 * Genera el `X-Request-Id` que después siguen todos los servicios, y lo devuelve al navegador.
 *
 * Es middleware propio y no el de `ContextoModule` porque el proxy no pasa por el pipeline de
 * Nest: hay que poner la cabecera sobre el request antes de reenviarlo.
 */
export function marcarPeticion(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = resolverRequestId(req.headers);
    req.headers[CABECERA_REQUEST_ID] = requestId;
    res.setHeader(CABECERA_REQUEST_ID, requestId);
    next();
  };
}

/**
 * Un proxy por prefijo. `http-proxy-middleware` reenvía el cuerpo, las cabeceras y las cookies
 * tal cual, incluido el `Set-Cookie` de la respuesta, que es como vuelve la cookie de refresh.
 *
 * `xfwd` agrega `X-Forwarded-For`: los servicios auditan la IP de quien hace cada acción, y sin
 * esto todas quedarían registradas como si vinieran del gateway.
 */
export function proxiesPorPrefijo(): RequestHandler[] {
  return RUTAS.map((ruta) => {
    const destino = destinoDe(ruta);

    return createProxyMiddleware({
      target: destino,
      changeOrigin: false,
      xfwd: true,
      // Se filtra por ruta en vez de montar en `app.use(prefijo, ...)`: Express le quita el
      // prefijo a la URL al montar, y entonces `/auth/login` llegaría a auth-service como
      // `/login`. Filtrando, la URL llega entera y el prefijo se quita solo donde corresponde.
      pathFilter: (ruta_: string) => ruta_ === ruta.prefijo || ruta_.startsWith(`${ruta.prefijo}/`),
      pathRewrite: ruta.quitarPrefijo ? { [`^${ruta.prefijo}`]: '' } : undefined,
      on: {
        error: (error, _req, res) => {
          logger.error(`No se pudo hablar con ${ruta.servicio}: ${error.message}`);
          if ('writeHead' in res && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ mensaje: `El servicio no está disponible` }));
          }
        },
      },
    });
  });
}
