import { GoneException, Injectable, Logger } from '@nestjs/common';
import { HORAS_PARA_RESTABLECER, type RestablecerPasswordInput } from '@enactiva/shared';
import { hashPassword } from '../../common/password.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CorreoService } from '../correo/correo.service.js';

/**
 * Recuperación de contraseña (reunión 2026-10-29).
 *
 * El enlace dura dos horas, se usa una sola vez y al usarlo **cierra todas las sesiones** de la
 * persona: si alguien le robó la cuenta, cambiar la contraseña tiene que sacarlo, y la única
 * forma de lograrlo es revocar los refresh que ya estaban circulando.
 *
 * Pedir el enlace responde siempre lo mismo, exista o no la cuenta. Un mensaje distinto para un
 * correo que existe convierte este formulario en una forma de averiguar quién trabaja dónde.
 */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  async solicitar(email: string, ip?: string | null): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, estado: true, empresaId: true },
    });

    // Una cuenta invitada sin activar no se "recupera": su enlace de invitación sigue vivo, y
    // mandarle otro distinto solo la confundiría.
    if (!usuario || usuario.estado !== 'ACTIVO') {
      this.logger.log('Se pidió recuperar una cuenta que no se puede recuperar');
      return;
    }

    const token = generarToken();
    const expiraAt = new Date(Date.now() + HORAS_PARA_RESTABLECER * 3_600_000);

    await this.prisma.$transaction(async (tx) => {
      // Pedir uno nuevo invalida el anterior: si no, cada solicitud dejaría otra puerta abierta.
      await tx.tokenAcceso.updateMany({
        where: { usuarioId: usuario.id, tipo: 'RESET_PASSWORD', usadoAt: null, revocadoAt: null },
        data: { revocadoAt: new Date() },
      });

      await tx.tokenAcceso.create({
        data: {
          usuarioId: usuario.id,
          tipo: 'RESET_PASSWORD',
          tokenHash: hashToken(token),
          expiraAt,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          accion: 'CREAR',
          entidad: 'TokenAcceso',
          entidadId: usuario.id,
          actorId: usuario.id,
          empresaId: usuario.empresaId,
          camposModificados: ['tipo', 'expiraAt'],
          ip: ip ?? null,
        },
      });
    });

    await this.correo.enviarRecuperacion({
      para: email,
      url: `${env().WEB_ORIGIN}/restablecer?token=${token}`,
      horasParaExpirar: HORAS_PARA_RESTABLECER,
    });
  }

  /**
   * Cambia la contraseña y cierra todo lo que estuviera abierto.
   *
   * No devuelve sesión a propósito: después de cambiarla, la persona entra como cualquier otro
   * día. Entregar una sesión aquí sería una segunda forma de iniciar sesión, con sus propias
   * reglas, y no hace falta.
   */
  async restablecer(datos: RestablecerPasswordInput, ip?: string | null): Promise<void> {
    const reseteo = await this.prisma.tokenAcceso.findUnique({
      where: { tokenHash: hashToken(datos.token) },
      include: { usuario: { select: { id: true, estado: true, empresaId: true } } },
    });

    // Mismo mensaje para inexistente, usado, revocado o vencido: no se confirma cuál era.
    if (
      !reseteo ||
      reseteo.tipo !== 'RESET_PASSWORD' ||
      reseteo.usadoAt ||
      reseteo.revocadoAt ||
      reseteo.expiraAt.getTime() <= Date.now() ||
      reseteo.usuario.estado !== 'ACTIVO'
    ) {
      throw new GoneException(
        'Este enlace ya no sirve. Pide uno nuevo desde «Olvidé mi contraseña».',
      );
    }

    const passwordHash = await hashPassword(datos.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: reseteo.usuario.id },
        data: { passwordHash },
      });

      await tx.tokenAcceso.update({ where: { id: reseteo.id }, data: { usadoAt: new Date() } });

      // Todas las sesiones abiertas se caen: es el punto de cambiar la contraseña.
      await tx.tokenAcceso.updateMany({
        where: { usuarioId: reseteo.usuario.id, tipo: 'REFRESH', revocadoAt: null },
        data: { revocadoAt: new Date() },
      });

      await tx.registroAuditoria.create({
        data: {
          accion: 'ACTUALIZAR',
          entidad: 'Usuario',
          entidadId: reseteo.usuario.id,
          actorId: reseteo.usuario.id,
          empresaId: reseteo.usuario.empresaId,
          camposModificados: ['passwordHash', 'sesiones'],
          ip: ip ?? null,
        },
      });
    });
  }
}
