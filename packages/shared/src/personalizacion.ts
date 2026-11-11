import { z } from 'zod';

/**
 * Personalización del entorno de cada empresa (SPEC §3.8, ADR-0011).
 *
 * Cada empresa pinta **su propio entorno** con su logo y sus colores. No alcanza al login —que es
 * anterior a la sesión, así que nadie sabe todavía de qué empresa es quien mira—, ni a las
 * pantallas de ENACTIVA, ni a las demás empresas.
 */
export const COLORES_PERSONALIZABLES = ['marca', 'acento', 'fondo', 'texto'] as const;
export type ColorPersonalizable = (typeof COLORES_PERSONALIZABLES)[number];

/** La plantilla actual. Quien no personaliza se queda con esto, y no es un estado incompleto. */
export const PALETA_POR_OMISION: Record<ColorPersonalizable, string> = {
  marca: '#00347A',
  acento: '#FFB627',
  fondo: '#F5F7FB',
  texto: '#16233A',
};

export const ETIQUETAS_COLOR: Record<ColorPersonalizable, string> = {
  marca: 'Color principal',
  acento: 'Acento',
  fondo: 'Fondo',
  texto: 'Texto',
};

export const DESCRIPCIONES_COLOR: Record<ColorPersonalizable, string> = {
  marca: 'Botones, pestaña activa y títulos destacados.',
  acento: 'Avisos y estados pendientes.',
  fondo: 'El fondo de todas las pantallas.',
  texto: 'El texto principal.',
};

/**
 * El logo viaja como data URI y se guarda así.
 *
 * Es la opción más simple que funciona para un piloto de 3–4 empresas con un logo cada una, y no
 * reabre el almacenamiento de archivos que el ADR-0008 eliminó. El tope deja holgura para un PNG
 * de buena calidad sin que la respuesta pese de más.
 */
export const LARGO_MAXIMO_LOGO = 120_000;
export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * SVG queda fuera a propósito: aunque un `<img>` no ejecuta sus scripts, es un formato que admite
 * código y no vale la pena discutirlo por un logo. PNG con fondo transparente hace lo mismo.
 */
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/** Un color hexadecimal de seis dígitos. Lo único que no se negocia: de aquí sale una variable CSS. */
export const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal, por ejemplo #00347A');

export const guardarPersonalizacionSchema = z.object({
  colores: z.object({
    marca: colorHexSchema,
    acento: colorHexSchema,
    fondo: colorHexSchema,
    texto: colorHexSchema,
  }),
  logo: z
    .string()
    .max(LARGO_MAXIMO_LOGO, 'El logo pesa demasiado: usa una imagen más liviana')
    .regex(LOGO_RE, 'El logo tiene que ser PNG, JPEG o WebP')
    .nullable()
    .default(null),
});
export type GuardarPersonalizacionInput = z.infer<typeof guardarPersonalizacionSchema>;

export interface Personalizacion {
  /** null cuando la empresa no personalizó: se usa la plantilla. */
  colores: Record<ColorPersonalizable, string> | null;
  logo: string | null;
  /** Para saludar en la pantalla de ajustes sin pedir la ficha completa. */
  empresaNombre: string;
}

// ── Contraste ────────────────────────────────────────────────────────────────

/**
 * El contraste **no se fuerza**: la clienta dijo que lo ven ellos (ADR-0011). Esto existe para
 * avisar antes de guardar, no para bloquear.
 */
export const CONTRASTE_MINIMO = 4.5;

function canalLineal(valor: number): number {
  const proporcion = valor / 255;
  return proporcion <= 0.03928 ? proporcion / 12.92 : ((proporcion + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa según WCAG 2.1. */
export function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = canalLineal((n >> 16) & 255);
  const g = canalLineal((n >> 8) & 255);
  const b = canalLineal(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(unColor: string, otroColor: string): number {
  const a = luminancia(unColor);
  const b = luminancia(otroColor);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Mezcla dos colores. `cuanto` es cuánto del segundo entra, de 0 a 1. */
function mezclar(unColor: string, otroColor: string, cuanto: number): string {
  const a = Number.parseInt(unColor.slice(1), 16);
  const b = Number.parseInt(otroColor.slice(1), 16);
  const canal = (desplazamiento: number) => {
    const uno = (a >> desplazamiento) & 255;
    const otro = (b >> desplazamiento) & 255;
    return Math.round(uno + (otro - uno) * cuanto);
  };
  const hex = (valor: number) => valor.toString(16).padStart(2, '0');
  return `#${hex(canal(16))}${hex(canal(8))}${hex(canal(0))}`;
}

/**
 * Los dos derivados del color principal.
 *
 * No se piden: pedir seis colores para que dos sean versiones del primero es trabajo del
 * formulario, no de la persona (ADR-0011).
 */
export function derivadosDeMarca(marca: string): { oscuro: string; suave: string } {
  return {
    oscuro: mezclar(marca, '#000000', 0.18),
    suave: mezclar(marca, '#FFFFFF', 0.91),
  };
}

/** Qué pares conviene revisar: son los que deciden si la pantalla se lee. */
export function avisosDeContraste(
  colores: Record<ColorPersonalizable, string>,
): { par: string; razon: number }[] {
  const pares: { par: string; colores: [string, string] }[] = [
    { par: 'Texto sobre el fondo', colores: [colores.texto, colores.fondo] },
    { par: 'Blanco sobre el color principal', colores: ['#FFFFFF', colores.marca] },
  ];

  return pares
    .map(({ par, colores: [uno, otro] }) => ({ par, razon: contraste(uno, otro) }))
    .filter(({ razon }) => razon < CONTRASTE_MINIMO);
}
