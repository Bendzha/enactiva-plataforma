import { Controller, Get } from '@nestjs/common';
import type { EmpresaResumen } from '@enactiva/shared';
import { RequierePermiso } from '../../common/decoradores.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @RequierePermiso('empresas:listar')
  listar(): Promise<EmpresaResumen[]> {
    return this.empresas.listar();
  }
}
