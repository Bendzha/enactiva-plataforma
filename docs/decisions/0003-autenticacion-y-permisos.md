# ADR-0003: Autenticación, permisos y scoping por empresa

## Status
Aceptada

## Date
2026-09-15

## Context
Auth propio con JWT + bcrypt en NestJS ya está decidido (`arquitectura-tecnica.md` §1.5). Faltan los detalles: 4 roles combinables, dos niveles de Admin ENACTIVA (Principal y Operativo) cuyos permisos la clienta quiere diferenciar, y el riesgo de que una empresa vea datos de otra, que es el bug más grave de este dominio.

## Decision

### Autenticación
- **Access token** JWT de vida corta (15 min), en memoria del frontend.
- **Refresh token** opaco, rotado en cada uso, guardado con hash en `TokenAcceso`, entregado en cookie `httpOnly; Secure; SameSite=Lax`.
- Frontend y API bajo el **mismo dominio de ENACTIVA** (ej. `app.<dominio>` y `api.<dominio>`) para que la cookie sea same-site; los navegadores bloquean cada vez más las cookies entre dominios distintos (`vercel.app` ↔ `railway.app`).
- bcrypt con costo 12. Limitación de intentos de login con `@nestjs/throttler`. `LOGIN` y `LOGIN_FALLIDO` se auditan.
- Tokens de invitación y reseteo: 32 bytes aleatorios, guardados con hash SHA-256, de un solo uso, con expiración (7 días para invitación **[S]**).

### Autorización basada en permisos
Los roles se traducen a permisos con un **mapa estático en código**; los endpoints piden permisos, no roles:
```ts
@RequierePermiso('empresas:crear')
```
Mapa inicial (se amplía slice a slice):

| Permiso | Admin Principal | Admin Operativo | RRHH | Capacitador | Estudiante |
|---|---|---|---|---|---|
| `empresas:listar` | ✓ | ✓ | | | |
| `empresas:crear` | ✓ | ✓ | | | |
| `empresas:activar` | ✓ | | | | |
| `invitaciones:gestionar` | ✓ | ✓ | | | |
| `metricas-globales:ver` | ✓ | | | | |
| `admins:gestionar` | ✓ | | | | |

Si Karina quiere restringir o ampliar lo que ve el Operativo, se cambia una línea del mapa y su test; no hay migración.

### Scoping por empresa
- Un contexto por request (AsyncLocalStorage vía `nestjs-cls`) guarda `{ usuarioId, roles, nivelAdmin, empresaId }`.
- Una **extensión de Prisma Client** agrega `where: { empresaId }` a las consultas de modelos de negocio cuando el usuario no es Admin ENACTIVA.
- **Test e2e obligatorio** por endpoint: un usuario de la empresa A intenta leer o escribir datos de la empresa B y recibe 404.

## Alternatives Considered
- **Auth0 / Clerk:** descartado en `arquitectura-tecnica.md`.
- **Chequeo por rol directo (`@Roles('ADMIN')`):** no distingue Principal de Operativo sin ensuciar cada endpoint. Rechazado.
- **Permisos en base de datos editables desde UI:** nadie lo pidió y agrega pantallas y riesgos. Rechazado; reevaluable si ENACTIVA necesita perfiles a medida.
- **Row Level Security de Postgres:** defensa en profundidad real, pero complica Prisma (variables de sesión por transacción). Se pospone como endurecimiento del MVP 3.
- **Filtrar `empresaId` a mano en cada service:** un olvido = fuga de datos. Rechazado.

## Consequences
- Todo endpoint nuevo declara su permiso; un endpoint sin decorador se rechaza por defecto (guard global).
- El despliegue requiere configurar subdominios en el DNS de ENACTIVA.
