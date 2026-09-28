import { Module } from '@nestjs/common';
import {
  PROVEEDOR_ESTADO_SESION,
  ProveedorEstadoSesionNoDisponible,
  SaludModule,
  ServiceKitModule,
} from '@enactiva/service-kit';
import { env } from './config/env.js';

/**
 * auth-service (ADR-0007): emite y rota los JWT. Es el único que firma tokens.
 *
 * Fase M0: solo responde `/health`. El login llega en M1, junto con la verificación de
 * credenciales contra identity-service.
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      // Todavía no hay de dónde leer el estado de sesión: se conecta a identity-service en M1.
      // Hasta entonces cualquier ruta autenticada responde 503, que es preferible a dejarla pasar.
      proveedorEstadoSesion: {
        provide: PROVEEDOR_ESTADO_SESION,
        useClass: ProveedorEstadoSesionNoDisponible,
      },
    }),
    SaludModule.paraServicio('auth-service'),
  ],
})
export class AppModule {}
