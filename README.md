# enactiva-plataforma

[![CI](https://github.com/Bendzha/enactiva-plataforma/actions/workflows/ci.yml/badge.svg)](https://github.com/Bendzha/enactiva-plataforma/actions/workflows/ci.yml)

Plataforma de capacitación entre pares para el piloto de ENACTIVA SpA — proyecto Capstone PTY4614, Duoc UC.

- Qué se construye y con qué reglas: [`docs/specs/SPEC.md`](docs/specs/SPEC.md)
- Decisiones de arquitectura: [`docs/decisions/`](docs/decisions/)
- Orden de trabajo por slices: [`tasks/plan.md`](tasks/plan.md)

## Requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- pnpm 12, vía corepack: `corepack enable` (o `corepack pnpm <comando>` sin habilitarlo)
- Docker Desktop (Postgres y Mailpit locales, desde T0.2)

## Arquitectura

El sistema se está migrando de un monolito modular a microservicios ([ADR-0007](docs/decisions/0007-microservicios.md)). Durante la migración conviven las dos cosas.

| Proceso                 | Puerto | Base de datos | Estado                                                                                    |
| ----------------------- | ------ | ------------- | ----------------------------------------------------------------------------------------- |
| `apps/api` (monolito)   | 3000   | `plataforma`  | **Lo que se demuestra hoy.** Congelado: no recibe código nuevo. Se elimina al terminar M2 |
| `apps/api-gateway`      | 3010   | —             | Solo `/health`. Enruta por prefijo desde M2, y ahí toma el puerto 3000                    |
| `apps/auth-service`     | 3101   | —             | Emite y rota los JWT. Sin base de datos propia                                            |
| `apps/identity-service` | 3102   | `identity_db` | Empresas, áreas, personas, invitaciones, temas y correo                                   |
| `apps/learning-service` | 3103   | `learning_db` | Solo `/health`. Cursos, rúbricas y mediciones desde M3                                    |
| `apps/matching-service` | 3104   | `matching_db` | Solo `/health`. Matching desde M3                                                         |

## Servicios locales (Docker)

```bash
docker compose up -d --wait   # Postgres (localhost:5432) y Mailpit
docker compose ps             # estado de los servicios
docker compose down           # los detiene (los datos se conservan)
docker compose down -v        # los detiene y BORRA las bases de datos locales
```

- **Postgres 18:** un contenedor con una base por servicio (`plataforma`, `identity_db`, `learning_db`, `matching_db`) y un rol por servicio que solo puede conectarse a la suya. Las crea `docker/postgres/00-bases.sql`.
- **Mailpit:** captura los correos que envía la plataforma. Bandeja en http://localhost:8025. Ningún correo sale a internet.

> **Ojo:** Postgres ejecuta el script de inicialización **solo cuando el volumen está vacío**. Si cambia `docker/postgres/00-bases.sql`, o si vienes de una versión anterior del repositorio, hay que recrear el volumen con `docker compose down -v` y volver a aplicar migraciones y seed. Eso borra los datos locales.

## Configuración

Dos archivos, porque durante la migración conviven dos mundos:

```bash
cp .env.example .env                     # microservicios y gateway
cp apps/api/.env.example apps/api/.env   # monolito (mientras exista)
```

En el `.env` de la raíz hay que completar `JWT_ACCESS_SECRET` y `REFRESH_TOKEN_PEPPER`. Se generan con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

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
pnpm dev            # monolito + web, que es lo que hoy se puede demostrar
pnpm dev:servicios  # gateway y los cuatro microservicios
```

`@enactiva/shared` y `@enactiva/service-kit` se consumen compilados. `pnpm build`, `pnpm test` y `pnpm typecheck` los compilan antes que el resto. Si un comando falla porque no encuentra uno de los dos, ejecuta `pnpm build:paquetes`.

## Levantar la plataforma en local

```bash
docker compose up -d --wait        # bases de datos y Mailpit
pnpm --filter api dev              # API en http://localhost:3000
pnpm --filter web dev              # Web en http://localhost:5173
```

Para levantar los microservicios en paralelo:

```bash
pnpm --filter identity-service db:deploy   # solo la primera vez
pnpm --filter identity-service db:seed     # crea el Admin Principal en identity_db
pnpm dev:servicios
```

Desde M1 ya hacen el flujo completo, aunque la web todavía no los usa (eso es M2):

```bash
curl -X POST http://localhost:3101/auth/login -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'
```

Entra en http://localhost:5173 con el Admin Principal: el email y la contraseña están en tu `apps/api/.env` (`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`). Si aún no creaste la cuenta, corre `pnpm --filter api db:seed`.

## Estructura

```
apps/api               NestJS + Prisma — monolito, congelado (se elimina al terminar M2)
apps/api-gateway       único punto de entrada del frontend
apps/auth-service      emite y rota los JWT
apps/identity-service  empresas, personas, invitaciones, temas y correo
apps/learning-service  cursos, rúbricas y mediciones
apps/matching-service  motor de matching
apps/web               React + Vite
packages/shared        Zod, tipos, enums y permisos — lo usan el backend y el navegador
packages/service-kit   infraestructura común de los servicios (guard, acotado por empresa,
                       caché de sesión, contexto entre servicios) — no la importa el navegador
docker/postgres        script que crea una base y un rol por servicio
docs/                  especificación, ADRs y material de la clienta
tasks/                 plan de implementación
```

## Flujo de trabajo

Una rama por tarea (`slice-N/tN.M-descripcion`) y Pull Request hacia `main`. El CI debe estar en verde antes de mergear.

En cada Pull Request, GitHub Actions levanta Postgres, aplica las migraciones y corre lint, formato, tipos, tests y build — lo mismo que se corre en local:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```
