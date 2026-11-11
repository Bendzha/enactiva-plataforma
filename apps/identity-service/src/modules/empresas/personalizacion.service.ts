import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  COLORES_PERSONALIZABLES,
  type GuardarPersonalizacionInput,
  type Personalizacion,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

interface FilaEmpresa {
  nombre: string;
  colorMarca: string | null;
  colorAcento: string | null;
  colorFondo: string | null;
  colorTexto: string | null;
  logo: string | null;
}

const CAMPOS = {
  nombre: true,
  colorMarca: true,
  colorAcento: true,
  colorFondo: true,
  colorTexto: true,
  logo: true,
} as const;

/**
 * Se considera personalizada solo si están **los cuatro** colores. Media paleta aplicada sería
 * una pantalla a medio pintar, peor que la plantilla entera.
 */
function aPersonalizacion(empresa: FilaEmpresa): Personalizacion {
  const completa =
    empresa.colorMarca !== null &&
    empresa.colorAcento !== null &&
    empresa.colorFondo !== null &&
    empresa.colorTexto !== null;

  return {
    empresaNombre: empresa.nombre,
    logo: empresa.logo,
    colores: completa
      ? {
          marca: empresa.colorMarca!,
          acento: empresa.colorAcento!,
          fondo: empresa.colorFondo!,
          texto: empresa.colorTexto!,
        }
      : null,
  };
}

/**
 * El logo y los colores de cada empresa (SPEC §3.8, ADR-0011).
 *
 * La empresa sale **siempre de la sesión verificada** y nunca de la URL: así una RRHH no puede
 * repintarle el entorno a otra organización aunque se invente el id.
 */
@Injectable()
export class PersonalizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** La lee cualquiera con sesión en una empresa: es lo que pinta su propia pantalla. */
  async mia(sesion: SesionActual): Promise<Personalizacion> {
    const empresaId = this.empresaDe(sesion);
    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id: empresaId },
      select: CAMPOS,
    });
    return aPersonalizacion(empresa);
  }

  async guardar(
    datos: GuardarPersonalizacionInput,
    sesion: SesionActual,
  ): Promise<Personalizacion> {
    const empresaId = this.empresaDe(sesion);

    const empresa = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        colorMarca: datos.colores.marca,
        colorAcento: datos.colores.acento,
        colorFondo: datos.colores.fondo,
        colorTexto: datos.colores.texto,
        logo: datos.logo,
      },
      select: CAMPOS,
    });

    await this.auditar(empresaId, sesion, [
      ...COLORES_PERSONALIZABLES.map((color) => `color.${color}`),
      'logo',
    ]);

    return aPersonalizacion(empresa);
  }

  /** Volver a la plantilla. No borra la empresa de nada: deja de pintar, nada más. */
  async restablecer(sesion: SesionActual): Promise<Personalizacion> {
    const empresaId = this.empresaDe(sesion);

    const empresa = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        colorMarca: null,
        colorAcento: null,
        colorFondo: null,
        colorTexto: null,
        logo: null,
      },
      select: CAMPOS,
    });

    await this.auditar(empresaId, sesion, ['personalizacion']);
    return aPersonalizacion(empresa);
  }

  private async auditar(
    empresaId: string,
    sesion: SesionActual,
    camposModificados: string[],
  ): Promise<void> {
    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: empresaId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados,
      ip: sesion.ip,
    });
  }

  /**
   * El equipo de ENACTIVA no personaliza nada: no pertenece a ninguna empresa, y sus pantallas
   * tienen que verse igual mirando a cualquiera de ellas (ADR-0011).
   */
  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
