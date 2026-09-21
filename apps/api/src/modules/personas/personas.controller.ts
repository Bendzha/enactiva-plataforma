import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  crearAreaSchema,
  importarPersonasSchema,
  invitarPersonaSchema,
  type AreaResumen,
  type CrearAreaInput,
  type ImportarPersonasInput,
  type InvitarPersonaInput,
  type PersonaResumen,
  type ResultadoImportacion,
  type VistaPreviaImportacion,
} from '@enactiva/shared';
import { RequierePermiso } from '../../common/decoradores.js';
import { Sesion, type SesionActual } from '../../common/sesion.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { AreasService } from './areas.service.js';
import { ImportacionService } from './importacion.service.js';
import { PersonasService } from './personas.service.js';

@Controller()
export class PersonasController {
  constructor(
    private readonly personas: PersonasService,
    private readonly areas: AreasService,
    private readonly importacion: ImportacionService,
  ) {}

  @Get('personas')
  @RequierePermiso('personas:gestionar')
  listarPersonas(): Promise<PersonaResumen[]> {
    return this.personas.listar();
  }

  @Post('personas')
  @RequierePermiso('personas:gestionar')
  invitar(
    @Body(new ZodValidationPipe(invitarPersonaSchema)) datos: InvitarPersonaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<PersonaResumen> {
    return this.personas.invitar(datos, sesion);
  }

  @Post('personas/:id/invitacion/reenviar')
  @RequierePermiso('personas:gestionar')
  reenviar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<PersonaResumen> {
    return this.personas.reenviarInvitacion(id, sesion);
  }

  /** Revisa el archivo sin escribir nada: RRHH ve qué filas entrarían y cuáles fallan. */
  @Post('personas/importar/vista-previa')
  @HttpCode(200)
  @RequierePermiso('personas:gestionar')
  vistaPrevia(
    @Body(new ZodValidationPipe(importarPersonasSchema)) datos: ImportarPersonasInput,
  ): Promise<VistaPreviaImportacion> {
    return this.importacion.vistaPrevia(datos.contenido);
  }

  @Post('personas/importar')
  @RequierePermiso('personas:gestionar')
  importar(
    @Body(new ZodValidationPipe(importarPersonasSchema)) datos: ImportarPersonasInput,
    @Sesion() sesion: SesionActual,
  ): Promise<ResultadoImportacion> {
    return this.importacion.importar(datos.contenido, sesion);
  }

  @Get('areas')
  @RequierePermiso('personas:gestionar')
  listarAreas(): Promise<AreaResumen[]> {
    return this.areas.listar();
  }

  @Post('areas')
  @RequierePermiso('personas:gestionar')
  crearArea(
    @Body(new ZodValidationPipe(crearAreaSchema)) datos: CrearAreaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<AreaResumen> {
    return this.areas.crear(datos, sesion);
  }

  @Patch('areas/:id')
  @RequierePermiso('personas:gestionar')
  renombrarArea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(crearAreaSchema)) datos: CrearAreaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<AreaResumen> {
    return this.areas.renombrar(id, datos, sesion);
  }
}
