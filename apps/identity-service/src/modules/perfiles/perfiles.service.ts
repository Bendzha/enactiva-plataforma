import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DeclararInteresInput,
  EditarInteresInput,
  GuardarPerfilInput,
  InteresDeclarado,
  MiPerfil,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import type { Dimension, NivelDominio, TipoInteres } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Lo que devuelve la consulta de una declaración junto con su tema. */
interface InteresConTema {
  id: string;
  temaId: string;
  tipo: TipoInteres;
  dimensiones: Dimension[];
  nivel: NivelDominio;
  tema: { nombre: string };
}

const COLACION_ES = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * El perfil corporativo de cada persona: qué puede enseñar, qué quiere aprender y sus intereses
 * generales (acta 2026-09-29, SPEC §3.6).
 *
 * Cada quien gestiona **solo el suyo**: el usuario sale siempre de la sesión verificada y nunca
 * de la URL ni del cuerpo, así que no hay forma de editar el perfil de otra persona.
 */
@Injectable()
export class PerfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async mio(sesion: SesionActual): Promise<MiPerfil> {
    this.empresaDe(sesion);

    const usuario = await this.prisma.acotado.usuario.findUnique({
      where: { id: sesion.usuarioId },
      include: {
        area: { select: { nombre: true } },
        perfil: { select: { interesesGenerales: true } },
        intereses: {
          select: {
            id: true,
            temaId: true,
            tipo: true,
            dimensiones: true,
            nivel: true,
            tema: { select: { nombre: true } },
          },
        },
      },
    });
    if (!usuario) {
      throw new NotFoundException('Perfil no encontrado');
    }

    const declaradas = (tipo: TipoInteres): InteresDeclarado[] =>
      usuario.intereses
        .filter((interes: InteresConTema) => interes.tipo === tipo)
        .map((interes: InteresConTema) => ({
          id: interes.id,
          temaId: interes.temaId,
          temaNombre: interes.tema.nombre,
          tipo: interes.tipo,
          dimensiones: interes.dimensiones,
          nivel: interes.nivel,
        }))
        .sort((a, b) => COLACION_ES.compare(a.temaNombre, b.temaNombre));

    return {
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      cargo: usuario.cargo,
      areaNombre: usuario.area?.nombre ?? null,
      interesesGenerales: usuario.perfil?.interesesGenerales ?? '',
      puedoEnsenar: declaradas('ENSENAR'),
      quieroAprender: declaradas('APRENDER'),
    };
  }

  async guardar(datos: GuardarPerfilInput, sesion: SesionActual): Promise<MiPerfil> {
    const empresaId = this.empresaDe(sesion);

    await this.prisma.acotado.perfilCorporativo.upsert({
      where: { usuarioId: sesion.usuarioId },
      create: {
        usuarioId: sesion.usuarioId,
        empresaId,
        interesesGenerales: datos.interesesGenerales,
      },
      update: { interesesGenerales: datos.interesesGenerales },
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'PerfilCorporativo',
      entidadId: sesion.usuarioId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['interesesGenerales'],
      ip: sesion.ip,
    });

    return this.mio(sesion);
  }

  async declarar(datos: DeclararInteresInput, sesion: SesionActual): Promise<InteresDeclarado> {
    const empresaId = this.empresaDe(sesion);

    // El acotado por empresa hace que un tema de otra organización simplemente no exista aquí.
    const tema = await this.prisma.acotado.tema.findUnique({ where: { id: datos.temaId } });
    if (!tema) {
      throw new NotFoundException('Tema no encontrado');
    }

    const yaDeclarado = await this.prisma.acotado.perfilInteres.findFirst({
      where: { usuarioId: sesion.usuarioId, temaId: datos.temaId, tipo: datos.tipo },
    });
    if (yaDeclarado) {
      throw new ConflictException('Ya declaraste ese tema; edita la declaración que tienes');
    }

    const interes = await this.prisma.acotado.perfilInteres.create({
      data: {
        empresaId,
        usuarioId: sesion.usuarioId,
        temaId: datos.temaId,
        tipo: datos.tipo,
        dimensiones: datos.dimensiones,
        nivel: datos.nivel,
      },
      include: { tema: { select: { nombre: true } } },
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'PerfilInteres',
      entidadId: interes.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['temaId', 'tipo', 'dimensiones', 'nivel'],
      ip: sesion.ip,
    });

    return this.aDeclarado(interes);
  }

  async editar(
    id: string,
    datos: EditarInteresInput,
    sesion: SesionActual,
  ): Promise<InteresDeclarado> {
    const empresaId = this.empresaDe(sesion);
    await this.propia(id, sesion);

    const interes = await this.prisma.acotado.perfilInteres.update({
      where: { id },
      data: { dimensiones: datos.dimensiones, nivel: datos.nivel },
      include: { tema: { select: { nombre: true } } },
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'PerfilInteres',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['dimensiones', 'nivel'],
      ip: sesion.ip,
    });

    return this.aDeclarado(interes);
  }

  async eliminar(id: string, sesion: SesionActual): Promise<void> {
    const empresaId = this.empresaDe(sesion);
    await this.propia(id, sesion);

    await this.prisma.acotado.perfilInteres.delete({ where: { id } });

    await this.auditoria.registrar({
      accion: 'ELIMINAR',
      entidad: 'PerfilInteres',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      ip: sesion.ip,
    });
  }

  /**
   * Comprueba que la declaración exista y sea de quien pide el cambio.
   *
   * Responde 404 y no 403 a propósito: si contestara "existe pero no es tuya", cualquiera podría
   * ir probando ids para saber qué declaró el resto.
   */
  private async propia(id: string, sesion: SesionActual): Promise<void> {
    const interes = await this.prisma.acotado.perfilInteres.findUnique({ where: { id } });
    if (!interes || interes.usuarioId !== sesion.usuarioId) {
      throw new NotFoundException('Declaración no encontrada');
    }
  }

  private aDeclarado(interes: InteresConTema): InteresDeclarado {
    return {
      id: interes.id,
      temaId: interes.temaId,
      temaNombre: interes.tema.nombre,
      tipo: interes.tipo,
      dimensiones: interes.dimensiones,
      nivel: interes.nivel,
    };
  }

  /** El equipo de ENACTIVA no tiene perfil corporativo: no pertenece a ninguna empresa. */
  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
