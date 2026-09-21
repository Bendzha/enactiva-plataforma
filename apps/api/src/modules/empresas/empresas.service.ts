import { Injectable } from '@nestjs/common';
import type { EmpresaResumen } from '@enactiva/shared';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Empresas del piloto con el número de personas activas en cada una. */
  async listar(): Promise<EmpresaResumen[]> {
    const empresas = await this.prisma.acotado.empresa.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { usuarios: { where: { estado: 'ACTIVO' } } } },
      },
    });

    return empresas.map((empresa) => ({
      id: empresa.id,
      nombre: empresa.nombre,
      rubro: empresa.rubro,
      estado: empresa.estado,
      activadaAt: empresa.activadaAt?.toISOString() ?? null,
      personasActivas: empresa._count.usuarios,
    }));
  }
}
