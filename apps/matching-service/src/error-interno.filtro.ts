import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { ErrorServicioInterno } from '@enactiva/service-kit';
import type { Response } from 'express';

/**
 * Traduce un error de otro servicio a la respuesta que espera el navegador.
 *
 * Sin esto, que identity-service esté caído llegaría como un 500 de este servicio, sin decir
 * dónde está el problema. Un 4xx del otro servicio sí se propaga: es el flujo normal.
 */
@Catch(ErrorServicioInterno)
export class ErrorInternoFiltro implements ExceptionFilter {
  private readonly logger = new Logger(ErrorInternoFiltro.name);

  catch(error: ErrorServicioInterno, host: ArgumentsHost): void {
    if (error.status >= 500) {
      this.logger.error(`${error.servicio} respondió ${error.status}: ${error.message}`);
    }

    const res = host.switchToHttp().getResponse<Response>();
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    const mensaje = status === 502 ? `${error.servicio} no está disponible` : error.message;

    res.status(status).json({ mensaje });
  }
}
