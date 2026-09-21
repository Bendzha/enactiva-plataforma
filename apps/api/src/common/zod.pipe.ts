import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Valida el cuerpo de la petición con un esquema Zod compartido con el frontend. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      throw new BadRequestException({
        mensaje: 'Datos inválidos',
        errores: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
    }
    return resultado.data;
  }
}
