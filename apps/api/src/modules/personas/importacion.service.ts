import { BadRequestException, Injectable } from '@nestjs/common';
import {
  COLUMNAS_IMPORTACION,
  MAXIMO_FILAS_IMPORTACION,
  ROLES_INVITABLES,
  emailSchema,
  normalizarNombre,
  type FilaImportada,
  type ResultadoImportacion,
  type RolInvitable,
  type VistaPreviaImportacion,
} from '@enactiva/shared';
import Papa from 'papaparse';
import type { SesionActual } from '../../common/sesion.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PersonasService } from './personas.service.js';

type FilaCruda = Record<string, string | undefined>;

/**
 * Carga masiva de colaboradores desde un CSV.
 * Se revisa fila por fila: un error en una fila no impide invitar al resto (tasks/plan.md T3.4).
 */
@Injectable()
export class ImportacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personas: PersonasService,
  ) {}

  async vistaPrevia(contenido: string): Promise<VistaPreviaImportacion> {
    const filas = await this.revisar(contenido);
    return this.resumir(filas);
  }

  async importar(contenido: string, sesion: SesionActual): Promise<ResultadoImportacion> {
    const filas = await this.revisar(contenido);
    const areasCreadas: string[] = [];
    let invitadas = 0;

    for (const fila of filas) {
      if (fila.error) continue;

      try {
        const areaId = fila.area
          ? await this.areaParaFila(fila.area, sesion, areasCreadas)
          : undefined;

        await this.personas.invitar(
          {
            email: fila.email,
            roles: fila.roles,
            ...(areaId ? { areaId } : {}),
            ...(fila.cargo ? { cargo: fila.cargo } : {}),
          },
          sesion,
        );
        invitadas += 1;
      } catch (error) {
        // La fila queda marcada, pero el resto del archivo se sigue procesando.
        fila.error = error instanceof Error ? error.message : 'No se pudo invitar';
      }
    }

    return { ...this.resumir(filas), invitadas, areasCreadas };
  }

  /** Busca el área por nombre normalizado y la crea si no existe. */
  private async areaParaFila(
    nombre: string,
    sesion: SesionActual,
    areasCreadas: string[],
  ): Promise<string> {
    const nombreNormalizado = normalizarNombre(nombre);
    const existente = await this.prisma.acotado.area.findFirst({ where: { nombreNormalizado } });
    if (existente) return existente.id;

    const creada = await this.prisma.acotado.area.create({
      data: { empresaId: sesion.empresaId!, nombre, nombreNormalizado },
    });
    areasCreadas.push(creada.nombre);
    return creada.id;
  }

  private async revisar(contenido: string): Promise<FilaImportada[]> {
    const { data, errors } = Papa.parse<FilaCruda>(contenido.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (encabezado) => normalizarNombre(encabezado),
    });

    if (errors.length > 0 && data.length === 0) {
      throw new BadRequestException('No pudimos leer el archivo: revisa que sea un CSV válido');
    }
    if (data.length > MAXIMO_FILAS_IMPORTACION) {
      throw new BadRequestException(
        `El archivo tiene ${data.length} filas; el máximo es ${MAXIMO_FILAS_IMPORTACION}`,
      );
    }
    if (data.length === 0) {
      throw new BadRequestException('El archivo no tiene filas con datos');
    }

    const areas = await this.prisma.acotado.area.findMany({ select: { nombreNormalizado: true } });
    const areasExistentes = new Set(areas.map((area) => area.nombreNormalizado));

    const emailsEnArchivo = new Set<string>();
    const filas: FilaImportada[] = [];

    for (const [indice, cruda] of data.entries()) {
      const email = (this.columna(cruda, COLUMNAS_IMPORTACION.email) ?? '').trim().toLowerCase();
      const area = this.columna(cruda, COLUMNAS_IMPORTACION.area)?.trim() || null;
      const cargo = this.columna(cruda, COLUMNAS_IMPORTACION.cargo)?.trim() || null;
      const { roles, errorRoles } = this.interpretarRoles(
        this.columna(cruda, COLUMNAS_IMPORTACION.roles),
      );

      const fila: FilaImportada = {
        fila: indice + 2, // +1 por el encabezado y +1 porque las filas parten en 1
        email,
        roles,
        area,
        areaNueva: area !== null && !areasExistentes.has(normalizarNombre(area)),
        cargo,
        error: null,
      };

      if (!emailSchema.safeParse(email).success) {
        fila.error = 'Email inválido';
      } else if (emailsEnArchivo.has(email)) {
        fila.error = 'Email repetido en el archivo';
      } else if (errorRoles) {
        fila.error = errorRoles;
      }

      emailsEnArchivo.add(email);
      filas.push(fila);
    }

    await this.marcarEmailsYaRegistrados(filas);
    return filas;
  }

  /** Marca las filas cuyo email ya tiene cuenta, en una sola consulta. */
  private async marcarEmailsYaRegistrados(filas: FilaImportada[]): Promise<void> {
    const candidatos = filas.filter((fila) => !fila.error).map((fila) => fila.email);
    if (candidatos.length === 0) return;

    const existentes = await this.prisma.usuario.findMany({
      where: { email: { in: candidatos } },
      select: { email: true },
    });
    const registrados = new Set(existentes.map((usuario) => usuario.email));

    for (const fila of filas) {
      if (!fila.error && registrados.has(fila.email)) {
        fila.error = 'Ya existe una cuenta con ese email';
      }
    }
  }

  private interpretarRoles(valor: string | undefined): {
    roles: RolInvitable[];
    errorRoles: string | null;
  } {
    const texto = (valor ?? '').trim();
    // Sin columna de roles, se asume que la persona entra como estudiante.
    if (!texto) return { roles: ['ESTUDIANTE'], errorRoles: null };

    const partes = texto
      .split(/[|,;/]/)
      .map((parte) => normalizarNombre(parte))
      .filter(Boolean);

    const roles: RolInvitable[] = [];
    for (const parte of partes) {
      const rol = ROLES_INVITABLES.find((candidato) => normalizarNombre(candidato) === parte);
      if (!rol) {
        return { roles: ['ESTUDIANTE'], errorRoles: `Rol desconocido: "${parte}"` };
      }
      if (!roles.includes(rol)) roles.push(rol);
    }

    return { roles, errorRoles: null };
  }

  private columna(fila: FilaCruda, alternativas: readonly string[]): string | undefined {
    for (const nombre of alternativas) {
      const valor = fila[nombre];
      if (valor !== undefined && valor !== '') return valor;
    }
    return undefined;
  }

  private resumir(filas: FilaImportada[]): VistaPreviaImportacion {
    return {
      filas,
      validas: filas.filter((fila) => !fila.error).length,
      conError: filas.filter((fila) => fila.error).length,
    };
  }
}
