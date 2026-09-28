import { type DynamicModule, Module } from '@nestjs/common';
import { ClsModule, type ClsService } from 'nestjs-cls';
import { CABECERA_REQUEST_ID } from './constantes.js';
import { resolverRequestId } from './request-id.js';
import { CLS_REQUEST_ID } from './sesion.js';

/** Lo mínimo que necesitamos del request y la response, para no atarnos a Express aquí. */
interface PeticionMinima {
  headers: Record<string, string | string[] | undefined>;
}
interface RespuestaMinima {
  setHeader(nombre: string, valor: string): void;
}

/**
 * Contexto por petición: `X-Request-Id` y el almacén donde el guard deja la sesión.
 *
 * Va aparte del guard porque el api-gateway necesita el contexto pero **no** valida tokens
 * (ADR-0007): cada servicio verifica el suyo. Los servicios importan `ServiceKitModule`, que ya
 * incluye esto.
 */
@Module({})
export class ContextoModule {
  static forRoot(): DynamicModule {
    return {
      module: ContextoModule,
      global: true,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            // El id se resuelve antes de cualquier guard y se devuelve en la respuesta, para
            // poder seguir una petición desde el navegador hasta el último servicio.
            setup: (cls: ClsService, req: PeticionMinima, res: RespuestaMinima) => {
              const requestId = resolverRequestId(req.headers);
              cls.set(CLS_REQUEST_ID, requestId);
              res.setHeader(CABECERA_REQUEST_ID, requestId);
            },
          },
        }),
      ],
    };
  }
}
