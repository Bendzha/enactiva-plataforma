import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { AuthGuard } from './common/auth.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // Contexto por petición: el guard deja ahí la sesión y el scoping por empresa la usa (T0.8).
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // Límite general de la API; el login tiene uno mucho más estricto (ver AuthController).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    EmpresasModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guard global: toda ruta debe declarar @Publico, @SoloSesion o @RequierePermiso.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
