import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { env } from '../../config/env.js';
import { RecordatoriosService } from './recordatorios.service.js';

/**
 * El reloj que dispara los recordatorios.
 *
 * El sistema no tenía nada que corriera solo: todo pasaba porque alguien hacía algo. Esto es lo
 * primero que ocurre sin que nadie lo pida, así que se mantiene lo más tonto posible —despierta,
 * pregunta qué falta, se vuelve a dormir— y toda la decisión vive en el servicio, que sí se
 * puede probar sin esperar una hora.
 *
 * Si el servicio está caído a la hora de un recordatorio, ese correo no sale: al volver, la
 * ventana ya pasó. Es el costo de no tener una cola, y para un piloto es aceptable.
 */
@Injectable()
export class RelojDeRecordatorios {
  private readonly logger = new Logger(RelojDeRecordatorios.name);
  private corriendo = false;

  constructor(private readonly recordatorios: RecordatoriosService) {}

  @Interval('recordatorios', env().RECORDATORIOS_CADA_MINUTOS * 60_000)
  async revisar(): Promise<void> {
    // Si una pasada se demora más que el intervalo, la siguiente no se encima: mandaría los
    // mismos correos dos veces antes de que la primera alcance a anotarlos.
    if (this.corriendo) return;

    this.corriendo = true;
    try {
      await this.recordatorios.enviarPendientes();
    } catch (error) {
      // Un fallo no puede matar el reloj: a los cinco minutos se vuelve a intentar.
      this.logger.error('Falló la revisión de recordatorios', error);
    } finally {
      this.corriendo = false;
    }
  }
}
