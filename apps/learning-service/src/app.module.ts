import { Module } from '@nestjs/common';
import {
  PROVEEDOR_ESTADO_SESION,
  ProveedorEstadoSesionNoDisponible,
  SaludModule,
  ServiceKitModule,
} from '@enactiva/service-kit';
import { env } from './config/env.js';

/**
 * learning-service (ADR-0007): cursos, etapas Diagnóstico → Clase → Monitoreo, contenidos,
 * rúbricas, mediciones y el cálculo de logro y delta.
 *
 * Fase M0: solo responde `/health`. Sus tablas y su lógica se construyen directamente aquí en M3
 * (Slices 5 y 7), no en el monolito.
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
    SaludModule.paraServicio('learning-service'),
  ],
})
export class AppModule {}
