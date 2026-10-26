import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface RecordatorioCorreo {
  para: string;
  nombre: string | null;
  tallerNombre: string;
  ubicacion: string;
  inicioAt: Date;
  /** Cambia el asunto y el tono: no es lo mismo avisar el día antes que una hora antes. */
  esInminente: boolean;
  /** Quien dicta el taller recibe el suyo con otro texto: a él le interesa cuánta gente va. */
  dicta: boolean;
  inscritos: number;
}

const FECHA = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Los correos de recordatorio de taller.
 *
 * learning manda los suyos en vez de pedirle a identity que los mande: convertir a identity en
 * un buzón que acepta HTML de otros servicios sería darle a cualquiera la firma de ENACTIVA.
 * Cada servicio escribe y manda lo suyo, por el mismo SMTP (ADR-0004).
 */
@Injectable()
export class CorreoRecordatorioService {
  private readonly logger = new Logger(CorreoRecordatorioService.name);
  private readonly transporte: Transporter;

  constructor() {
    const config = env();
    this.transporte = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      ...(config.SMTP_USER
        ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS ?? '' } }
        : {}),
    });
  }

  /**
   * Manda uno y devuelve si salió. Un correo que falla no puede voltear el envío de los demás:
   * si la dirección de una persona rebota, el resto del taller igual tiene que enterarse.
   */
  async enviar(datos: RecordatorioCorreo): Promise<boolean> {
    const cuando = FECHA.format(datos.inicioAt);
    const saludo = datos.nombre ? `Hola ${datos.nombre}` : 'Hola';

    const asunto = datos.esInminente
      ? `En una hora: ${datos.tallerNombre}`
      : `Mañana: ${datos.tallerNombre}`;

    const cuerpo = datos.dicta
      ? `Tu taller <strong>${escapar(datos.tallerNombre)}</strong> es ${cuando}, en ${escapar(datos.ubicacion)}. Van ${datos.inscritos} personas.`
      : `Te inscribiste en <strong>${escapar(datos.tallerNombre)}</strong>. Es ${cuando}, en ${escapar(datos.ubicacion)}.`;

    const texto = cuerpo.replace(/<[^>]+>/g, '');

    try {
      await this.transporte.sendMail({
        from: env().CORREO_DESDE,
        to: datos.para,
        subject: asunto,
        text: `${saludo}.\n\n${texto}\n\nNos vemos.\nENACTIVA`,
        html: `<p>${saludo}.</p><p>${cuerpo}</p><p>Nos vemos.<br>ENACTIVA</p>`,
      });
      return true;
    } catch (error) {
      this.logger.error(`No se pudo mandar el recordatorio a ${datos.para}`, error);
      return false;
    }
  }
}
