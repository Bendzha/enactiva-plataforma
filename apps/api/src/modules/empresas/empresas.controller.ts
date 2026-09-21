import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  crearEmpresaSchema,
  type CrearEmpresaInput,
  type EmpresaDetalle,
  type EmpresaResumen,
} from '@enactiva/shared';
import { RequierePermiso } from '../../common/decoradores.js';
import { Sesion, type SesionActual } from '../../common/sesion.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @RequierePermiso('empresas:listar')
  listar(): Promise<EmpresaResumen[]> {
    return this.empresas.listar();
  }

  @Get(':id')
  @RequierePermiso('empresas:listar')
  detalle(@Param('id', ParseUUIDPipe) id: string): Promise<EmpresaDetalle> {
    return this.empresas.detalle(id);
  }

  @Post()
  @RequierePermiso('empresas:crear')
  crear(
    @Body(new ZodValidationPipe(crearEmpresaSchema)) datos: CrearEmpresaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<EmpresaDetalle> {
    return this.empresas.crear(datos, sesion);
  }

  /** Solo el Admin Principal: es la decisión de que la empresa entra al piloto. */
  @Patch(':id/activar')
  @RequierePermiso('empresas:activar')
  activar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<EmpresaDetalle> {
    return this.empresas.activar(id, sesion);
  }

  @Post(':id/invitacion/reenviar')
  @RequierePermiso('invitaciones:gestionar')
  reenviar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<EmpresaDetalle> {
    return this.empresas.reenviarInvitacion(id, sesion);
  }
}
