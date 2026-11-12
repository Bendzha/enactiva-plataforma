import { z } from 'zod';

/**
 * Los dos documentos que cada persona acepta (SPEC §3.7, Q21).
 *
 * Son dos y no uno porque contestan preguntas distintas: el aviso dice **qué se hace con tus
 * datos** y lo exige la Ley 21.719; los términos dicen **qué puedes y qué no puedes hacer** en la
 * plataforma, y existen porque hay referencias escritas sobre colegas y tokens que valen algo.
 *
 * Dos documentos piden **dos aceptaciones**: una sola casilla para ambos haría imposible
 * demostrar después qué aceptó cada persona, que es justo lo que un registro de aceptación tiene
 * que poder hacer.
 */
export const DOCUMENTOS_LEGALES = ['AVISO_PRIVACIDAD', 'TERMINOS'] as const;
export type DocumentoLegal = (typeof DOCUMENTOS_LEGALES)[number];

/**
 * Versión vigente de cada documento.
 *
 * **Al cambiar el texto hay que subir su versión**: de eso depende que a quien aceptó la anterior
 * se le vuelva a pedir. Los dos son BORRADORES del equipo y ENACTIVA tiene que aprobarlos antes
 * del piloto con datos reales (SPEC Q3).
 */
export const VERSIONES_LEGALES: Record<DocumentoLegal, string> = {
  // Sube de 2026-10 a 2026-11: le faltaba declarar las referencias públicas y los tokens, que
  // la SPEC §3.5 exige decir antes de que alguien escriba la primera.
  AVISO_PRIVACIDAD: '2026-11-borrador',
  TERMINOS: '2026-11-borrador',
};

export const ETIQUETAS_DOCUMENTO: Record<DocumentoLegal, string> = {
  AVISO_PRIVACIDAD: 'Aviso de privacidad',
  TERMINOS: 'Términos y condiciones',
};

/** Compatibilidad: el aviso se seguía nombrando así en la activación. */
export const AVISO_PRIVACIDAD_VERSION = VERSIONES_LEGALES.AVISO_PRIVACIDAD;

export interface AceptacionRegistrada {
  documento: DocumentoLegal;
  version: string;
  aceptadoAt: string;
}

/** Qué le falta aceptar a quien mira, y con qué versión. */
export interface EstadoAceptaciones {
  aceptadas: AceptacionRegistrada[];
  /** Documentos cuya versión vigente esta persona todavía no aceptó. */
  pendientes: DocumentoLegal[];
}

export const aceptarDocumentosSchema = z.object({
  documentos: z
    .array(z.enum(DOCUMENTOS_LEGALES))
    .min(1, 'No hay nada que aceptar')
    .refine((docs) => new Set(docs).size === docs.length, 'No repitas el mismo documento'),
});
export type AceptarDocumentosInput = z.infer<typeof aceptarDocumentosSchema>;

/**
 * Qué documentos le faltan a alguien, dadas sus aceptaciones.
 *
 * Función pura y compartida: la usan el servidor para decidir y la web para no dibujar una
 * pantalla que el servidor va a rechazar. Una sola definición de «pendiente» evita que las dos
 * mitades se contradigan.
 */
export function documentosPendientes(
  aceptadas: readonly { documento: DocumentoLegal; version: string }[],
): DocumentoLegal[] {
  return DOCUMENTOS_LEGALES.filter(
    (documento) =>
      !aceptadas.some(
        (a) => a.documento === documento && a.version === VERSIONES_LEGALES[documento],
      ),
  );
}
