import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { proveedorEstadoSesionRemoto, SaludModule, ServiceKitModule } from '@enactiva/service-kit';
import { env } from './config/env.js';
import { ErrorIdentityFiltro } from './error-identity.filtro.js';
import { AuthModule } from './modules/auth/auth.module.js';

/**
 * auth-service (ADR-0007): emite y rota los JWT. Es el único que firma tokens y no tiene base
 * de datos propia: le pide a identity-service que verifique credenciales y guarde los refresh.
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      // `GET /auth/yo` es la única ruta autenticada de este servicio; su sesión se resuelve
      // preguntándole a identity y se cachea 30 s.
      proveedorEstadoSesion: proveedorEstadoSesionRemoto(env().URL_IDENTITY_SERVICE),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    SaludModule.paraServicio('auth-service'),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ErrorIdentityFiltro },
  ],
})
export class AppModule {}
