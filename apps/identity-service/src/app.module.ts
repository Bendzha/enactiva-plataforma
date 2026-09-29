import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION, SaludModule, ServiceKitModule } from '@enactiva/service-kit';
import { env } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { CorreoModule } from './modules/correo/correo.module.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import { InvitacionesModule } from './modules/invitaciones/invitaciones.module.js';
import { PersonasModule } from './modules/personas/personas.module.js';
import { ProveedorEstadoSesionLocal } from './modules/sesiones/proveedor-estado-sesion.js';
import { SesionesModule } from './modules/sesiones/sesiones.module.js';

/**
 * identity-service (ADR-0007): empresas, áreas, personas, invitaciones, temas y correo.
 * Es el dueño de `Usuario`, `UsuarioRol` y `TokenAcceso`, y el único que verifica contraseñas.
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      secretoInterno: env().INTERNO_SECRETO,
      // Único servicio que resuelve la sesión contra su propia base, sin llamar a nadie.
      proveedorEstadoSesion: {
        provide: PROVEEDOR_ESTADO_SESION,
        useClass: ProveedorEstadoSesionLocal,
      },
    }),
    // Límite general del servicio; el del login vive en auth-service, que es quien lo expone.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditoriaModule,
    CorreoModule,
    AdminsModule,
    EmpresasModule,
    InvitacionesModule,
    PersonasModule,
    SesionesModule,
    SaludModule.paraServicio('identity-service'),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
