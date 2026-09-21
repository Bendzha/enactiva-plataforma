import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizarNombre, type AreaResumen, type CrearAreaInput } from '@enactiva/shared';
import type { SesionActual } from '../../common/sesion.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Orden alfabético como lo espera una persona en español: ignora mayúsculas y tildes. */
const COLACION_ES = new Intl.Collator('es', { sensitivity: 'base' });

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<AreaResumen[]> {
    const areas = await this.prisma.acotado.area.findMany({
      include: { _count: { select: { usuarios: true } } },
    });

    areas.sort((a, b) => COLACION_ES.compare(a.nombre, b.nombre));

    return areas.map((area) => ({
      id: area.id,
      nombre: area.nombre,
      personas: area._count.usuarios,
    }));
  }

  async crear(datos: CrearAreaInput, sesion: SesionActual): Promise<AreaResumen> {
    const empresaId = this.empresaDe(sesion);
    const nombreNormalizado = normalizarNombre(datos.nombre);

    const repetida = await this.prisma.acotado.area.findFirst({ where: { nombreNormalizado } });
    if (repetida) {
      throw new ConflictException('Ya existe un área con ese nombre');
    }

    const area = await this.prisma.acotado.area.create({
      data: { empresaId, nombre: datos.nombre, nombreNormalizado },
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'Area',
      entidadId: area.id,
      actorId: sesion.usuarioId,
      actorRol: 'RRHH',
      empresaId,
      camposModificados: ['nombre'],
      ip: sesion.ip,
    });

    return { id: area.id, nombre: area.nombre, personas: 0 };
  }

  async renombrar(id: string, datos: CrearAreaInput, sesion: SesionActual): Promise<AreaResumen> {
    const empresaId = this.empresaDe(sesion);
    const area = await this.prisma.acotado.area.findUnique({ where: { id } });
    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }

    const nombreNormalizado = normalizarNombre(datos.nombre);
    const repetida = await this.prisma.acotado.area.findFirst({
      where: { nombreNormalizado, id: { not: id } },
    });
    if (repetida) {
      throw new ConflictException('Ya existe un área con ese nombre');
    }

    const actualizada = await this.prisma.acotado.area.update({
      where: { id },
      data: { nombre: datos.nombre, nombreNormalizado },
      include: { _count: { select: { usuarios: true } } },
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Area',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: 'RRHH',
      empresaId,
      camposModificados: ['nombre'],
      ip: sesion.ip,
    });

    return {
      id: actualizada.id,
      nombre: actualizada.nombre,
      personas: actualizada._count.usuarios,
    };
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
