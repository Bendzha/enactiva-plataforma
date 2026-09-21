# Plan de implementación — Slices 0, 1 y 2

**Referencias:** `docs/specs/SPEC.md`, `docs/decisions/0001`–`0004`.
**Regla:** cada tarea deja el proyecto compilando y con tests en verde; una tarea ≈ un commit.

## Estado (actualizado 2026-09-21)
- ✅ **Slice 0 completo** (T0.1 a T0.10, PR #1 a #10).
- ✅ **Slice 1 completo**: T1.2 a T1.10 mergeadas (PR #11 y #12).
- ✅ **Slice 2 completo**: T2.1 a T2.5 mergeadas (PR #13).
- ⏭️ Siguiente: **MVP 1**, desglosado más abajo en los slices 3 a 7. Empieza por el Slice 3.
- 👀 La plataforma se abre en el navegador: ver "Levantar la plataforma en local" en el README.

**Para retomar en un PC:** abrir Docker Desktop → `docker compose up -d --wait` → `pnpm install` → copiar `apps/api/.env.example` a `apps/api/.env` si no existe → `pnpm --filter api db:migrate` → `pnpm --filter api db:seed` → `pnpm --filter api test`.

---

## Slice 0 — Base mínima segura
**Demo interna:** un Admin Principal inicia sesión y llega a una pantalla "Empresas" vacía. Un usuario sin permiso recibe 403.

| # | Tarea | Criterio de aceptación | Verificación |
|---|---|---|---|
| T0.1 | Esqueleto del monorepo: pnpm workspaces, `tsconfig.base`, ESLint/Prettier, `.nvmrc` (Node 24), `.gitignore`, `.env.example` | `pnpm install` y `pnpm lint` pasan | local |
| T0.2 | `docker-compose.yml` con Postgres y Mailpit | `docker compose up -d` levanta ambos | healthcheck |
| T0.3 | `apps/api` NestJS con `GET /health` y Vitest + Supertest (ADR-0005) | e2e de `/health` en verde | `pnpm --filter api test:e2e` |
| T0.4 | Prisma: migración inicial con `Empresa`, `Usuario`, `UsuarioRol`, `TokenAcceso`, `RegistroAuditoria` + seed de Admin Principal leído de variables de entorno | `migrate dev` y `db seed` corren limpios | test que consulta el admin sembrado |
| T0.5 | `packages/shared`: enums y esquema Zod de login | importable desde api y web | typecheck |
| T0.6 | Login: bcrypt, access JWT + refresh rotado en cookie, throttling, auditoría de `LOGIN` / `LOGIN_FALLIDO` | credencial válida → 200; inválida → 401 y registro de auditoría | e2e |
| T0.7 | Guard global JWT + `@RequierePermiso` + mapa de permisos + contexto por request | sin token 401; sin permiso 403; con permiso 200; endpoint sin decorador rechazado | e2e + unit del mapa |
| T0.8 | Extensión Prisma de scoping por empresa | usuario de empresa A no obtiene filas de B | e2e con dos empresas sembradas |
| T0.9 | `apps/web`: Vite + TS + Tailwind + shadcn/ui, tokens de color, TanStack Query, página de login, rutas protegidas por permiso | login lleva a "Empresas"; ruta sin permiso redirige | RTL + prueba manual en navegador |
| T0.10 | GitHub Actions: install, lint, typecheck, test (con servicio Postgres) | PR de prueba en verde | Actions |

## Slice 1 — Empresas de punta a punta (primera demo a la clienta)
**Demo:** Karina entra, ve las empresas con su estado, agrega una, el contacto RRHH recibe la invitación (visible en Mailpit en la demo local), ve la ficha y la activa a mano. Todo queda auditado.

| # | Tarea | Criterio de aceptación | Verificación |
|---|---|---|---|
| T1.1 | ~~Migración de `Empresa.activadaAt/activadaPorId` y `Usuario.nivelAdmin`~~ — adelantada a T0.4 (el seed del Admin Principal necesita `nivelAdmin`) | — | — |
| T1.2 | `GET /empresas`: nombre, rubro, estado, personas activas | Admin 200; RRHH/Capacitador/Estudiante 403 | e2e |
| T1.3 | `POST /empresas` {nombre, rubro, emailRrhh}: en una transacción crea Empresa (`ONBOARDING_PENDIENTE`) + Usuario RRHH (`INVITADO`) + token de invitación; audita `CREAR` | datos inválidos 400; email ya existente 409; éxito 201 | e2e |
| T1.4 | `MailerService` + plantilla de invitación; envío después del commit | correo llega a Mailpit con link de activación | e2e consultando la API de Mailpit |
| T1.5 | `POST /empresas/:id/invitacion/reenviar` | revoca token anterior, emite uno nuevo, envía correo | e2e |
| T1.6 | `PATCH /empresas/:id/activar` (manual) | solo Admin Principal (Operativo → 403); pasa a `ACTIVA`, guarda quién y cuándo, audita; activar dos veces → 409 | e2e |
| T1.7 | `GET /empresas/:id` (ficha) | datos de la empresa y estado de la invitación RRHH | e2e |
| T1.8 | Web: lista de empresas con badges de estado, KPIs reales (empresas, personas activas) y "Logro promedio: aún sin mediciones" | coincide con el mockup; ningún número inventado | RTL + navegador (desktop y móvil) |
| T1.9 | Web: modal "Agregar empresa", ficha lateral, botones Activar y Reenviar invitación | errores de validación visibles; la lista se actualiza sin recargar | RTL + navegador |
| T1.10 | Web: vista "Métricas" visible solo para Admin Principal | Operativo no ve la pestaña y la API le responde 403 | e2e + RTL |

## Slice 2 — Activación de cuentas y equipo ENACTIVA
**Demo:** el contacto RRHH abre el correo, acepta el aviso de privacidad, crea su contraseña y entra a su espacio (vacío). Karina invita a un Admin Operativo.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T2.1 | Migración `AceptacionAviso` | migración limpia |
| T2.2 | `POST /invitaciones/aceptar` {token, nombre, apellido, password, aceptaAviso} | token expirado o usado → 410; sin aceptar aviso → 400; éxito → usuario `ACTIVO` + aceptación registrada |
| T2.3 | Web: página de activación con aviso de privacidad (texto borrador marcado como tal hasta que ENACTIVA lo apruebe, SPEC Q3) | flujo completo desde el link del correo |
| T2.4 | `POST /admins` y `PATCH /admins/:id/desactivar` (solo Admin Principal) | Operativo → 403 |
| T2.5 | Web: pantalla "Equipo ENACTIVA" en Ajustes (solo Principal) | lista, invitar y desactivar admins |

---

# MVP 1 — El núcleo del producto

Desglose propuesto (2026-09-21). Cada slice sigue siendo end-to-end: base de datos, API y pantalla.

## Slice 3 — Los colaboradores de la empresa
**Demo:** RRHH carga a su gente y ellos activan su cuenta con el mismo flujo del Slice 2.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T3.1 | Migración: `Area` + `Usuario.areaId`, registradas en `MODELOS_ACOTADOS` | RRHH solo ve áreas de su empresa |
| T3.2 | API de áreas (crear, listar, renombrar) para RRHH | nombre único por empresa |
| T3.3 | API para invitar colaboradores (uno a uno) con rol Estudiante y/o Capacitador | reutiliza el flujo de invitación del Slice 2 |
| T3.4 | Carga masiva por CSV con vista previa y reporte de errores por fila | ninguna fila válida se pierde por un error en otra |
| T3.5 | Web: pantalla "Personas" de RRHH (lista, invitar, reenviar, estado) | RRHH de una empresa nunca ve gente de otra |

## Slice 4 — Qué sabe enseñar cada quien
**Demo:** una persona declara qué quiere enseñar y qué quiere aprender.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T4.1 | Migración: `Tema` y `PerfilInteres` + enums `Dimension`, `TipoInteres`, `NivelDominio` | temas únicos por empresa (nombre normalizado) |
| T4.2 | API de temas: buscar antes de crear (Admin, RRHH y Capacitador) | no se crean duplicados tipo "Excel" / "excel avanzado" |
| T4.3 | API de perfiles: declarar enseñar/aprender con dimensiones y nivel | una persona no puede declarar dos veces el mismo tema y tipo |
| T4.4 | Web: "Mi perfil" con ambas secciones, como en el mockup | — |

## Slice 5 — Cursos con la estructura estándar
**Demo:** un capacitador crea un curso y carga su contenido.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T5.1 | Migración: `Curso`, `EtapaCurso`, `Inscripcion`, `MaterialClase` | las 3 etapas se crean siempre con el curso |
| T5.2 | API de cursos: crear, listar los propios, avanzar de etapa | no se salta ni se retrocede de etapa |
| T5.3 | Subida y descarga de archivos de contenido (ADR-0006) | tipos y tamaño validados; descarga solo para quien corresponde |
| T5.4 | Web: "Mis cursos" del capacitador y ficha con las 3 etapas | coincide con el mockup |

## Slice 6 — Matching tipo swipe
**Demo:** un estudiante busca un tema, ve tarjetas y al dar like queda inscrito.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T6.1 | Migración: `Match` (estudiante, capacitador, curso, tema, score, estado) | un estudiante no repite tarjeta ya decidida |
| T6.2 | Score de afinidad con dimensiones, nivel, área y valoración, con pesos en constantes | función pura con tests propios |
| T6.3 | API del mazo: solo cursos de su empresa en etapa Diagnóstico | nunca aparecen cursos de otra empresa ni uno propio |
| T6.4 | API de decisión: like inscribe de inmediato, descarte no vuelve a aparecer | inscripción idempotente |
| T6.5 | Web: tarjetas con ♥ y ✕ como en el mockup, más estado vacío | funciona en móvil |

## Slice 7 — Rúbrica y mediciones
**Demo:** el capacitador evalúa a su grupo en los 3 momentos y aparece el delta.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T7.1 | Migración: `Rubrica`, `Indicador`, `Medicion`, `PuntajeIndicador` | pesos enteros; umbral por rúbrica |
| T7.2 | API de rúbrica: crear y editar en borrador; se congela al abrir Diagnóstico | no se puede editar después; suma de pesos = 100 |
| T7.3 | Cálculo de logro por dimensión y total, y delta relativo entre momentos | función pura con tests, incluido diagnóstico = 0 |
| T7.4 | API de mediciones: registrar los 3 momentos por estudiante | no se cierra una medición incompleta |
| T7.5 | Web: rúbrica del curso y pantalla de evaluación | — |

**Preguntas abiertas que afectan a estos slices:** Q8 (límite de espacio por empresa), Q4 (número de tests) y Q5 (escala de la calificación al capacitador).

---

## Pendientes antes de publicar (no bloquean el desarrollo local)
- SPEC Q1: dominio de ENACTIVA y acceso a su DNS para correo real y subdominios `app.` / `api.`.
