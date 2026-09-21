# enactiva-plataforma

Plataforma de capacitación entre pares para el piloto de ENACTIVA SpA — proyecto Capstone PTY4614, Duoc UC.

- Qué se construye y con qué reglas: [`docs/specs/SPEC.md`](docs/specs/SPEC.md)
- Decisiones de arquitectura: [`docs/decisions/`](docs/decisions/)
- Orden de trabajo por slices: [`tasks/plan.md`](tasks/plan.md)

## Requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- pnpm 12, vía corepack: `corepack enable` (o `corepack pnpm <comando>` sin habilitarlo)
- Docker Desktop (Postgres y Mailpit locales, desde T0.2)

## Servicios locales (Docker)

```bash
docker compose up -d --wait   # Postgres (localhost:5432) y Mailpit
docker compose ps             # estado de los servicios
docker compose down           # los detiene (los datos se conservan)
docker compose down -v        # los detiene y BORRA la base de datos local
```

- **Postgres 18:** usuario `enactiva`, contraseña `enactiva`, base `plataforma` (solo desarrollo; ver `apps/api/.env.example`).
- **Mailpit:** captura los correos que envía la API. Bandeja en http://localhost:8025. Ningún correo sale a internet.

## Base de datos

```bash
cp apps/api/.env.example apps/api/.env   # completar SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
pnpm --filter api db:migrate             # aplica las migraciones pendientes
pnpm --filter api db:seed                # crea el Admin Principal (idempotente)
pnpm --filter api db:reset               # BORRA la base local y la recrea desde cero
```

El registro de auditoría es append-only: la base rechaza cualquier UPDATE o DELETE sobre él.

## Comandos

```bash
pnpm install        # instala dependencias de todo el monorepo
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm typecheck      # TypeScript en cada paquete
pnpm test           # tests de cada paquete
pnpm dev            # levanta api y web en paralelo (desde T0.3 / T0.9)
```

`@enactiva/shared` se consume compilado. `pnpm build`, `pnpm test` y `pnpm typecheck` lo compilan antes que el resto. Si un comando falla porque no encuentra `@enactiva/shared`, ejecuta `pnpm --filter @enactiva/shared build`.

## Estructura

```
apps/api          NestJS + Prisma
apps/web          React + Vite               (T0.9)
packages/shared   Zod, tipos y enums comunes — se compila a dist/ en cada `pnpm install`
docs/             especificación, ADRs y material de la clienta
tasks/            plan de implementación
```

## Flujo de trabajo

Una rama por tarea (`slice-N/tN.M-descripcion`) y Pull Request hacia `main`. El CI debe estar en verde antes de mergear.
