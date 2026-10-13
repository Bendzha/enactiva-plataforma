import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  crearTallerSchema,
  editarTallerSchema,
  guardarDisponibilidadSchema,
  type CrearTallerInput,
  type EditarTallerInput,
  type FranjaDisponibilidad,
  type GuardarDisponibilidadInput,
  type TallerResumen,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { DisponibilidadService } from './disponibilidad.service.js';
import { TalleresService } from './talleres.service.js';

@Controller()
export class TalleresController {
  constructor(
    private readonly talleres: TalleresService,
    private readonly disponibilidad: DisponibilidadService,
  ) {}

  /** Los talleres de mi empresa que todavía no ocurren. Cualquiera con sesión puede mirarlos. */
  @Get('talleres')
  @SoloSesion()
  proximos(@Sesion() sesion: SesionActual): Promise<TallerResumen[]> {
    return this.talleres.proximos(sesion);
  }

  @Get('talleres/mios')
  @RequierePermiso('talleres:publicar')
  mios(@Sesion() sesion: SesionActual): Promise<TallerResumen[]> {
    return this.talleres.mios(sesion);
  }

  @Post('talleres')
  @RequierePermiso('talleres:publicar')
  crear(
    @Body(new ZodValidationPipe(crearTallerSchema)) datos: CrearTallerInput,
    @Sesion() sesion: SesionActual,
  ): Promise<TallerResumen> {
    return this.talleres.crear(datos, sesion);
  }

  @Patch('talleres/:id')
  @RequierePermiso('talleres:publicar')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarTallerSchema)) datos: EditarTallerInput,
    @Sesion() sesion: SesionActual,
  ): Promise<TallerResumen> {
    return this.talleres.editar(id, datos, sesion);
  }

  @Post('talleres/:id/inscripcion')
  @SoloSesion()
  inscribir(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<TallerResumen> {
    return this.talleres.inscribir(id, sesion);
  }

  @Delete('talleres/:id/inscripcion')
  @HttpCode(200)
  @SoloSesion()
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<TallerResumen> {
    return this.talleres.cancelar(id, sesion);
  }

  @Get('disponibilidad')
  @RequierePermiso('talleres:publicar')
  miDisponibilidad(@Sesion() sesion: SesionActual): Promise<FranjaDisponibilidad[]> {
    return this.disponibilidad.mia(sesion);
  }

  @Put('disponibilidad')
  @RequierePermiso('talleres:publicar')
  guardarDisponibilidad(
    @Body(new ZodValidationPipe(guardarDisponibilidadSchema)) datos: GuardarDisponibilidadInput,
    @Sesion() sesion: SesionActual,
  ): Promise<FranjaDisponibilidad[]> {
    return this.disponibilidad.guardar(datos, sesion);
  }
}
