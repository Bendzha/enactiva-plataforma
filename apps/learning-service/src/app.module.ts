import { Module } from '@nestjs/common';
import { proveedorEstadoSesionRemoto, SaludModule, ServiceKitModule } from '@enactiva/service-kit';
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
      // No tiene las tablas de usuarios: le pregunta a identity-service y cachea 30 s.
      proveedorEstadoSesion: proveedorEstadoSesionRemoto(env().URL_IDENTITY_SERVICE),
    }),
    SaludModule.paraServicio('learning-service'),
  ],
})
export class AppModule {}
