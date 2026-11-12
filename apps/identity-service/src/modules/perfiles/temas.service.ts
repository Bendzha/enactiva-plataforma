import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MAXIMO_TEMAS_SUGERIDOS,
  normalizarNombre,
  type CrearTemaInput,
  type TemaInterno,
  type TemaResumen,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Orden alfabético como lo espera una persona en español: ignora mayúsculas y tildes. */
const COLACION_ES = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Catálogo de temas de cada empresa (SPEC §3.6).
 *
 * El catálogo existe para que el matching funcione: si cada persona escribiera el tema a mano,
 * "Excel", "excel avanzado" y "EXCEL" serían tres temas distintos y nadie haría match. Por eso
 * se busca antes de crear y el nombre normalizado es único por empresa.
 */
@Injectable()
export class TemasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Los temas de la empresa que coinciden con el término, para sugerir antes de crear uno nuevo. */
  async buscar(termino: string | undefined): Promise<TemaResumen[]> {
    const normalizado = termino ? normalizarNombre(termino) : '';

    const temas = await this.prisma.acotado.tema.findMany({
      // Los archivados salieron del catálogo: no se sugieren ni se pueden elegir.
      where: {
        archivadoAt: null,
        ...(normalizado ? { nombreNormalizado: { contains: normalizado } } : {}),
      },
      include: { intereses: { select: { tipo: true } } },
      orderBy: { nombreNormalizado: 'asc' },
      take: MAXIMO_TEMAS_SUGERIDOS,
    });

    return temas
      .sort((a, b) => COLACION_ES.compare(a.nombre, b.nombre))
      .map((tema) => ({
        id: tema.id,
        nombre: tema.nombre,
        puedenEnsenar: tema.intereses.filter((i) => i.tipo === 'ENSENAR').length,
        quierenAprender: tema.intereses.filter((i) => i.tipo === 'APRENDER').length,
      }));
  }

  /**
   * Los temas que pidió otro servicio, de los que existan en la empresa de quien consulta.
   * Devuelve menos de los pedidos si alguno no es suyo: eso ya es la respuesta.
   *
   * **Acá sí entran los archivados**, a propósito: un taller que se convocó sobre un tema que
   * después salió del catálogo tiene que seguir mostrando su nombre. Archivar deja de ofrecerlo,
   * no borra la historia.
   */
  async porIds(ids: string[]): Promise<TemaInterno[]> {
    const temas = await this.prisma.acotado.tema.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true },
    });
    return temas;
  }

  async crear(datos: CrearTemaInput, sesion: SesionActual): Promise<TemaResumen> {
    const empresaId = await this.empresaDestino(datos, sesion);
    const nombreNormalizado = normalizarNombre(datos.nombre);

    const repetido = await this.prisma.acotado.tema.findFirst({
      where: { empresaId, nombreNormalizado },
    });
    if (repetido) {
      // Si estaba archivado, volver a crearlo es traerlo de vuelta: el nombre normalizado es
      // único por empresa, así que si no, el catálogo quedaría con un tema imposible de
      // recuperar y de recrear.
      if (repetido.archivadoAt) {
        return this.desarchivar(repetido.id, empresaId, sesion);
      }
      throw new ConflictException('Ya existe un tema con ese nombre');
    }

    const tema = await this.prisma.acotado.tema.create({
      data: {
        empresaId,
        nombre: datos.nombre,
        nombreNormalizado,
        creadoPorId: sesion.usuarioId,
      },
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'Tema',
      entidadId: tema.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['nombre'],
      ip: sesion.ip,
    });

    return { id: tema.id, nombre: tema.nombre, puedenEnsenar: 0, quierenAprender: 0 };
  }

  /**
   * Sacar un tema del catálogo (SPEC §3.6, 2026-11-12).
   *
   * No se borra. De un tema cuelgan las declaraciones de la gente —con borrado en cascada— y
   * los talleres de learning_db, que lo referencian sin clave foránea porque viven en otra base
   * (ADR-0007). Un DELETE se llevaría los perfiles por delante en silencio y dejaría talleres
   * apuntando a la nada, y identity no puede preguntarle a learning sin invertir la dirección
   * de dependencias que el ADR fija.
   *
   * Archivarlo deja de ofrecerlo: no aparece en el catálogo ni se puede declarar. Lo que ya
   * existe sigue funcionando y mostrando su nombre.
   */
  async archivar(id: string, sesion: SesionActual): Promise<void> {
    // Por el cliente acotado: un tema de otra empresa no existe acá, así que responde 404 y no
    // 403, que confirmaría que existe.
    const tema = await this.prisma.acotado.tema.findFirst({ where: { id } });
    if (!tema) {
      throw new NotFoundException('Tema no encontrado');
    }
    if (tema.archivadoAt) {
      throw new ConflictException('Ese tema ya está fuera del catálogo');
    }

    await this.prisma.acotado.tema.update({ where: { id }, data: { archivadoAt: new Date() } });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Tema',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: tema.empresaId,
      camposModificados: ['archivadoAt'],
      ip: sesion.ip,
    });
  }

  /** Vuelve al catálogo tal como estaba, con las declaraciones que nunca se fueron. */
  private async desarchivar(
    id: string,
    empresaId: string,
    sesion: SesionActual,
  ): Promise<TemaResumen> {
    const tema = await this.prisma.acotado.tema.update({
      where: { id },
      data: { archivadoAt: null },
      include: { intereses: { select: { tipo: true } } },
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Tema',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['archivadoAt'],
      ip: sesion.ip,
    });

    return {
      id: tema.id,
      nombre: tema.nombre,
      puedenEnsenar: tema.intereses.filter((i) => i.tipo === 'ENSENAR').length,
      quierenAprender: tema.intereses.filter((i) => i.tipo === 'APRENDER').length,
    };
  }

  /**
   * En qué empresa se crea el tema.
   *
   * Para quien trabaja en una empresa sale de la sesión verificada y nunca del cuerpo de la
   * petición (ADR-0007). El equipo de ENACTIVA no pertenece a ninguna, así que es el único que
   * indica la empresa, y se comprueba que exista.
   */
  private async empresaDestino(datos: CrearTemaInput, sesion: SesionActual): Promise<string> {
    if (sesion.roles.includes('ADMIN_ENACTIVA')) {
      if (!datos.empresaId) {
        throw new BadRequestException('Indica en qué empresa se crea el tema');
      }
      const empresa = await this.prisma.empresa.findUnique({ where: { id: datos.empresaId } });
      if (!empresa) {
        throw new NotFoundException('Empresa no encontrada');
      }
      return empresa.id;
    }

    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    if (datos.empresaId && datos.empresaId !== sesion.empresaId) {
      throw new ForbiddenException('Solo puedes crear temas en tu empresa');
    }
    return sesion.empresaId;
  }
}
