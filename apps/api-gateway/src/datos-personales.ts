import { Controller, Delete, Get, Req, Res } from '@nestjs/common';
import {
  PREFIJO_INTERNO,
  type DatosDeServicio,
  type ExportacionDatos,
  type ResultadoSupresion,
  type SupresionDeServicio,
} from '@enactiva/shared';
import { CABECERA_REQUEST_ID, CLS_REQUEST_ID } from '@enactiva/service-kit';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { env } from './config/env.js';

/**
 * Exportación y supresión de los datos de una persona (Ley 21.719, SPEC §3.7, ADR-0007).
 *
 * Es lo único que el gateway **compone** en vez de reenviar, y la razón es que no hay nadie más
 * que pueda: los datos de una persona están repartidos en tres bases que no se ven entre sí, y
 * que identity llamara a learning y a matching crearía una dependencia al revés de todas las
 * demás.
 *
 * El gateway sigue sin validar el JWT: reenvía el mismo `Authorization` a cada servicio y cada
 * uno lo verifica. Si el token no sirve, los tres responden 401 y eso es lo que se devuelve.
 */

interface Servicio {
  nombre: string;
  url: string;
}

const SERVICIOS = (): Servicio[] => [
  { nombre: 'identity-service', url: env().URL_IDENTITY_SERVICE },
  { nombre: 'learning-service', url: env().URL_LEARNING_SERVICE },
  { nombre: 'matching-service', url: env().URL_MATCHING_SERVICE },
];

const AVISO =
  'Esto es todo lo que la plataforma guarda sobre ti, servicio por servicio. ' +
  'No incluye el registro de auditoría: es append-only por ley y no guarda tu nombre ni tu correo, ' +
  'solo qué acción ocurrió y cuándo.';

@Controller('datos')
export class DatosPersonalesController {
  constructor(private readonly cls: ClsService) {}

  /**
   * Junta lo que guarda cada servicio y lo entrega como un archivo.
   *
   * Aquí no hay guard porque el gateway no valida tokens (ADR-0007): reenvía el que venga y
   * cada servicio lo verifica. Sin uno bueno, los tres responden 401 y no queda nada que juntar.
   */
  @Get('exportar')
  async exportar(@Req() req: Request, @Res() res: Response): Promise<void> {
    const partes = await this.preguntarATodos<DatosDeServicio>(req, 'GET');
    if ('error' in partes) {
      res.status(partes.error.status).json({ mensaje: partes.error.mensaje });
      return;
    }

    const exportacion: ExportacionDatos = {
      generadoAt: new Date().toISOString(),
      usuarioId: this.usuarioDe(partes.respuestas),
      aviso: AVISO,
      servicios: partes.respuestas,
    };

    // Se entrega como descarga y no como JSON en pantalla: quien pide sus datos quiere el
    // archivo, no mirarlo en el navegador.
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-enactiva.json"');
    res.status(200).send(JSON.stringify(exportacion, null, 2));
  }

  /**
   * Borra o anonimiza en los tres servicios.
   *
   * **El orden importa**: identity va al final. Apenas anonimiza la cuenta, la sesión deja de
   * ser válida, y cualquier llamada posterior respondería 401 dejando datos a medio borrar.
   */
  @Delete('suprimir')
  async suprimir(@Req() req: Request, @Res() res: Response): Promise<void> {
    const partes = await this.preguntarATodos<SupresionDeServicio>(req, 'DELETE', (servicios) => [
      ...servicios.filter((servicio) => servicio.nombre !== 'identity-service'),
      ...servicios.filter((servicio) => servicio.nombre === 'identity-service'),
    ]);

    if ('error' in partes) {
      res.status(partes.error.status).json({ mensaje: partes.error.mensaje });
      return;
    }

    const resultado: ResultadoSupresion = {
      suprimidoAt: new Date().toISOString(),
      usuarioId: '',
      servicios: partes.respuestas,
    };
    res.status(200).json(resultado);
  }

  /**
   * Llama a los tres, **uno después de otro**. En la supresión el orden es obligatorio, y en la
   * exportación la diferencia de tiempo no justifica tener dos caminos distintos.
   */
  private async preguntarATodos<T>(
    req: Request,
    metodo: 'GET' | 'DELETE',
    ordenar: (servicios: Servicio[]) => Servicio[] = (servicios) => servicios,
  ): Promise<{ respuestas: T[] } | { error: { status: number; mensaje: string } }> {
    const cabeceras: Record<string, string> = {};
    if (req.headers.authorization) cabeceras.Authorization = req.headers.authorization;
    const requestId = this.cls.get<string | undefined>(CLS_REQUEST_ID);
    if (requestId) cabeceras[CABECERA_REQUEST_ID] = requestId;

    const respuestas: T[] = [];

    for (const servicio of ordenar(SERVICIOS())) {
      let res: Response_;
      try {
        res = await fetch(`${servicio.url}/${PREFIJO_INTERNO}/datos-personales`, {
          method: metodo,
          headers: cabeceras,
        });
      } catch {
        return {
          error: { status: 502, mensaje: `${servicio.nombre} no está disponible` },
        };
      }

      if (!res.ok) {
        // Nest responde `message` y el proxy del gateway `mensaje`. Se leen los dos para que la
        // explicación del servicio llegue entera a la pantalla, en vez de un "respondió 403".
        const cuerpo = (await res.json().catch(() => null)) as {
          mensaje?: string;
          message?: string;
        } | null;
        return {
          error: {
            status: res.status >= 400 && res.status < 500 ? res.status : 502,
            mensaje:
              cuerpo?.mensaje ?? cuerpo?.message ?? `${servicio.nombre} respondió ${res.status}`,
          },
        };
      }

      respuestas.push((await res.json()) as T);
    }

    return { respuestas };
  }

  /** El id sale de lo que devolvió identity, que es el dueño de la cuenta. */
  private usuarioDe(respuestas: DatosDeServicio[]): string {
    const cuenta = respuestas.find((parte) => parte.servicio === 'identity-service')?.contenido
      .cuenta as { id?: string }[] | undefined;
    return cuenta?.[0]?.id ?? '';
  }
}

/** Alias para no confundir la respuesta de fetch con la de Express. */
type Response_ = globalThis.Response;
