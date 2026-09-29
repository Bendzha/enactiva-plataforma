import { timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { CABECERA_INTERNO } from '@enactiva/shared';

/** Token de inyección del secreto compartido entre servicios. */
export const SECRETO_INTERNO = 'SECRETO_INTERNO';

/**
 * Comprueba el secreto de una llamada entre servicios (ADR-0007).
 *
 * La comparación es de tiempo constante: comparar con `===` filtra, por el tiempo que tarda en
 * responder, cuántos caracteres del secreto acertó quien lo está adivinando.
 */
export function verificarSecretoInterno(
  recibido: string | string[] | undefined,
  esperado: string | undefined,
): void {
  if (!esperado) {
    // Un servicio sin secreto configurado no puede atender rutas internas: si lo dejáramos
    // pasar, olvidar la variable de entorno abriría el endpoint a cualquiera.
    throw new UnauthorizedException('Este servicio no tiene configurado el secreto interno');
  }

  const valor = Array.isArray(recibido) ? recibido[0] : recibido;
  if (!valor) {
    throw new UnauthorizedException(`Falta la cabecera ${CABECERA_INTERNO}`);
  }

  const a = Buffer.from(valor);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Secreto interno inválido');
  }
}
