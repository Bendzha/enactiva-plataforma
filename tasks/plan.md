# Plan de implementación — Slices 0, 1 y 2

**Referencias:** `docs/specs/SPEC.md`, `docs/decisions/0001`–`0004`.
**Regla:** cada tarea deja el proyecto compilando y con tests en verde; una tarea ≈ un commit.

## Estado (actualizado 2026-09-29)
- ✅ **Slice 0 completo** (T0.1 a T0.10, PR #1 a #10).
- ✅ **Slice 1 completo**: T1.2 a T1.10 mergeadas (PR #11 y #12).
- ✅ **Slice 2 completo**: T2.1 a T2.5 mergeadas (PR #13).
- ✅ **Slice 3 completo** (MVP 1): T3.1 a T3.5 mergeadas (PR #15).
- ✅ **Migración a microservicios** (ADR-0007): fases **M0, M1 y M2 listas**. El monolito ya no existe y la web corre sobre el gateway.
- ⏭️ Siguiente: **Slice 4** dentro de `identity-service`. Es el único que se puede empezar sin esperar respuestas.
- 🔴 **El 2026-09-29 la clienta cambió el alcance** (ADR-0008): la plataforma no aloja clases. Cae la subida de contenidos; aparecen la ficha del taller, el cupo, la ubicación, la disponibilidad, la agenda y los recordatorios.
- 🎮 **Segundo eje del producto** (WhatsApp de la clienta, 2026-09-29, ADR-0009): valoración del encuentro con estrellas, referencias públicas y tokens de reconocimiento. "Match corporativo + gamificación corporativa". Es el Slice 8.
- ❓ **Preguntas que bloquean del Slice 5 en adelante**: Q9 (etapas), Q10 (rúbrica), Q11 (taller/facilitador) y Q15 a Q18 (valoración, referencias y tokens). Ver SPEC §11.
- 👀 La plataforma se abre en http://localhost:5173: ver "Levantar la plataforma en local" en el README.

**En un PC nuevo:** Docker Desktop → `docker compose up -d --wait` → `pnpm install` → copiar `.env.example` a `.env` y completar los secretos → `pnpm --filter identity-service db:deploy` → `pnpm --filter identity-service db:seed` → `pnpm test`.

---

# Migración a microservicios

Referencia: [`docs/decisions/0007-microservicios.md`](../docs/decisions/0007-microservicios.md).
**Regla:** cada fase termina con el sistema funcionando de punta a punta y `main` demostrable.
Ninguna fase empieza sin confirmación.

## Fase M0 — Estructura base ✅
**Resultado:** los cinco procesos arrancan y responden `/health`; el monolito sigue intacto en el puerto 3000.

| # | Tarea | Estado |
|---|---|---|
| M0.1 | ADR-0007 con el corte de datos, la caché de sesión y lo que se pierde | ✅ |
| M0.2 | `packages/service-kit`: guard global, acotado por empresa, caché de estado de sesión, `X-Request-Id`, contexto entre servicios y configuración | ✅ 46 tests |
| M0.3 | `auth-service`, `identity-service`, `learning-service`, `matching-service` y `api-gateway` como apps Nest independientes | ✅ 3 e2e cada una |
| M0.4 | Una base y un rol por servicio en Postgres, con `REVOKE CONNECT` sobre las demás | ✅ verificado |
| M0.5 | `schema.prisma` y `prisma.config.ts` por servicio, sin tablas todavía | ✅ |
| M0.6 | `.env` único en la raíz y CI que crea las bases nuevas | ✅ |

## Fase M1 — Mover lo ya construido (Slices 0 a 3) ✅
**Resultado:** el flujo completo (login → crear empresa → invitar → activar → cargar personas) funciona servido por auth-service e identity-service. El monolito sigue intacto y es lo que se demuestra hasta M2.

| # | Tarea | Estado |
|---|---|---|
| M1.1 | Migración inicial de `identity_db` con las tablas del monolito, incluido el trigger append-only de auditoría | ✅ |
| M1.2 | Módulos de empresas, invitaciones, personas, áreas, importación CSV, auditoría y correo en `identity-service` | ✅ |
| M1.3 | Endpoints internos de credenciales y estado de sesión, con secreto compartido | ✅ el hash y el pepper no salen de identity |
| M1.4 | Login, refresh, logout, activación de invitación y `/auth/yo` en `auth-service` | ✅ sin base de datos propia |
| M1.5 | Proveedor real de estado de sesión en los cuatro servicios, con la caché de 30 s | ✅ |
| M1.6 | Adaptador del acotado por empresa sobre el cliente Prisma de `identity-service` | ✅ test de acceso cruzado en verde |
| M1.7 | Migrar los tests del monolito | ✅ 69 en identity, 14 en auth |

**Dos regresiones encontradas y corregidas gracias a los tests portados:**

- Desactivar a un admin no cortaba su sesión al instante, porque la caché de 30 s seguía respondiendo. `AdminsService` ahora la invalida; fuera de identity el corte sigue tardando lo que quede de esa ventana, como dice el ADR.
- `POST /auth/refresh` sin cookie respondía 400 en vez de 401, porque auth mandaba una cadena vacía a identity y fallaba la validación. Ahora responde antes de llamar.

## Fase M2 — API Gateway ✅
**Resultado:** la plataforma funciona en el navegador sobre la arquitectura nueva. El monolito ya no existe.

| # | Tarea | Estado |
|---|---|---|
| M2.1 | Enrutamiento por prefijo (`/auth/*`, `/identity/*`, `/learning/*`, `/matching/*`) | ✅ reenvía cuerpo, cabeceras, cookies y `X-Request-Id` |
| M2.2 | `apps/web` apunta solo al gateway | ✅ verificado en el navegador |
| M2.3 | El gateway toma el puerto 3000 y se elimina `apps/api` | ✅ |

Dos cosas que solo aparecieron al armarlo:

- Express le quita el prefijo a la URL cuando se monta con `app.use(prefijo, ...)`, así que `/auth/login` llegaba a auth-service como `/login`. El gateway filtra por ruta en vez de montar.
- El gateway arranca **sin body parser**. Si Nest leyera el cuerpo primero, el stream llegaría consumido al servicio y cualquier POST se colgaría.

## Fase M3 — Seguir el desarrollo en los servicios
Slice 4 (temas y perfiles) → `identity-service`. Slices 5 y 7 (cursos, contenidos, rúbrica, mediciones) → `learning-service`. Slice 6 (matching) → `matching-service`.
A diseñar antes de empezar: el mazo del swipe deja de ser una consulta SQL y pasa a componerse con llamadas a identity y learning (ADR-0007).

## Fase M4 — CI/CD y cierre
Pipeline por servicio (matriz), README de despliegue, y la exportación y supresión de datos por usuario orquestada en el gateway (Ley 21.719, criterio 6 de SPEC §10).

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

## Slice 4 — Qué quiere enseñar y aprender cada quien
**Demo:** una persona completa su perfil corporativo y declara qué puede enseñar y qué quiere aprender.
**Sin cambios de fondo tras el acta**, salvo que el perfil se amplía con lo que pidió la clienta.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T4.1 | Migración: `Tema` y `PerfilInteres` + enums `Dimension`, `TipoInteres`, `NivelDominio` | temas únicos por empresa (nombre normalizado) |
| T4.2 | API de temas: buscar antes de crear (Admin, RRHH y Capacitador) | no se crean duplicados tipo "Excel" / "excel avanzado" |
| T4.3 | API de perfiles: declarar enseñar/aprender con dimensiones y nivel | una persona no puede declarar dos veces el mismo tema y tipo |
| T4.4 | Perfil corporativo: habilidades, conocimientos, actitudes e intereses generales **[C, acta]** | se recogen datos corporativos, no personales (minimización) |
| T4.5 | Web: "Mi perfil" con todas las secciones | — |

## Slice 5 — Talleres convocados
**Demo:** un facilitador publica la ficha de un taller con su fecha, su cupo y su lugar, y declara cuándo está disponible.
**Reescrito el 2026-09-29** (ADR-0008): ya no hay contenidos que subir.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T5.1 | Migración: `Taller` (nombre, fecha, horario, cupo, objetivo, resultados esperados, ubicación) e `Inscripcion` | la ficha exige los campos que pidió la clienta |
| T5.2 | Migración: `Disponibilidad` del facilitador | franjas horarias por persona |
| T5.3 | API de talleres: publicar, listar los propios, editar mientras no haya empezado | el cupo no baja de las inscripciones ya hechas |
| T5.4 | API de inscripción: respeta el cupo | al llenarse, el taller deja de aceptar gente |
| T5.5 | Web: "Mis talleres" del facilitador y el formulario de la ficha | — |
| ~~T5.x~~ | ~~Subida y descarga de archivos de contenido (ADR-0006)~~ | ⛔ **Eliminada**: la plataforma no aloja clases |

## Slice 6 — Matching tipo swipe
**Demo:** una persona busca un tema, ve tarjetas de talleres y al dar like queda inscrita.
Es **el corazón del producto** según el acta: "Activa facilitará matches corporativos entre colaboradores".

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T6.1 | Migración: `Match` (estudiante, facilitador, taller, tema, score, estado) | un estudiante no repite tarjeta ya decidida |
| T6.2 | Score de afinidad con dimensiones, nivel, área y valoración, con pesos en constantes | función pura con tests propios |
| T6.3 | API del mazo: solo talleres de su empresa, futuros y con cupo | nunca aparecen talleres de otra empresa ni uno propio |
| T6.4 | API de decisión: like inscribe de inmediato, descarte no vuelve a aparecer | inscripción idempotente; respeta el cupo |
| T6.5 | Web: tarjetas con ♥ y ✕ como en el mockup, más estado vacío | funciona en móvil |

## Slice 7 — Agenda y recordatorios
**Demo:** el facilitador y los inscritos ven el taller en su agenda y reciben el recordatorio por correo.
**Slice nuevo**, pedido en el acta del 2026-09-29.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T7.1 | Agenda de la persona: lo que enseña y lo que va a aprender, ordenado por fecha | muestra lugar y horario |
| T7.2 | Recordatorio por correo al facilitador y a los inscritos | reutiliza el correo del Slice 1 (ADR-0004) |
| T7.3 | Web: pantalla de agenda | funciona en móvil |

## Slice 8 — Valoración del encuentro y gamificación
**Demo:** al terminar un taller, quien asistió lo valora con estrellas, deja su referencia y el facilitador recibe sus tokens; RRHH ve en el dashboard si los matches funcionaron.
**Slice nuevo**, pedido por la clienta por WhatsApp el 2026-09-29 (ADR-0009). Es el segundo eje del producto: "gamificación corporativa".

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T8.1 | Migración: `ValoracionTaller` (estrellas por dimensión, asistencia), `Referencia` y `Token` | solo valora quien asistió, y una sola vez por taller |
| T8.2 | Migración: puntuación del match (¿se reunieron?, ¿a la hora?, ¿como esperaban?, ¿repetirían?) | depende de Q15 |
| T8.3 | API de valoración: estrellas, asistencia y referencia | la referencia se firma con el nombre de quien la escribe (ADR-0009) |
| T8.4 | API de moderación para RRHH: ocultar una referencia, con auditoría | no se borra, se oculta |
| T8.5 | Tokens del facilitador: contador por taller, sin valor canjeable | Q18 antes de ir más lejos |
| T8.6 | El promedio del facilitador alimenta el score de afinidad | matching lo pide por REST a learning |
| T8.7 | Web: pantalla de valoración y tarjeta de perfil con estrellas, referencias y tokens | como el ejemplo que mandó la clienta |

**Preguntas que lo bloquean:** Q15, Q16, Q17 y Q18.

## Slice 9 — Rúbrica y mediciones · ⏸️ EN ESPERA
**Bloqueado por Q10.** La clienta lo confirmó en detalle el 2026-09-15, pero el acta del 2026-09-29 no lo
menciona y describe un taller presencial único, donde medir en tres momentos no tiene un lugar evidente
donde ocurrir. **No empezar sin su respuesta.**

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T9.1 | Migración: `Rubrica`, `Indicador`, `Medicion`, `PuntajeIndicador` | pesos enteros; umbral por rúbrica |
| T9.2 | API de rúbrica: crear y editar en borrador; se congela al empezar | no se puede editar después; suma de pesos = 100 |
| T9.3 | Cálculo de logro por dimensión y total, y delta relativo entre momentos | función pura con tests, incluido diagnóstico = 0 |
| T9.4 | API de mediciones: registrar los momentos por estudiante | no se cierra una medición incompleta |
| T9.5 | Web: rúbrica del taller y pantalla de evaluación | — |

**Preguntas que bloquean lo que queda:** Q9 (¿sobreviven las tres etapas?), Q10 (¿sobrevive la
rúbrica?), Q11 (¿se renombra a taller/facilitador?) y Q15 a Q18 (valoración, referencias y tokens).
Q4 depende de Q10.

---

## Pendientes antes de publicar (no bloquean el desarrollo local)
- SPEC Q1: dominio de ENACTIVA y acceso a su DNS para correo real y subdominios `app.` / `api.`.
