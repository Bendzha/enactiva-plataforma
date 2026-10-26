import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OcultarReferenciaInput, ReferenciaPublicada } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { IdentityCliente } from '../../identity.cliente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Referencia tal como sale de la base. */
interface ReferenciaEnBase {
  id: string;
  tallerId: string;
  capacitadorId: string;
  autorId: string;
  texto: string;
  ocultaAt: Date | null;
  motivoOculta: string | null;
  createdAt: Date;
  valoracion: { taller: { nombre: string } };
}

/**
 * Referencias en texto libre (SPEC §3.5, ADR-0009, Q17).
 *
 * Es lo más delicado que guarda la plataforma: texto de una persona sobre otra, identificada,
 * dentro de su trabajo. Por eso va **firmada** —quien la escribe lo sabe antes de escribirla—,
 * se ve solo dentro de la empresa, y RRHH puede ocultarla dejando registro.
 *
 * Ocultar no borra. Borrar la evidencia de un conflicto laboral es peor que conservarla.
 */
@Injectable()
export class ReferenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly identity: IdentityCliente,
  ) {}

  /** Las referencias que recibió una persona por los talleres que dictó. */
  async deLaPersona(capacitadorId: string, sesion: SesionActual): Promise<ReferenciaPublicada[]> {
    this.empresaDe(sesion);
    const referencias = await this.prisma.acotado.referencia.findMany({
      where: { capacitadorId, ...this.filtroDeVisibilidad(sesion) },
      select: this.seleccion(),
      orderBy: { createdAt: 'desc' },
    });
    return this.publicar(referencias, sesion);
  }

  /** Las de un taller, para mostrarlas junto a sus estrellas. */
  async delTaller(tallerId: string, sesion: SesionActual): Promise<ReferenciaPublicada[]> {
    this.empresaDe(sesion);
    const referencias = await this.prisma.acotado.referencia.findMany({
      where: { tallerId, ...this.filtroDeVisibilidad(sesion) },
      select: this.seleccion(),
      orderBy: { createdAt: 'desc' },
    });
    return this.publicar(referencias, sesion);
  }

  /**
   * RRHH oculta una referencia y dice por qué.
   *
   * El motivo es obligatorio y queda en la base, no solo en la auditoría: quien la escribió y
   * quien la recibió tienen derecho a saber que alguien intervino y con qué argumento.
   */
  async ocultar(
    id: string,
    entrada: OcultarReferenciaInput,
    sesion: SesionActual,
  ): Promise<ReferenciaPublicada> {
    const empresaId = this.empresaDe(sesion);

    const referencia = await this.prisma.acotado.referencia.findUnique({
      where: { id },
      select: { id: true, ocultaAt: true },
    });
    if (!referencia) {
      throw new NotFoundException('Esa referencia no existe en tu empresa');
    }

    const actualizada = await this.prisma.referencia.update({
      where: { id, empresaId },
      data: {
        ocultaAt: referencia.ocultaAt ?? new Date(),
        ocultaPorId: sesion.usuarioId,
        motivoOculta: entrada.motivo,
      },
      select: this.seleccion(),
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Referencia',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      // El nombre del campo, no el motivo: el registro no guarda texto sobre personas.
      camposModificados: ['ocultaAt', 'motivoOculta'],
      ip: sesion.ip,
    });

    return (await this.publicar([actualizada], sesion))[0]!;
  }

  /** Vuelve a mostrarla, por si la ocultaron por error. También queda registrado. */
  async mostrar(id: string, sesion: SesionActual): Promise<ReferenciaPublicada> {
    const empresaId = this.empresaDe(sesion);

    const referencia = await this.prisma.acotado.referencia.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!referencia) {
      throw new NotFoundException('Esa referencia no existe en tu empresa');
    }

    const actualizada = await this.prisma.referencia.update({
      where: { id, empresaId },
      data: { ocultaAt: null, ocultaPorId: sesion.usuarioId, motivoOculta: null },
      select: this.seleccion(),
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Referencia',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['ocultaAt'],
      ip: sesion.ip,
    });

    return (await this.publicar([actualizada], sesion))[0]!;
  }

  /**
   * Para RRHH una referencia oculta sigue existiendo; para el resto, no.
   *
   * Quien modera tiene que poder ver lo que ocultó —si no, no podría deshacerlo— y eso es
   * justamente lo que distingue ocultar de borrar.
   */
  private filtroDeVisibilidad(sesion: SesionActual) {
    return sesion.roles.includes('RRHH') ? {} : { ocultaAt: null };
  }

  /** Les pone el nombre de quien las escribió, que es lo que las vuelve una firma. */
  private async publicar(
    referencias: ReferenciaEnBase[],
    sesion: SesionActual,
  ): Promise<ReferenciaPublicada[]> {
    if (referencias.length === 0) return [];

    const autores = await this.identity.personasPorIds(referencias.map((fila) => fila.autorId));
    const esRrhh = sesion.roles.includes('RRHH');

    return referencias.map((fila) => {
      const autor = autores.get(fila.autorId);
      return {
        id: fila.id,
        tallerId: fila.tallerId,
        tallerNombre: fila.valoracion.taller.nombre,
        capacitadorId: fila.capacitadorId,
        autorId: fila.autorId,
        // Si identity no lo devuelve es porque la cuenta se anonimizó (Ley 21.719): la
        // referencia sobrevive, pero ya no dice quién era.
        autorNombre: nombreDe(autor) ?? 'Cuenta eliminada',
        texto: fila.texto,
        createdAt: fila.createdAt.toISOString(),
        oculta: fila.ocultaAt !== null,
        motivoOcultada: esRrhh ? fila.motivoOculta : null,
      };
    });
  }

  private seleccion() {
    return {
      id: true,
      tallerId: true,
      capacitadorId: true,
      autorId: true,
      texto: true,
      ocultaAt: true,
      motivoOculta: true,
      createdAt: true,
      valoracion: { select: { taller: { select: { nombre: true } } } },
    } as const;
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Esta acción es de los colaboradores de una empresa');
    }
    return sesion.empresaId;
  }
}

function nombreDe(persona: { nombre: string | null; apellido: string | null } | undefined) {
  if (!persona) return null;
  const nombre = [persona.nombre, persona.apellido].filter(Boolean).join(' ').trim();
  return nombre || null;
}
