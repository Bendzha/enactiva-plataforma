import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  pedirRolEnsenarSchema,
  proponerTallerSchema,
  rechazarSolicitudSchema,
  type MiSolicitud,
  type PedirRolEnsenarInput,
  type ProponerTallerInput,
  type RechazarSolicitudInput,
  type SolicitudParaRrhh,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { SolicitudesService } from './solicitudes.service.js';

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  /** Las mías. Cualquiera con sesión ve las suyas y solo las suyas. */
  @Get('mias')
  @SoloSesion()
  mias(@Sesion() sesion: SesionActual): Promise<MiSolicitud[]> {
    return this.solicitudes.mias(sesion);
  }

  /**
   * La bandeja de RRHH.
   *
   * No recibe la sesión porque no la necesita: el cliente Prisma acotado ya filtra por la empresa
   * de quien pide (ADR-0003), así que pasarla sería una segunda forma de decidir lo mismo.
   */
  @Get()
  @RequierePermiso('solicitudes:resolver')
  paraRrhh(): Promise<SolicitudParaRrhh[]> {
    return this.solicitudes.paraRrhh();
  }

  /**
   * Proponer un taller sobre un tema que no está en el catálogo.
   *
   * No exige `talleres:publicar`: quien solo aprende también puede proponer un tema que echa de
   * menos, y de todos modos el taller lo crea RRHH. Exigirlo dejaría la propuesta en manos de
   * quienes ya pueden publicar, que son los que menos la necesitan.
   */
  @Post('propuesta-de-taller')
  @SoloSesion()
  proponerTaller(
    @Body(new ZodValidationPipe(proponerTallerSchema)) datos: ProponerTallerInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiSolicitud> {
    return this.solicitudes.proponerTaller(datos, sesion);
  }

  @Post('quiero-ensenar')
  @SoloSesion()
  pedirRolEnsenar(
    @Body(new ZodValidationPipe(pedirRolEnsenarSchema)) datos: PedirRolEnsenarInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiSolicitud> {
    return this.solicitudes.pedirRolEnsenar(datos, sesion);
  }

  @Patch(':id/aprobar')
  @RequierePermiso('solicitudes:resolver')
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<MiSolicitud> {
    return this.solicitudes.aprobar(id, sesion);
  }

  @Patch(':id/rechazar')
  @RequierePermiso('solicitudes:resolver')
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rechazarSolicitudSchema)) datos: RechazarSolicitudInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiSolicitud> {
    return this.solicitudes.rechazar(id, datos, sesion);
  }
}
