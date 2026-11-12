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
  SoloQuienParticipa,
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

  /**
   * Sacar un tema del catálogo. No lo borra: ver `TemasService.archivar`.
   * Mismo permiso que crearlo, porque es la misma responsabilidad: el catálogo es de RRHH.
   */
  @Delete('temas/:id')
  @HttpCode(204)
  @RequierePermiso('temas:crear')
  archivarTema(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<void> {
    return this.temas.archivar(id, sesion);
  }

  @Get('mi-perfil')
  @SoloQuienParticipa()
  miPerfil(@Sesion() sesion: SesionActual): Promise<MiPerfil> {
    return this.perfiles.mio(sesion);
  }

  @Put('mi-perfil')
  @SoloQuienParticipa()
  guardarMiPerfil(
    @Body(new ZodValidationPipe(guardarPerfilSchema)) datos: GuardarPerfilInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiPerfil> {
    return this.perfiles.guardar(datos, sesion);
  }

  @Post('mi-perfil/intereses')
  @SoloQuienParticipa()
  declarar(
    @Body(new ZodValidationPipe(declararInteresSchema)) datos: DeclararInteresInput,
    @Sesion() sesion: SesionActual,
  ): Promise<InteresDeclarado> {
    return this.perfiles.declarar(datos, sesion);
  }

  @Patch('mi-perfil/intereses/:id')
  @SoloQuienParticipa()
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(editarInteresSchema)) datos: EditarInteresInput,
    @Sesion() sesion: SesionActual,
  ): Promise<InteresDeclarado> {
    return this.perfiles.editar(id, datos, sesion);
  }

  @Delete('mi-perfil/intereses/:id')
  @HttpCode(204)
  @SoloQuienParticipa()
  eliminar(@Param('id', ParseUUIDPipe) id: string, @Sesion() sesion: SesionActual): Promise<void> {
    return this.perfiles.eliminar(id, sesion);
  }
}
