import { z } from 'zod';

/** Largo mínimo de contraseña para cuentas nuevas y para el seed (ADR-0003). */
export const LARGO_MINIMO_PASSWORD = 12;

/**
 * El email se normaliza a minúsculas y sin espacios antes de validarlo:
 * la base guarda siempre la forma normalizada (ADR-0002).
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));

export const loginSchema = z.object({
  email: emailSchema,
  // En el login no se aplica la política de largo: solo se exige que venga algo.
  password: z.string().min(1, 'La contraseña es obligatoria'),
  /**
   * «Mantener sesión iniciada» (SPEC §3.9). **No alarga nada**: decide si la cookie de refresh
   * sobrevive al cierre del navegador o muere con él.
   *
   * Por omisión `false`, que es lo seguro. Importa por dónde se usa esto: en un turno de planta
   * el computador se comparte, y una sesión que sigue abierta para el turno siguiente es la
   * cuenta de otra persona.
   */
  mantenerSesion: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Política de contraseña para crear o cambiar una cuenta (activación de invitación, reseteo). */
export const passwordNuevoSchema = z
  .string()
  .min(
    LARGO_MINIMO_PASSWORD,
    `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
  );

/**
 * Recuperación de contraseña (reunión 2026-10-29).
 *
 * Dos pasos: se pide por correo y se restablece con el enlace. El enlace dura poco —menos que
 * una invitación— porque una invitación la espera quien la recibió y un reseteo lo puede haber
 * pedido otra persona desde su correo.
 */
export const HORAS_PARA_RESTABLECER = 2;

export const recuperarPasswordSchema = z.object({
  email: emailSchema,
});
export type RecuperarPasswordInput = z.infer<typeof recuperarPasswordSchema>;

export const restablecerPasswordSchema = z.object({
  token: z.string().min(20, 'El enlace para restablecer no es válido'),
  password: passwordNuevoSchema,
});
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;
