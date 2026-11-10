# Plan de implementación — Slices 0, 1 y 2

**Referencias:** `docs/specs/SPEC.md`, `docs/decisions/0001`–`0004`.
**Regla:** cada tarea deja el proyecto compilando y con tests en verde; una tarea ≈ un commit.

## Estado (actualizado 2026-11-10)
- ✅ **Slice 0 completo** (T0.1 a T0.10, PR #1 a #10).
- ✅ **Slice 1 completo**: T1.2 a T1.10 mergeadas (PR #11 y #12).
- ✅ **Slice 2 completo**: T2.1 a T2.5 mergeadas (PR #13).
- ✅ **Slice 3 completo** (MVP 1): T3.1 a T3.5 mergeadas (PR #15).
- ✅ **Migración a microservicios** (ADR-0007): fases **M0, M1 y M2 listas**. El monolito ya no existe y la web corre sobre el gateway.
- ✅ **Slice 4 completo** (T4.1 a T4.5): catálogo de temas y perfil corporativo en `identity-service`.
- ✅ **Métricas de intereses** (compromiso del acta): el panel de RRHH y el global de ENACTIVA ya muestran perfiles completos, oferta, demanda y brechas.
- ✅ **Slice 5 completo** (T5.1 a T5.5): talleres convocados, inscripciones y disponibilidad, ya en `learning-service`.
- ✅ **Slice 6 completo** (T6.1 a T6.6): el mazo del swipe, el score de afinidad y las decisiones, en `matching-service`.
- ✅ **Slice 7 completo** (T7.1 a T7.3): la agenda de cada persona y los recordatorios por correo.
- ✅ **Exportación y supresión de datos por usuario** (Ley 21.719, criterio 7 de SPEC §10): cada persona se lleva sus datos y borra su cuenta desde «Mi perfil», orquestado en el gateway.
- ✅ **Slice 8 completo** (T8.1 a T8.7): estrellas, referencias firmadas, tokens, puntuación del match y el cuarto criterio del score.
- ✅ **Correcciones de la reunión del 2026-10-29** (PR #35, mergeado): login «ENACTIVA Match», recuperar contraseña, lista de asistencia, tokens nuevos, tokens privados, temas solo de RRHH y los roles renombrados en pantalla. Detalle más abajo.
- ⏭️ **Siguiente, por orden:** el **Slice 10** (solicitudes a RRHH) y el **Slice 11** (personalización por empresa), que es lo que la clienta pidió el 29 y todavía no existe. Después la **fase M4** (pipeline de CI por servicio y README de despliegue).
- 🟠 **El 2026-10-29 la clienta corrigió sobre el sistema funcionando** (`docs/reuniones/2026-10-29-reunion-karina.md`). No cambia la forma del producto: ajusta reglas y pantallas. Lo que trajo trabajo nuevo son las **solicitudes a RRHH** y la **personalización por empresa** (ADR-0011), que **revierte** una decisión del equipo que estaba en «Fuera de alcance».
- ⚠️ **El criterio 5 de SPEC §10 es el único de los siete sin cumplir**: el dashboard de RRHH con las puntuaciones de los matches, exportado a PDF y Excel. Se escribió antes del ADR-0010 y hay que confirmar con qué contenido sigue en pie (Q22). Importa para la defensa.
- 🔴 **El 2026-09-29 la clienta cambió el alcance** (ADR-0008): la plataforma no aloja clases. Cae la subida de contenidos; aparecen la ficha del taller, el cupo, la ubicación, la disponibilidad, la agenda y los recordatorios.
- 🎮 **Segundo eje del producto** (WhatsApp de la clienta, 2026-09-29, ADR-0009): valoración del encuentro con estrellas, referencias públicas y tokens de reconocimiento. "Match corporativo + gamificación corporativa". Es el Slice 8.
- 🟢 **El 2026-10-13 la clienta cerró el alcance** (ADR-0010): se elimina el modelo de evaluación —etapas, rúbrica, logro, delta, mediciones y tests—. *"Lo mejor es que sea sólo conectar y convocar"*. Cae el Slice 9 completo.
- ✅ También quedó cerrado: el producto se llama **ENACTIVA**, el código mantiene `curso` y `capacitador`, el match lo puntúan ambas partes, las 4 estrellas son fijas, las referencias se moderan y los tokens solo se cuentan.
- ❓ **Lo que sigue abierto no frena construir**: el aviso de privacidad (Q3, bloquea **publicar**), el dominio (Q1), el enlace con la web y HostNet (Q13), el modelo comercial (Q14), los talleres de varias sesiones (Q20), si los T&C son otro documento (Q21), el dashboard exportable (Q22) y cuánto dura «mantener sesión iniciada» (Q23).
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
Pipeline por servicio (matriz) y README de despliegue. La exportación y supresión de datos por usuario ya está hecha (ver "Ley 21.719" más abajo).

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

## Slice 4 — Qué quiere enseñar y aprender cada quien ✅
**Demo:** una persona completa su perfil corporativo y declara qué puede enseñar y qué quiere aprender.
**Sin cambios de fondo tras el acta**, salvo que el perfil se amplía con lo que pidió la clienta.

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| T4.1 | Migración: `Tema`, `PerfilInteres` y `PerfilCorporativo` + enums `Dimension`, `TipoInteres`, `NivelDominio` | temas únicos por empresa (nombre normalizado) | ✅ |
| T4.2 | API de temas: buscar antes de crear (Admin, RRHH y Capacitador) | no se crean duplicados tipo "Excel" / "excel avanzado" | ✅ |
| T4.3 | API de perfiles: declarar enseñar/aprender con dimensiones y nivel | una persona no puede declarar dos veces el mismo tema y tipo | ✅ |
| T4.4 | Perfil corporativo: habilidades, conocimientos, actitudes e intereses generales **[C, acta]** | se recogen datos corporativos, no personales (minimización) | ✅ |
| T4.5 | Web: "Mi perfil" con todas las secciones | — | ✅ |

Tres decisiones que solo aparecieron al construirlo:

- **La dimensión es de la declaración, no del tema.** Si "Excel avanzado" fuera *contenido* para siempre, el criterio "dimensiones coincidentes" del score (SPEC §3.6) no tendría nada que comparar: todos los pares del mismo tema coincidirían. Puesta en la declaración, una persona puede ofrecerlo como habilidad y otra buscarlo como actitud.
- **El equipo de ENACTIVA no tiene perfil corporativo**, porque no pertenece a ninguna empresa. Para crear un tema tiene que decir en cuál; el resto lo toma de su sesión y nunca del cuerpo de la petición (ADR-0007).
- **Las habilidades, conocimientos y actitudes que pidió la clienta no son campos nuevos**: son las declaraciones agrupadas por dimensión. Lo único en texto libre son los intereses generales, con un aviso en pantalla de que no se escriban datos personales.

## Métricas de intereses ✅ — compromiso del acta, no es un slice
**Demo:** RRHH ve qué quiere aprender su gente y qué nadie puede enseñar; el Admin Principal ve lo mismo empresa por empresa.
En la reunión del 2026-09-29 quedó dicho que las métricas de abajo del panel se encenderían cuando la gente registrara sus intereses. Con el Slice 4 ya hay datos.

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| MI.1 | `GET /metricas/intereses` para RRHH, acotado a su empresa | una empresa nunca ve números de otra | ✅ |
| MI.2 | `GET /metricas/globales` para el Admin Principal, empresa por empresa | RRHH recibe 403 | ✅ |
| MI.3 | Tarjeta "Qué quiere aprender tu gente" en Personas y tabla en Métricas globales | sin cifras de ejemplo cuando no hay datos | ✅ |

La métrica que importa son las **brechas**: temas que alguien quiere aprender y nadie de la empresa declaró que puede enseñar. Es lo que contesta dónde hay que traer formación de afuera, que es la pregunta de negocio de la clienta. Todo lo que sale de estos endpoints son agregados: nunca quién declaró qué.

## Slice 5 — Talleres convocados ✅
**Demo:** un facilitador publica la ficha de un taller con su fecha, su cupo y su lugar, y declara cuándo está disponible.
**Reescrito el 2026-09-29** (ADR-0008): ya no hay contenidos que subir.
**Desbloqueado el 2026-10-13** (ADR-0010): el taller es una actividad única, sin etapas. `Taller` no lleva estado de etapa; lo que decide si se puede entrar es la fecha y el cupo.

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| T5.1 | Migración: `Taller` (nombre, fecha, horario, cupo, objetivo, resultados esperados, ubicación) e `Inscripcion` | la ficha exige los campos que pidió la clienta | ✅ |
| T5.2 | Migración: `Disponibilidad` del facilitador | franjas horarias por persona | ✅ |
| T5.3 | API de talleres: publicar, listar los propios, editar mientras no haya empezado | el cupo no baja de las inscripciones ya hechas | ✅ |
| T5.4 | API de inscripción: respeta el cupo | al llenarse, el taller deja de aceptar gente | ✅ |
| T5.5 | Web: "Mis talleres" del facilitador y el formulario de la ficha | — | ✅ |
| ~~T5.x~~ | ~~Subida y descarga de archivos de contenido (ADR-0006)~~ | ⛔ **Eliminada**: la plataforma no aloja clases | — |

Lo que apareció al construirlo:

- **Primera llamada entre servicios del producto.** learning-service no conoce los temas: se los pregunta a identity por `/interno/temas?ids=`, con el token de quien pide. Así un tema de otra empresa no existe para él, sin que learning tenga que saber de empresas.
- **El cupo se decide en una transacción serializable.** Contar y crear son dos pasos; con dos personas entrando al último lugar al mismo tiempo, ambas verían cupo libre. Dentro de la transacción los filtros por empresa van escritos a mano, para que el aislamiento no dependa de la extensión de Prisma.
- **Falta el nombre de quien dicta.** La tarjeta muestra el tema, la fecha y el lugar, pero no quién enseña: eso es un dato personal que cruza servicios y se agrega en el Slice 6, donde la tarjeta del swipe lo necesita de verdad.

## Slice 6 — Matching tipo swipe ✅
**Demo:** una persona abre Descubrir, ve el taller que más le calza y al dar like queda inscrita.
Es **el corazón del producto** según el acta: "Activa facilitará matches corporativos entre colaboradores".

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| T6.1 | Migración: `Match` (estudiante, facilitador, taller, tema, score, decisión) | una persona no repite tarjeta ya decidida | ✅ |
| T6.2 | Score de afinidad con dimensiones, nivel, área y valoración, con pesos en constantes | función pura con 16 tests propios | ✅ |
| T6.3 | API del mazo: solo talleres de su empresa, futuros y con cupo | nunca aparecen talleres de otra empresa ni uno propio | ✅ |
| T6.4 | API de decisión: like inscribe de inmediato, descarte no vuelve a aparecer | el cupo lo sigue decidiendo learning | ✅ |
| T6.5 | Web: una tarjeta a la vez, con ♥ y ✕, filtro por tema y estado vacío | — | ✅ |
| T6.6 | Paso de migración de `matching-service` en `ci.yml` | la CI migra las tres bases, cada una en su paso | ✅ |

Lo que apareció al construirlo:

- **El mazo no es una consulta SQL.** Los talleres viven en `learning_db` y los perfiles en `identity_db`: matching pide las dos piezas con el token de quien mira y las junta. Es la primera pantalla del producto que necesita tres servicios para existir.
- **El filtro de qué está abierto vive en learning**, no en matching: las reglas de la fecha y del cupo son del servicio dueño del taller. matching ordena lo que recibe.
- **El like no reimplementa la inscripción**: llama al mismo endpoint que usa la pantalla de Talleres, con el token de la persona. Si el cupo se llenó entremedio, lo dice y no guarda la decisión, para que la tarjeta pueda volver si alguien cancela.
- **"Misma área suma" quedó como decisión del equipo.** Preguntada, la clienta respondió que las dos opciones le parecían bien; está marcado como `[E]` en la SPEC y son dos constantes.

## Slice 7 — Agenda y recordatorios ✅
**Demo:** el facilitador y los inscritos ven el taller en su agenda y reciben el recordatorio por correo.
**Slice nuevo**, pedido en el acta del 2026-09-29.

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| T7.1 | Agenda de la persona: lo que enseña y lo que va a aprender, ordenado por fecha | muestra lugar y horario | ✅ |
| T7.2 | Recordatorio por correo al facilitador y a los inscritos, 24 h y 1 h antes | no se manda dos veces; las ventanas no se solapan | ✅ |
| T7.3 | Web: pantalla de agenda, con lo que viene y el historial | — | ✅ |

Lo que apareció al construirlo:

- **Es lo primero del sistema que ocurre sin que nadie lo pida.** Hasta ahora todo pasaba porque alguien hacía clic. El reloj vive en `learning-service` y se mantiene tonto a propósito —despierta, pregunta qué falta, se duerme—: toda la decisión está en el servicio, que sí se puede probar sin esperar una hora.
- **Un reloj no tiene token de usuario.** Las llamadas entre servicios reenviaban la sesión de quien pedía; a las 9 de la mañana no hay nadie conectado. El reloj usa el secreto compartido, igual que las rutas anteriores al login, para pedirle a identity los correos de los inscritos.
- **El recordatorio dejó de pedir el nombre del tema.** Lo pedía por una ruta que exige sesión y fallaba. El taller ya tiene nombre propio: menos acoplamiento en lo único que corre desatendido.
- **Se anota aunque no salga ningún correo.** Si no, el reloj revisaría el mismo taller cada cinco minutos hasta que ocurriera.
- El corte entre "lo que viene" y "lo que pasó" es el **término** del taller: a las 10:30 de uno que va de 10 a 12, nadie quiere buscarlo en el historial.

## Ley 21.719 — Exportar mis datos y eliminar mi cuenta ✅
**Demo:** una persona descarga un archivo con todo lo que la plataforma guarda sobre ella, escribe
`ELIMINAR MI CUENTA` y su cuenta desaparece de las tres bases sin llevarse los talleres de nadie.
Es el **criterio 7** de SPEC §10 y lo que más probablemente se pregunte en la defensa.

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| TL.1 | Contratos en `shared` y `/interno/datos-personales` (GET y DELETE) en identity, learning y matching | el usuario sale del token verificado, nunca de la URL | ✅ |
| TL.2 | identity: exporta cuenta, roles, perfil, declaraciones y avisos; **anonimiza** en vez de borrar la fila | queda sin nombre, correo ni contraseña, con `estado = ANONIMIZADO`; el token deja de servir al instante | ✅ |
| TL.3 | learning: exporta lo que dicta, a lo que va y su disponibilidad; borra inscripciones y disponibilidad | los talleres que dictó **quedan**, porque otras personas se inscribieron en ellos | ✅ |
| TL.4 | matching: exporta y borra sus decisiones del mazo | lo que otros decidieron sobre sus talleres no es suyo y se queda | ✅ |
| TL.5 | Gateway: `GET /datos/exportar` y `DELETE /datos/suprimir` | identity va **al final**; si un servicio no responde no se borra nada | ✅ |
| TL.6 | Web: «Descargar mis datos» y «Eliminar mi cuenta» en Mi perfil, con la frase escrita a mano | al eliminar, cierra la sesión y vuelve al login | ✅ |

Lo que apareció al construirlo:

- **Anonimizar no es borrar, y la diferencia la decide de quién son los datos.** El id de la persona
  se queda porque de él cuelgan cosas de otros: el taller al que fueron diez personas, el área que
  creó, el registro de auditoría. Borrar la fila se llevaría datos ajenos por delante.
- **El orden de las llamadas es parte del requisito.** Apenas identity anonimiza la cuenta la sesión
  muere, así que va al final; si fuera primero, learning y matching responderían 401 y la persona
  quedaría a medio borrar. Que los tres contesten es la prueba de que el orden es el correcto.
- **El token seguía sirviendo 30 segundos** después de borrar la cuenta, lo que dura el caché de
  sesión (ADR-0007, D2). identity ahora lo invalida al suprimir. En los otros dos el caché vence
  solo, y para cuando lo haga ya no les queda nada de esa persona que mostrar.
- **El gateway no leía el mensaje de los servicios.** Nest responde `message` y el proxy del
  gateway `mensaje`; sin leer los dos, una cuenta de ENACTIVA que intentaba borrarse veía
  "identity-service respondió 403" en vez de la explicación.
- **El aviso de privacidad describía un producto que ya no existe** (mediciones, resultados
  individuales, "puedes pedir" por correo). Se reescribió el borrador y subió a `2026-10-borrador`.
  **Sigue siendo borrador y Karina tiene que aprobarlo** (Q3).

## Slice 8 — Valoración del encuentro y gamificación ✅
**Demo:** al terminar un taller, quien asistió lo valora con estrellas, deja su referencia y el facilitador recibe su token; después se le pregunta si el match funcionó. RRHH ve el agregado y puede ocultar una referencia.
**Slice nuevo**, pedido por la clienta por WhatsApp el 2026-09-29 (ADR-0009). Es el segundo eje del producto: "gamificación corporativa".

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| T8.1 | Migración: `ValoracionTaller` (estrellas por dimensión), `Referencia` y `Token` | se valora una sola vez por taller. Las 4 dimensiones van como **filas**, no como columnas. ~~La asistencia iba acá~~ → se movió a la lista de quien dicta (R29.4) | ✅ |
| T8.2 | Migración: puntuación del match (¿se reunieron?, ¿a la hora?, ¿como esperaban?, ¿repetirían?) | la contestan **ambas partes** tras la primera reunión; con una sola respuesta el match ya queda puntuado | ✅ |
| T8.3 | API de valoración: estrellas y referencia | la referencia se firma con el nombre de quien la escribe | ✅ |
| T8.4 | API de moderación para RRHH: ocultar una referencia, con auditoría | no se borra, se oculta, y el motivo queda guardado | ✅ |
| T8.5 | Tokens del facilitador: recuento por taller, auditado y no editable a mano | ~~uno por taller con al menos una valoración~~ → **reemplazado el 2026-10-29** por la regla de asistencia (R29.5). El canje lo administra la empresa fuera de la plataforma (Q18) | ✅ |
| T8.6 | El promedio del facilitador alimenta el score de afinidad | matching lo pide por REST a learning; cuenta **desde la tercera valoración** | ✅ |
| T8.7 | Web: valorar desde la agenda, y tarjeta de reconocimiento con estrellas, referencias y tokens | como el ejemplo que mandó la clienta | ✅ |

Lo que apareció al construirlo:

- **Valorar el taller y puntuar el match son dos pasos, no uno.** Las estrellas dicen si el taller
  estuvo bueno; las cuatro preguntas, si el emparejamiento funcionó. Un match puede fallar —nunca
  se reunieron— con un taller impecable, y al revés. En pantalla son dos pantallas seguidas, y la
  segunda solo aparece si hay un match: quien se inscribió desde Talleres no hizo match con nadie.
- **Un 403 también filtra información.** Al puntuar el match de otra persona, el servicio
  respondía 403 "no eres parte" en vez de 404. Esa diferencia le decía a cualquiera de la empresa
  que esas dos personas habían hecho match en ese taller, y lo que cada quien decide en Descubrir
  es suyo. La condición de ser parte se movió a la consulta.
- **Las estrellas no cuentan hasta la tercera valoración.** Era el riesgo que dejó anotado el
  ADR-0009: con una sola opinión mala, alguien perdía un cuarto de su score en Descubrir para
  siempre. El mecanismo ya existía —un criterio en `null` reparte su peso— y solo hubo que
  decidir el umbral. La pantalla lo dice: "falta una valoración más para que tus estrellas
  influyan".
- **El token es uno por taller y lo garantiza la base.** Una clave única sobre `taller_id` hace
  que tres personas valorando a la vez no puedan crear tres tokens. Era la forma más simple de
  cumplir "nadie lo edita a mano" ahora que el recuento vale algo fuera de la plataforma.
- **Las referencias entraron en la Ley 21.719.** Al suprimir una cuenta se van las que escribió
  **y** las que hablan de ella. Sus estrellas se quedan, porque son un agregado sobre un taller
  que otras personas vivieron y ya no apuntan a nadie.
- **~~Pendiente para Karina~~ → contestado el 2026-10-29:** el recuento de tokens se veía dentro de
  toda la empresa, que era la lectura abierta que el equipo tomó de su *"visibles pero privados"*.
  Ella cerró la otra: *«los tokens tienen que ser privados»*. Cada quien ve el suyo y RRHH el de su
  empresa.

**Sigue sin publicarse hasta el aviso de privacidad (Q3)**: este slice guarda texto libre de una
persona sobre otra identificada. El borrador de `2026-10-borrador` ya lo menciona, pero la clienta
tiene que aprobarlo.

## ~~Slice 9 — Rúbrica y mediciones~~ · ⛔ ELIMINADO el 2026-10-13

La clienta lo sacó del alcance (ADR-0010): *"los modelos chocan cuando hay mucho de capacitación
tradicional. Por lo tanto, lo mejor es que sea sólo conectar y convocar"*. Las estrellas del Slice 8
ocupan su lugar, pero miden **si el encuentro sirvió**, no cuánto aprendió alguien.

Con él caen la rúbrica, los indicadores, el umbral, el logro, el delta, las mediciones en tres
momentos y los tests por nivel. Era la mitad del trabajo que quedaba por hacer.

## Correcciones de la reunión del 2026-10-29 ✅ — PR #35
**Demo:** la clienta vio el sistema funcionando y corrigió sobre la pantalla. Esto es lo que salió.
Acta y citas textuales en [`docs/reuniones/2026-10-29-reunion-karina.md`](../docs/reuniones/2026-10-29-reunion-karina.md).

| # | Tarea | Criterio de aceptación | Estado |
|---|---|---|---|
| R29.1 | Login «ENACTIVA Match» con la estructura de su boceto y la paleta aprobada | «Entro como» decide la pantalla de partida y solo se respeta si esa cuenta puede usarla | ✅ |
| R29.2 | **Recuperar contraseña**: enlace de 2 h, de un solo uso, que cierra las demás sesiones | pedirlo responde 204 exista o no la cuenta | ✅ |
| R29.3 | Los temas los crea **solo RRHH**; quien enseña ve a quién pedírselo | `temas:crear` sale de `CAPACITADOR` | ✅ |
| R29.4 | **Lista de asistencia** que pasa quien dicta, con nombre y correo de sus inscritos | solo quien dicta la ve; a cualquier otro 404 | ✅ |
| R29.5 | **Tokens nuevos**: 2 / 3 según inscritos, +1 si van todos, 1 por asistir | una fila por (taller, persona, motivo); cerrar la lista paga una sola vez | ✅ |
| R29.6 | **Recuento de tokens privado**: cada quien el suyo, RRHH el de su empresa | pedir el de otro responde 403 | ✅ |
| R29.7 | Los roles se llaman **«Quien enseña»** y **«Quien aprende»** en pantalla | el código mantiene los enums (Q11) | ✅ |
| R29.8 | Fuera el «logro promedio» de las cuatro pantallas que lo reservaban | ningún resto del modelo de evaluación en pantalla | ✅ |

Lo que apareció al construirlo:

- **La asistencia tuvo que salir del formulario de valoración.** Quien aprendía la declaraba de sí
  mismo —era el ✅ del ejemplo de la clienta— y ahora la pasa quien dicta. Dos respuestas distintas
  a «¿fuiste?» dejarían el recuento de tokens en disputa justo cuando empezó a valer algo fuera de
  la plataforma.
- **Los tokens pasaron de ser un número a ser filas.** La regla vieja era una por taller; la nueva
  depende de cuánta gente se inscribió y cuánta fue, así que se guarda **una fila por (taller,
  persona, motivo)**. Así el recuento siempre se puede explicar, y corregir un error es borrar una
  fila en vez de editar un número.
- **`/interno/personas` es la primera ruta que saca correos de identity con el token de una
  persona.** Existe porque quien enseña necesita reconocer a su gente para pasar lista. Va acotada
  por empresa y learning solo la llama con los inscritos de ese taller.
- **Un taller sin inscritos no paga tokens**, aunque «menos de 5» lo incluiría literalmente.
- **Prisma no pudo generar la migración.** Pedía confirmación interactiva por el cambio de clave
  única y había una fila que la bloqueaba. Se escribió a mano, con un `DROP TABLE "token"`
  explícito, y se verificó aplicando las cinco migraciones sobre una base vacía, que es como las
  corre la CI.

---

## Slice 10 — Solicitudes a RRHH
**Demo:** quien enseña propone un taller que no está en el catálogo; RRHH lo ve en su bandeja, lo
aprueba y crea el taller. Y alguien que solo aprende pide pasar a enseñar, y RRHH le da el rol.
**Pedido por la clienta el 2026-10-29.** Reemplaza el texto «pídele a RRHH que lo agregue» que hoy
es el único camino, y que la clienta dio por mal hecho. Reglas en SPEC §2.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T10.1 | Migración en `identity_db`: `Solicitud` con tipo, estado, motivo del rechazo y quién resolvió, en `MODELOS_ACOTADOS` | una empresa nunca ve solicitudes de otra; la tabla queda auditada |
| T10.2 | API: crear una solicitud de **propuesta de taller o tema** | una solicitud es de **un** tipo; no se pueden pedir dos cosas en una |
| T10.3 | API: crear una solicitud de **cambio de rol** a «quien enseña» | quien ya tiene el rol no puede pedirlo; una pendiente a la vez por persona |
| T10.4 | API para RRHH: listar, **aprobar** y **rechazar con motivo o sin motivo** | aprobar **solo cambia el estado**: no crea el taller ni el tema ni asigna el rol por sí solo |
| T10.5 | Al aprobar un cambio de rol, RRHH le agrega el rol desde Personas | el rol nuevo corta la caché de sesión de esa persona |
| T10.6 | Web: pedir desde el diálogo de «quiero aprender / puedo enseñar», que hoy solo muestra un aviso | la persona ve en qué quedó su solicitud y el motivo si la rechazaron |
| T10.7 | Web: bandeja de solicitudes de RRHH, con el enlace para crear el taller aprobado | RRHH de una empresa nunca ve la bandeja de otra |

**A decidir al construirlo:** si una propuesta aprobada deja algún rastro que enlace con el taller
que RRHH crea después, o si se cierra sola. La clienta solo dijo que RRHH lo crea a mano.

## Slice 11 — Personalización por empresa
**Demo:** RRHH sube el logo de su empresa, elige sus colores y su gente entra a un entorno con su
marca. El login, ENACTIVA y las demás empresas no cambian.
**Pedido por la clienta el 2026-10-29.** **Revierte** una decisión del equipo que estaba en «Fuera
de alcance»: ver [ADR-0011](../docs/decisions/0011-personalizacion-por-empresa.md) y SPEC §3.8.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| T11.1 | Migración: la configuración visual de la empresa (logo y cuatro colores), nullable | sin configuración, la plantilla actual sigue siendo el valor por omisión |
| T11.2 | API para RRHH: leer y guardar la configuración de **su** empresa | RRHH de A no toca la de B; el color se valida como hexadecimal |
| T11.3 | Guardar el logo | es el primer archivo que sube alguien desde que el ADR-0008 eliminó los contenidos |
| T11.4 | Web: los colores entran como variables CSS al abrir la sesión | el login y las pantallas de ENACTIVA **no** se personalizan |
| T11.5 | Web: formulario con vista previa y aviso de contraste que **no bloquea** | la clienta dijo que el contraste lo ven ellos |
| T11.6 | Sacar los colores escritos a mano que queden en componentes | `accent-[#00347A]` en `AgregarInteres.tsx` es uno; con una empresa personalizada se notarían |

---

## Pendientes antes de publicar (no bloquean el desarrollo local)
- SPEC Q1: dominio de ENACTIVA y acceso a su DNS para correo real y subdominios `app.` / `api.`.
- SPEC Q3: el **texto real del aviso de privacidad**. Es el que de verdad bloquea: el Slice 8 ya
  guarda texto libre de una persona sobre otra identificada.
- SPEC Q21: si los **términos y condiciones** son otro documento que el aviso, y qué pasa con quien
  ya aceptó la versión anterior.
- SPEC Q22: con qué contenido sigue en pie el **dashboard exportable** del criterio 5 de §10.
- SPEC Q23: cuánto dura **«mantener sesión iniciada»**.
