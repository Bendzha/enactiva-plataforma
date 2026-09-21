import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  crearAreaSchema,
  invitarPersonaSchema,
  type AreaResumen,
  type CrearAreaInput,
  type InvitarPersonaInput,
  type PersonaResumen,
} from '@enactiva/shared';
import { RequierePermiso } from '../../common/decoradores.js';
import { Sesion, type SesionActual } from '../../common/sesion.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { AreasService } from './areas.service.js';
import { PersonasService } from './personas.service.js';

@Controller()
export class PersonasController {
  constructor(
    private readonly personas: PersonasService,
    private readonly areas: AreasService,
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
