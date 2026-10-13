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
      where: normalizado ? { nombreNormalizado: { contains: normalizado } } : {},
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
