import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import {
  guardarPersonalizacionSchema,
  type GuardarPersonalizacionInput,
  type Personalizacion,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { PersonalizacionService } from './personalizacion.service.js';

/**
 * El entorno visual de la propia empresa (SPEC §3.8, ADR-0011).
 *
 * No lleva `:id` a propósito: la empresa sale de la sesión verificada. Una ruta con id sería una
 * invitación a probar el de la empresa de al lado.
 */
@Controller('mi-empresa/personalizacion')
export class PersonalizacionController {
  constructor(private readonly personalizacion: PersonalizacionService) {}

  /** Cualquiera con sesión en una empresa: es lo que pinta su propia pantalla. */
  @Get()
  @SoloSesion()
  mia(@Sesion() sesion: SesionActual): Promise<Personalizacion> {
    return this.personalizacion.mia(sesion);
  }

  @Put()
  @RequierePermiso('empresa:personalizar')
  guardar(
    @Body(new ZodValidationPipe(guardarPersonalizacionSchema)) datos: GuardarPersonalizacionInput,
    @Sesion() sesion: SesionActual,
  ): Promise<Personalizacion> {
    return this.personalizacion.guardar(datos, sesion);
  }

  @Delete()
  @RequierePermiso('empresa:personalizar')
  restablecer(@Sesion() sesion: SesionActual): Promise<Personalizacion> {
    return this.personalizacion.restablecer(sesion);
  }
}
