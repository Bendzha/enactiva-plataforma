import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Serializa para inspeccionar en los tests: los ids de auditoría son BigInt y JSON no los soporta. */
export function serializar(valor: unknown): string {
  return JSON.stringify(valor, (_clave, dato: unknown) =>
    typeof dato === 'bigint' ? dato.toString() : dato,
  );
}

/**
 * Token de acceso de una persona, firmado directamente.
 *
 * Los tests de este servicio no pasan por `POST /auth/login`, porque ese endpoint vive en
 * auth-service (ADR-0007). Firmar aquí con el mismo secreto prueba exactamente lo que interesa:
 * que el guard verifica la firma y resuelve roles, estado y empresa contra **esta** base.
 */
export async function tokenDe(app: INestApplication, email: string): Promise<string> {
  const prisma = app.get(PrismaService);
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { email: email.trim().toLowerCase() },
  });
  return app.get(JwtService).sign({ sub: usuario.id });
}

/** Igual que `tokenDe`, pero cuando el test ya tiene el id a mano. */
export function tokenDeId(app: INestApplication, usuarioId: string): string {
  return app.get(JwtService).sign({ sub: usuarioId });
}

/**
 * Desactiva el límite de peticiones por minuto. Se reemplaza el almacén y no el guard porque
 * el guard sigue corriendo: así los tests no dependen de cuántas peticiones haga cada uno.
 */
export const ALMACEN_SIN_LIMITE = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};
