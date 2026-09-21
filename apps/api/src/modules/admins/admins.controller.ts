import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { crearAdminSchema, type AdminResumen, type CrearAdminInput } from '@enactiva/shared';
import { RequierePermiso } from '../../common/decoradores.js';
import { Sesion, type SesionActual } from '../../common/sesion.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { AdminsService } from './admins.service.js';

/** Equipo de ENACTIVA: solo el Admin Principal puede verlo y modificarlo. */
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @RequierePermiso('admins:gestionar')
  listar(): Promise<AdminResumen[]> {
    return this.admins.listar();
  }

  @Post()
  @RequierePermiso('admins:gestionar')
  invitar(
    @Body(new ZodValidationPipe(crearAdminSchema)) datos: CrearAdminInput,
    @Sesion() sesion: SesionActual,
  ): Promise<AdminResumen> {
    return this.admins.invitar(datos, sesion);
  }

  @Patch(':id/desactivar')
  @RequierePermiso('admins:gestionar')
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<AdminResumen> {
    return this.admins.desactivar(id, sesion);
  }
}
