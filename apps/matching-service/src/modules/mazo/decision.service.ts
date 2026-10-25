import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DecisionMazo, ResultadoDecision, TarjetaMazo } from '@enactiva/shared';
import { ErrorServicioInterno, type SesionActual } from '@enactiva/service-kit';
import { ClientesInternos } from '../../clientes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { MazoService } from './mazo.service.js';

/**
 * Qué pasa cuando alguien decide una tarjeta (SPEC §3.6).
 *
 * El "me interesa" **inscribe de inmediato**, sin que el facilitador apruebe nada: lo confirmó
 * la clienta. El descarte solo se anota, para que esa tarjeta no vuelva a aparecer.
 */
@Injectable()
export class DecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesInternos,
    private readonly auditoria: AuditoriaService,
    private readonly mazo: MazoService,
  ) {}

  async decidir(
    tallerId: string,
    decision: DecisionMazo,
    sesion: SesionActual,
  ): Promise<ResultadoDecision> {
    const empresaId = this.empresaDe(sesion);

    // La tarjeta se vuelve a buscar en el mazo en vez de confiar en lo que mandó el navegador:
    // el score y el taller tienen que salir de los servicios dueños, no del cliente. Y como el
    // mazo ya esconde lo descartado, lo que no está ahí no se puede decidir.
    const tarjeta = await this.tarjeta(tallerId, sesion);

    if (decision === 'DESCARTADO') {
      await this.guardar(tarjeta, 'DESCARTADO', sesion, empresaId);
      return {
        decision,
        inscrito: false,
        mensaje: 'Listo, no te lo volvemos a mostrar.',
      };
    }

    const inscripcion = await this.inscribir(tallerId);
    if (!inscripcion.ok) {
      // Sin inscripción no se guarda la decisión: si mañana se libera un cupo, la tarjeta tiene
      // que poder volver a aparecer en vez de quedar enterrada por un intento que falló.
      return { decision, inscrito: false, mensaje: inscripcion.mensaje };
    }

    await this.guardar(tarjeta, 'INTERESADO', sesion, empresaId);
    return {
      decision,
      inscrito: true,
      mensaje: `Quedaste inscrito en "${tarjeta.nombre}".`,
    };
  }

  /**
   * Inscribe llamando a learning con el token de la persona: para ese servicio es exactamente
   * lo mismo que si se hubiera inscrito desde la pantalla de Talleres, con sus mismas reglas
   * de cupo y de fecha. matching no reimplementa ninguna.
   */
  private async inscribir(tallerId: string): Promise<{ ok: boolean; mensaje: string }> {
    try {
      await this.clientes.inscribir(tallerId);
      return { ok: true, mensaje: '' };
    } catch (error) {
      if (error instanceof ErrorServicioInterno && error.status >= 400 && error.status < 500) {
        // El cupo pudo llenarse entre que se armó el mazo y el like: eso no es un error del
        // sistema, es la realidad, y la persona merece saberlo en esas palabras.
        return { ok: false, mensaje: error.message };
      }
      throw error;
    }
  }

  private async tarjeta(tallerId: string, sesion: SesionActual): Promise<TarjetaMazo> {
    const tarjeta = (await this.mazo.paraMi(sesion)).find(
      (candidata) => candidata.tallerId === tallerId,
    );
    if (!tarjeta) {
      throw new NotFoundException('Ese taller ya no está disponible');
    }
    return tarjeta;
  }

  private async guardar(
    tarjeta: TarjetaMazo,
    decision: DecisionMazo,
    sesion: SesionActual,
    empresaId: string,
  ): Promise<void> {
    /**
     * Vale la última decisión.
     *
     * Alguien puede inscribirse desde el mazo, arrepentirse y cancelar desde Talleres: ahí el
     * taller vuelve a aparecerle, y si lo vuelve a tomar no puede chocar contra su propia
     * decisión anterior. El par (persona, taller) es único a propósito, así que se actualiza.
     */
    const match = await this.prisma.acotado.match.upsert({
      where: {
        estudianteId_tallerId: { estudianteId: sesion.usuarioId, tallerId: tarjeta.tallerId },
      },
      update: { decision, score: tarjeta.score, decididoAt: new Date() },
      create: {
        empresaId,
        estudianteId: sesion.usuarioId,
        capacitadorId: tarjeta.facilitador.id,
        tallerId: tarjeta.tallerId,
        temaId: tarjeta.temaId,
        score: tarjeta.score,
        decision,
      },
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'Match',
      entidadId: match.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['tallerId', 'decision', 'score'],
      ip: sesion.ip,
    });
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
