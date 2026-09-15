# ADR-0005: Vitest en lugar de Jest

## Status
Aceptada

## Date
2026-09-15

## Context
`docs/arquitectura-tecnica.md` definió Jest + Supertest para el backend y React Testing Library para el frontend. Al implementar T0.3 se verificó el ecosistema vigente:

- **NestJS 12** se publica como **ESM** (`"type": "module"` en `@nestjs/core` y `@nestjs/common`).
- La **plantilla oficial** `nestjs/typescript-starter` para Nest 12 usa **Vitest** y Supertest; ya no trae Jest.
- Jest ejecuta ESM solo en modo experimental (`--experimental-vm-modules`), y `ts-jest` declara soporte para `typescript <7` con configuración ESM adicional.
- El frontend usa Vite, donde Vitest es el runner natural y React Testing Library funciona igual.

## Decision
- **Vitest 4.1** como runner de tests en `apps/api` y, desde T0.9, en `apps/web`.
- **Supertest** se mantiene para los e2e de la API.
- **React Testing Library** se mantiene en el frontend, sobre Vitest.
- Se usa la misma versión mayor de Vitest que la plantilla oficial de Nest (4.x), no la 5.0 recién publicada.

## Alternatives Considered
- **Jest con `--experimental-vm-modules`:** modo experimental, mocks de ESM limitados y más configuración que mantener para 4–5 personas. Rechazado.
- **Compilar la API a CommonJS para seguir con Jest:** va contra el formato en que se publica Nest 12 y contra su plantilla oficial. Rechazado.
- **Vitest 5.0:** recién publicado; se reevalúa cuando Nest lo adopte.

## Consequences
- La API de tests es casi idéntica a Jest (`describe`, `it`, `expect`); los mocks usan `vi` en lugar de `jest`.
- La inyección de dependencias de Nest necesita metadata de decoradores al correr los tests. El e2e de `/health` inyecta un service por tipo y falla si esa metadata no se emite, así que la configuración queda verificada por un test.
- Actualiza `docs/specs/SPEC.md` §8 y `tasks/plan.md` (T0.3).
