import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { proveedorEstadoSesionRemoto, SaludModule, ServiceKitModule } from '@enactiva/service-kit';
import { env } from './config/env.js';
import { ErrorInternoFiltro } from './error-interno.filtro.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { RecordatoriosModule } from './modules/recordatorios/recordatorios.module.js';
import { TalleresModule } from './modules/talleres/talleres.module.js';

/**
 * learning-service (ADR-0007): los talleres convocados, quién se inscribe y cuándo puede enseñar
 * cada facilitador.
 *
 * No tiene etapas, rúbricas ni mediciones: la clienta las sacó del alcance el 2026-10-13
 * (ADR-0010). Lo que viene después es la valoración del encuentro (Slice 8).
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      // No tiene las tablas de usuarios: le pregunta a identity-service y cachea 30 s.
      proveedorEstadoSesion: proveedorEstadoSesionRemoto(env().URL_IDENTITY_SERVICE),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    // El reloj de los recordatorios: lo primero del sistema que ocurre sin que nadie lo pida.
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditoriaModule,
    TalleresModule,
    RecordatoriosModule,
    SaludModule.paraServicio('learning-service'),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ErrorInternoFiltro },
  ],
})
export class AppModule {}
