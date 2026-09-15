# ADR-0001: Monorepo con pnpm workspaces

## Status
Aceptada

## Date
2026-09-15

## Context
El stack ya está decidido en `docs/arquitectura-tecnica.md` (React + Vite, NestJS, PostgreSQL + Prisma). Falta decidir cómo se organiza el código. El equipo trabaja en **vertical slices**: cada funcionalidad toca base de datos, API y UI a la vez, y debe poder mostrarse a la clienta cada dos semanas. Son 4–5 personas y un solo pipeline de CI.

## Decision
Un único repositorio con **pnpm workspaces**:
```
apps/api          NestJS + Prisma
apps/web          React + Vite
packages/shared   Zod schemas, tipos y enums compartidos
```
Node 24 LTS fijado en `.nvmrc` y `engines`; pnpm habilitado con corepack. Sin Nx ni Turborepo.
El cálculo de logro vive **solo en `apps/api`** (fuente autoritativa), no en `shared`.

## Alternatives Considered
- **Repos separados (frontend / backend):** cada slice obliga a dos PRs coordinados y los tipos de la API se desincronizan. Rechazado.
- **Nx / Turborepo:** caché de builds y orquestación de tareas que no se necesitan con dos apps; otra herramienta que aprender. Rechazado; reevaluable si el CI se vuelve lento.
- **npm workspaces:** funciona, pero pnpm es más estricto con dependencias no declaradas y más rápido en CI. Diferencia menor.

## Consequences
- Un slice = un PR que cambia `schema.prisma`, API, esquema Zod y UI juntos.
- Vercel se configura con root `apps/web`; Railway/Render con root `apps/api`.
- Todo el equipo debe usar pnpm (no npm) para no romper el lockfile.
