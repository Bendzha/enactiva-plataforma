import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { proveedorEstadoSesionRemoto, SaludModule, ServiceKitModule } from '@enactiva/service-kit';
import { env } from './config/env.js';
import { ErrorInternoFiltro } from './error-interno.filtro.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { MazoModule } from './modules/mazo/mazo.module.js';

/**
 * matching-service (ADR-0007): el mazo del swipe y lo que la gente decide sobre él.
 *
 * Es el único servicio que no es dueño de casi nada: los talleres viven en learning y los
 * perfiles en identity. Lo suyo es juntarlos, ordenarlos por afinidad y guardar la decisión.
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      proveedorEstadoSesion: proveedorEstadoSesionRemoto(env().URL_IDENTITY_SERVICE),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditoriaModule,
    MazoModule,
    SaludModule.paraServicio('matching-service'),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ErrorInternoFiltro },
  ],
})
export class AppModule {}
