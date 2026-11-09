import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface InvitacionRrhh {
  para: string;
  nombreEmpresa: string;
  urlActivacion: string;
  diasParaExpirar: number;
}

export interface InvitacionAdmin {
  para: string;
  urlActivacion: string;
  diasParaExpirar: number;
}

/** Escapa el texto que entra en el HTML del correo (el nombre de la empresa lo escribe una persona). */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
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

  async enviarInvitacionRrhh(datos: InvitacionRrhh): Promise<void> {
    await this.enviarInvitacion({
      para: datos.para,
      asunto: `Activa tu cuenta en la plataforma de ENACTIVA (${datos.nombreEmpresa})`,
      intro: `Te invitaron a administrar la capacitación interna de <strong>${escapar(datos.nombreEmpresa)}</strong>.`,
      introTexto: `Te invitaron a administrar la capacitación interna de ${datos.nombreEmpresa}.`,
      urlActivacion: datos.urlActivacion,
      diasParaExpirar: datos.diasParaExpirar,
    });
  }

  async enviarInvitacionColaborador(datos: InvitacionRrhh): Promise<void> {
    await this.enviarInvitacion({
      para: datos.para,
      asunto: `Te sumaron a la capacitación interna de ${datos.nombreEmpresa}`,
      intro: `Te invitaron a participar en la capacitación interna de <strong>${escapar(datos.nombreEmpresa)}</strong>: podrás aprender de tus colegas y enseñar lo que sabes.`,
      introTexto: `Te invitaron a participar en la capacitación interna de ${datos.nombreEmpresa}: podrás aprender de tus colegas y enseñar lo que sabes.`,
      urlActivacion: datos.urlActivacion,
      diasParaExpirar: datos.diasParaExpirar,
    });
  }

  async enviarInvitacionAdmin(datos: InvitacionAdmin): Promise<void> {
    await this.enviarInvitacion({
      para: datos.para,
      asunto: 'Te invitaron al equipo de ENACTIVA en la plataforma',
      intro:
        'Te invitaron a administrar la plataforma junto al equipo de <strong>ENACTIVA</strong>.',
      introTexto: 'Te invitaron a administrar la plataforma junto al equipo de ENACTIVA.',
      urlActivacion: datos.urlActivacion,
      diasParaExpirar: datos.diasParaExpirar,
    });
  }

  /**
   * El enlace para volver a entrar. El correo dice qué hacer si **no** fue quien lo pidió:
   * recibirlo sin haberlo pedido es la señal de que alguien está intentando entrar.
   */
  async enviarRecuperacion(datos: {
    para: string;
    url: string;
    horasParaExpirar: number;
  }): Promise<void> {
    const url = escapar(datos.url);

    await this.transporte.sendMail({
      from: env().CORREO_DESDE,
      to: datos.para,
      subject: 'Vuelve a entrar a ENACTIVA Match',
      text: [
        'Pediste volver a entrar a ENACTIVA Match.',
        '',
        `Elige una contraseña nueva aquí: ${datos.url}`,
        `El enlace vence en ${datos.horasParaExpirar} horas y sirve una sola vez.`,
        '',
        'Si no fuiste tú, ignora este correo: tu contraseña no cambia hasta que alguien use el enlace.',
      ].join('\n'),
      html: `
        <p>Pediste volver a entrar a <strong>ENACTIVA Match</strong>.</p>
        <p><a href="${url}" style="background:#00347A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Elegir una contraseña nueva</a></p>
        <p style="color:#5b6880;font-size:13px">El enlace vence en ${datos.horasParaExpirar} horas y sirve una sola vez. Si no fuiste tú, ignora este correo: tu contraseña no cambia hasta que alguien use el enlace.</p>
      `,
    });

    this.logger.log(`Enlace de recuperación enviado a ${datos.para}`);
  }

  private async enviarInvitacion(datos: {
    para: string;
    asunto: string;
    intro: string;
    introTexto: string;
    urlActivacion: string;
    diasParaExpirar: number;
  }): Promise<void> {
    const url = escapar(datos.urlActivacion);

    await this.transporte.sendMail({
      from: env().CORREO_DESDE,
      to: datos.para,
      subject: datos.asunto,
      text: [
        datos.introTexto,
        '',
        `Activa tu cuenta aquí: ${datos.urlActivacion}`,
        `El enlace vence en ${datos.diasParaExpirar} días.`,
        '',
        'Si no esperabas este correo, puedes ignorarlo.',
      ].join('\n'),
      html: `
        <p>${datos.intro}</p>
        <p><a href="${url}" style="background:#00347A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Activar mi cuenta</a></p>
        <p style="color:#5b6880;font-size:13px">El enlace vence en ${datos.diasParaExpirar} días. Si no esperabas este correo, puedes ignorarlo.</p>
      `,
    });

    this.logger.log(`Invitación enviada a ${datos.para}`);
  }
}
