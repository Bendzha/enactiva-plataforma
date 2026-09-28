import { Module } from '@nestjs/common';
import {
  PROVEEDOR_ESTADO_SESION,
  ProveedorEstadoSesionNoDisponible,
  SaludModule,
  ServiceKitModule,
} from '@enactiva/service-kit';
import { env } from './config/env.js';

/**
 * matching-service (ADR-0007): el mazo de tarjetas, el score de afinidad y las decisiones del
 * swipe. Aislado a propósito por ser el componente más distintivo del producto.
 *
 * Fase M0: solo responde `/health`. Su lógica se construye aquí en M3 (Slice 6).
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      // En M1 se reemplaza por el proveedor que consulta a identity-service y cachea 30 s.
      proveedorEstadoSesion: {
        provide: PROVEEDOR_ESTADO_SESION,
        useClass: ProveedorEstadoSesionNoDisponible,
      },
    }),
    SaludModule.paraServicio('matching-service'),
  ],
})
export class AppModule {}
