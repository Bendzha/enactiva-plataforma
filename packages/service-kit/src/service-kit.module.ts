import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard.js';
import { ContextoModule } from './contexto.module.js';
import {
  CacheEstadoSesion,
  PROVEEDOR_ESTADO_SESION,
  type ProveedorEstadoSesion,
} from './estado-sesion.js';

export interface OpcionesServiceKit {
  /** Secreto compartido del access token: auth-service firma, los demás verifican. */
  secretoJwt: string;
  /** Cómo obtiene este servicio el estado de la sesión (su base, o identity-service). */
  proveedorEstadoSesion: Provider;
  /** TTL de la caché de estado de sesión; por defecto `TTL_ESTADO_SESION_MS`. */
  ttlEstadoSesionMs?: number;
}

/**
 * Base común de los servicios que atienden peticiones autenticadas (ADR-0007): contexto por
 * petición, `X-Request-Id`, verificación del token y guard global cerrado por defecto.
 *
 * Se importa una vez en el `AppModule` de cada servicio:
 * `ServiceKitModule.forRoot({ secretoJwt, proveedorEstadoSesion })`.
 */
@Module({})
export class ServiceKitModule {
  static forRoot(opciones: OpcionesServiceKit): DynamicModule {
    return {
      module: ServiceKitModule,
      global: true,
      imports: [ContextoModule.forRoot(), JwtModule.register({ secret: opciones.secretoJwt })],
      providers: [
        opciones.proveedorEstadoSesion,
        {
          provide: CacheEstadoSesion,
          inject: [PROVEEDOR_ESTADO_SESION],
          useFactory: (fuente: ProveedorEstadoSesion) =>
            new CacheEstadoSesion(fuente, { ttlMs: opciones.ttlEstadoSesionMs }),
        },
        // Guard global: toda ruta debe declarar @Publico, @SoloSesion o @RequierePermiso.
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
      exports: [CacheEstadoSesion, JwtModule],
    };
  }
}
