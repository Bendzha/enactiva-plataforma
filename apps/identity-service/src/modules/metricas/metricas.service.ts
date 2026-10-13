import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  MAXIMO_TEMAS_DESTACADOS,
  type InteresesDeEmpresa,
  type MetricasGlobales,
  type MetricasIntereses,
  type TemaDemanda,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Conteo de declaraciones agrupadas por tema y tipo, tal como lo devuelve Prisma. */
interface ConteoPorTema {
  empresaId?: string;
  temaId: string;
  tipo: 'ENSENAR' | 'APRENDER';
  _count: { _all: number };
}

const COLACION_ES = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Las métricas que la clienta pidió ver cuando la gente empezara a registrar sus intereses
 * (acta 2026-09-29).
 *
 * Todo lo que sale de aquí es un agregado. Nunca se devuelve quién declaró qué: para decidir
 * dónde hace falta formación alcanza con el número, y pedir menos datos es la regla (Ley 21.719).
 */
@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que ve RRHH de su propia empresa. El acotado decide cuál es "su" empresa (ADR-0003). */
  async intereses(sesion: SesionActual): Promise<MetricasIntereses> {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }

    const [personasActivas, temas, declaraciones, porPersona, porTema] = await Promise.all([
      this.prisma.acotado.usuario.count({ where: { estado: 'ACTIVO' } }),
      this.prisma.acotado.tema.findMany({ select: { id: true, nombre: true } }),
      this.prisma.acotado.perfilInteres.count(),
      this.prisma.acotado.perfilInteres.groupBy({ by: ['usuarioId'] }),
      this.prisma.acotado.perfilInteres.groupBy({
        by: ['temaId', 'tipo'],
        _count: { _all: true },
      }),
    ]);

    const demanda = this.demandaPorTema(temas, porTema as ConteoPorTema[]);

    return {
      personasActivas,
      personasConPerfil: porPersona.length,
      temas: temas.length,
      declaraciones,
      brechas: this.destacar(
        demanda.filter((t) => t.quierenAprender > 0 && t.puedenEnsenar === 0),
        (t) => t.quierenAprender,
      ),
      masOfrecidos: this.destacar(
        demanda.filter((t) => t.puedenEnsenar > 0),
        (t) => t.puedenEnsenar,
      ),
      masBuscados: this.destacar(
        demanda.filter((t) => t.quierenAprender > 0),
        (t) => t.quierenAprender,
      ),
    };
  }

  /**
   * Lo que ve el Admin Principal del piloto completo.
   *
   * Usa el cliente sin acotar a propósito: es la única vista que cruza empresas, y el permiso
   * `metricas-globales:ver` ya la restringe al equipo de ENACTIVA.
   */
  async globales(): Promise<MetricasGlobales> {
    const [empresas, porPersona, porTema] = await Promise.all([
      this.prisma.empresa.findMany({
        select: {
          id: true,
          nombre: true,
          temas: { select: { id: true, nombre: true } },
          _count: { select: { usuarios: { where: { estado: 'ACTIVO' } } } },
        },
      }),
      this.prisma.perfilInteres.groupBy({ by: ['empresaId', 'usuarioId'] }),
      this.prisma.perfilInteres.groupBy({
        by: ['empresaId', 'temaId', 'tipo'],
        _count: { _all: true },
      }),
    ]);

    const conteos = porTema as ConteoPorTema[];

    const detalle: InteresesDeEmpresa[] = empresas
      .map((empresa) => {
        const suyos = conteos.filter((c) => c.empresaId === empresa.id);
        const demanda = this.demandaPorTema(empresa.temas, suyos);

        return {
          empresaId: empresa.id,
          nombre: empresa.nombre,
          personasActivas: empresa._count.usuarios,
          personasConPerfil: porPersona.filter((p) => p.empresaId === empresa.id).length,
          temas: empresa.temas.length,
          declaraciones: suyos.reduce((suma, c) => suma + c._count._all, 0),
          brechas: demanda.filter((t) => t.quierenAprender > 0 && t.puedenEnsenar === 0).length,
        };
      })
      .sort((a, b) => COLACION_ES.compare(a.nombre, b.nombre));

    return {
      personasActivas: detalle.reduce((suma, e) => suma + e.personasActivas, 0),
      personasConPerfil: porPersona.length,
      temas: detalle.reduce((suma, e) => suma + e.temas, 0),
      declaraciones: detalle.reduce((suma, e) => suma + e.declaraciones, 0),
      empresas: detalle,
    };
  }

  /** Cruza los temas con sus conteos; un tema sin declaraciones queda en cero, no desaparece. */
  private demandaPorTema(
    temas: { id: string; nombre: string }[],
    conteos: ConteoPorTema[],
  ): TemaDemanda[] {
    return temas.map((tema) => {
      const suyos = conteos.filter((c) => c.temaId === tema.id);
      const cuantos = (tipo: 'ENSENAR' | 'APRENDER') =>
        suyos.filter((c) => c.tipo === tipo).reduce((suma, c) => suma + c._count._all, 0);

      return {
        temaId: tema.id,
        nombre: tema.nombre,
        puedenEnsenar: cuantos('ENSENAR'),
        quierenAprender: cuantos('APRENDER'),
      };
    });
  }

  /** Los más altos primero y, a igualdad, por nombre: así la lista no baila entre recargas. */
  private destacar(temas: TemaDemanda[], peso: (tema: TemaDemanda) => number): TemaDemanda[] {
    return [...temas]
      .sort((a, b) => peso(b) - peso(a) || COLACION_ES.compare(a.nombre, b.nombre))
      .slice(0, MAXIMO_TEMAS_DESTACADOS);
  }
}
