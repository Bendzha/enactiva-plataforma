import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorIdentity } from './identity.cliente.js';

/**
 * Traduce un error de identity-service a la respuesta que espera el navegador.
 *
 * Sin esto, unas credenciales inválidas (401 de identity) llegarían al usuario como un 500 de
 * auth-service: un problema de comunicación entre servicios disfrazado de falla del sistema.
 */
@Catch(ErrorIdentity)
export class ErrorIdentityFiltro implements ExceptionFilter {
  private readonly logger = new Logger(ErrorIdentityFiltro.name);

  catch(error: ErrorIdentity, host: ArgumentsHost): void {
    // Un 5xx sí es un problema nuestro y tiene que quedar en el log; un 4xx es el flujo normal.
    if (error.status >= 500) {
      this.logger.error(`identity-service respondió ${error.status}: ${error.message}`);
    }

    const res = host.switchToHttp().getResponse<Response>();
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    const mensaje = status === 502 ? 'El servicio de identidad no está disponible' : error.message;

    res.status(status).json({ mensaje });
  }
}
