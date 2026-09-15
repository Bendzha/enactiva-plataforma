# enactiva-plataforma

Plataforma de capacitación entre pares para el piloto de ENACTIVA SpA — proyecto Capstone PTY4614, Duoc UC.

- Qué se construye y con qué reglas: [`docs/specs/SPEC.md`](docs/specs/SPEC.md)
- Decisiones de arquitectura: [`docs/decisions/`](docs/decisions/)
- Orden de trabajo por slices: [`tasks/plan.md`](tasks/plan.md)

## Requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- pnpm 12, vía corepack: `corepack enable` (o `corepack pnpm <comando>` sin habilitarlo)
- Docker Desktop (Postgres y Mailpit locales, desde T0.2)

## Comandos

```bash
pnpm install        # instala dependencias de todo el monorepo
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm typecheck      # TypeScript en cada paquete
pnpm test           # tests de cada paquete
pnpm dev            # levanta api y web en paralelo (desde T0.3 / T0.9)
```

## Estructura

```
apps/api          NestJS + Prisma            (T0.3)
apps/web          React + Vite               (T0.9)
packages/shared   Zod, tipos y enums comunes (T0.5)
docs/             especificación, ADRs y material de la clienta
tasks/            plan de implementación
```

## Flujo de trabajo

Una rama por tarea (`slice-N/tN.M-descripcion`) y Pull Request hacia `main`. El CI debe estar en verde antes de mergear.
