import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PREFIJO_INTERNO, restablecerPasswordSchema } from '@enactiva/shared';
import { SoloInterno, ZodValidationPipe } from '@enactiva/service-kit';
import { z } from 'zod';
import { RecuperacionService } from './recuperacion.service.js';

/** El email ya viene normalizado por auth-service; aquí solo se arrastra la IP para auditar. */
const solicitarInternoSchema = z.object({
  email: z.string().min(1),
  ip: z.string().nullable().optional(),
});
type SolicitarInternoInput = z.infer<typeof solicitarInternoSchema>;

const restablecerInternoSchema = restablecerPasswordSchema.extend({
  ip: z.string().nullable().optional(),
});
type RestablecerInternoInput = z.infer<typeof restablecerInternoSchema>;

/**
 * Recuperación de contraseña, llamada por auth-service (ADR-0007).
 *
 * Son rutas anteriores al login, así que van con el secreto compartido: no hay token de usuario
 * que reenviar. El gateway nunca las expone hacia afuera.
 */
@Controller(`${PREFIJO_INTERNO}/recuperacion`)
export class RecuperacionController {
  constructor(private readonly recuperacion: RecuperacionService) {}

  @Post('solicitar')
  @SoloInterno()
  @HttpCode(204)
  solicitar(
    @Body(new ZodValidationPipe(solicitarInternoSchema)) datos: SolicitarInternoInput,
  ): Promise<void> {
    return this.recuperacion.solicitar(datos.email, datos.ip);
  }

  @Post('restablecer')
  @SoloInterno()
  @HttpCode(204)
  restablecer(
    @Body(new ZodValidationPipe(restablecerInternoSchema)) datos: RestablecerInternoInput,
  ): Promise<void> {
    return this.recuperacion.restablecer(datos, datos.ip);
  }
}
