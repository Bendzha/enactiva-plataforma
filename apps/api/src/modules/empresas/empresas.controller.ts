import { Body, Controller, Get, Post } from '@nestjs/common';
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

  @Post()
  @RequierePermiso('empresas:crear')
  crear(
    @Body(new ZodValidationPipe(crearEmpresaSchema)) datos: CrearEmpresaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<EmpresaDetalle> {
    return this.empresas.crear(datos, sesion);
  }
}
