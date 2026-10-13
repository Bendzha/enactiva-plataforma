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
  Query,
} from '@nestjs/common';
import {
  crearTemaSchema,
  declararInteresSchema,
  editarInteresSchema,
  guardarPerfilSchema,
  type CrearTemaInput,
  type DeclararInteresInput,
  type EditarInteresInput,
  type GuardarPerfilInput,
  type InteresDeclarado,
  type MiPerfil,
  type TemaResumen,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { PerfilesService } from './perfiles.service.js';
import { TemasService } from './temas.service.js';

@Controller()
export class PerfilesController {
  constructor(
    private readonly perfiles: PerfilesService,
    private readonly temas: TemasService,
  ) {}

  /**
   * Cualquiera con sesión puede consultar el catálogo de su empresa: para declarar lo que enseña
   * necesita buscar el tema antes. El acotado por empresa decide qué temas son "los suyos".
   */
  @Get('temas')
  @SoloSesion()
  buscarTemas(@Query('buscar') buscar?: string): Promise<TemaResumen[]> {
    return this.temas.buscar(buscar);
  }

  @Post('temas')
  @RequierePermiso('temas:crear')
  crearTema(
    @Body(new ZodValidationPipe(crearTemaSchema)) datos: CrearTemaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<TemaResumen> {
    return this.temas.crear(datos, sesion);
  }

  @Get('mi-perfil')
  @SoloSesion()
  miPerfil(@Sesion() sesion: SesionActual): Promise<MiPerfil> {
    return this.perfiles.mio(sesion);
  }

  @Put('mi-perfil')
  @SoloSesion()
  guardarMiPerfil(
    @Body(new ZodValidationPipe(guardarPerfilSchema)) datos: GuardarPerfilInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiPerfil> {
    return this.perfiles.guardar(datos, sesion);
  }

  @Post('mi-perfil/intereses')
  @SoloSesion()
  declarar(
    @Body(new ZodValidationPipe(declararInteresSchema)) datos: DeclararInteresInput,
    @Sesion() sesion: SesionActual,
  ): Promise<InteresDeclarado> {
    return this.perfiles.declarar(datos, sesion);
  }

  @Patch('mi-perfil/intereses/:id')
  @SoloSesion()
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarInteresSchema)) datos: EditarInteresInput,
    @Sesion() sesion: SesionActual,
  ): Promise<InteresDeclarado> {
    return this.perfiles.editar(id, datos, sesion);
  }

  @Delete('mi-perfil/intereses/:id')
  @HttpCode(204)
  @SoloSesion()
  eliminar(@Param('id', ParseUUIDPipe) id: string, @Sesion() sesion: SesionActual): Promise<void> {
    return this.perfiles.eliminar(id, sesion);
  }
}
