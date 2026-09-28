import { Module } from '@nestjs/common';
import {
  PROVEEDOR_ESTADO_SESION,
  ProveedorEstadoSesionNoDisponible,
  SaludModule,
  ServiceKitModule,
} from '@enactiva/service-kit';
import { env } from './config/env.js';

/**
 * identity-service (ADR-0007): empresas, áreas, personas, invitaciones, perfiles de interés,
 * catálogo de temas y correo saliente. Es el dueño de `Usuario`, `UsuarioRol` y `TokenAcceso`,
 * y el único que verifica contraseñas.
 *
 * Fase M0: solo responde `/health`. En M1 llegan las tablas y los módulos de los Slices 0 a 3.
 */
@Module({
  imports: [
    ServiceKitModule.forRoot({
      secretoJwt: env().JWT_ACCESS_SECRET,
      // En M1 este servicio lee el estado de sesión de su propia base y deja de usar el relleno;
      // es el único que no necesita preguntarle a nadie.
      proveedorEstadoSesion: {
        provide: PROVEEDOR_ESTADO_SESION,
        useClass: ProveedorEstadoSesionNoDisponible,
      },
    }),
    SaludModule.paraServicio('identity-service'),
  ],
})
export class AppModule {}
