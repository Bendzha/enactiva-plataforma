# ADR-0007: De monolito modular a microservicios

## Status
Aceptada

## Date
2026-09-28

## Context
El equipo decidió dividir `apps/api` (monolito modular NestJS, ADR-0001) en cuatro microservicios más un API Gateway, dentro del mismo monorepo. La decisión es final y no se reabre en este ADR; lo que aquí se registra es **cómo** se corta el sistema y qué se pierde al cortarlo.

Estado al momento de decidir: Slices 0 a 3 construidos y mergeados (autenticación, empresas, invitaciones, activación de cuentas, equipo ENACTIVA, personas, áreas y carga masiva por CSV). Slices 4 a 7 pendientes (perfiles de interés, cursos, matching, rúbrica y mediciones). Suite de 132 tests en verde.

Tres problemas obligaban a decidir antes de crear una sola carpeta:

1. La transacción de alta de empresa (`POST /empresas`) escribe `Empresa`, `Usuario` con `passwordHash` y `TokenAcceso` de invitación en una sola transacción local. Repartir `Usuario` entre auth e identity la convertía en una escritura a dos bases, es decir, en un Saga — justo lo que el corte propuesto quería evitar.
2. El guard global relee roles, nivel y estado desde la base **en cada petición** (T2.4), para que quitarle el acceso a alguien surta efecto de inmediato y no en 15 minutos. Validar solo la firma del JWT en cada servicio reabría ese hoyo.
3. El registro de auditoría es una sola tabla append-only protegida por un trigger de Postgres, y la Ley 21.719 exige exportar y suprimir **todos** los datos de una persona. Con varias bases eso pasa a ser una operación distribuida.

## Decision

### Servicios
| Servicio | Responsabilidad | Base de datos |
|---|---|---|
| `api-gateway` | Único punto de entrada de la web. Enruta por prefijo (`/auth/*`, `/identity/*`, `/learning/*`, `/matching/*`), aplica CORS con cookies y genera el `X-Request-Id`. No valida JWT. | — |
| `auth-service` | Emite y rota los JWT. **No tiene base de datos propia.** | — |
| `identity-service` | Empresas, áreas, personas, invitaciones, perfiles de interés, catálogo de temas, correo saliente y credenciales. | `identity_db` |
| `learning-service` | Cursos, etapas, contenidos, rúbricas, mediciones, cálculo de logro y agregación para dashboards. | `learning_db` |
| `matching-service` | Motor de matching y decisiones del swipe. | `matching_db` |

### D1 — `Usuario`, `UsuarioRol` y `TokenAcceso` viven en `identity_db`
`auth-service` no tiene tablas. En el login llama una vez a `identity-service`, que compara el bcrypt y devuelve los claims; **el hash nunca sale de identity**. Con eso la transacción de alta de empresa sigue siendo local y no hace falta ningún Saga. `auth-service` sigue siendo el único que firma tokens.

Consecuencia aceptada: `auth-service` depende de `identity-service` **para iniciar sesión** (una llamada por login, no por petición). Si identity está caído, nadie entra; las sesiones ya emitidas siguen funcionando hasta que expiran.

"Olvidé mi contraseña" y todo el correo saliente quedan en `identity-service`, que es donde están `TokenAcceso` y los datos de la persona. El `REFRESH_TOKEN_PEPPER` vive solo en identity, porque ahí se calcula el hash del token.

### D2 — Caché de 30 segundos del estado de sesión
Cada servicio valida la firma del JWT localmente, pero **no confía en los roles ni el estado que vienen dentro del token**: los pide a `identity-service` y los cachea 30 segundos en memoria. Una desactivación surte efecto en ≤30 s en lugar de ≤15 min, y en una ráfaga de peticiones del mismo usuario el costo es de una sola llamada. Las peticiones concurrentes comparten la misma promesa, así que no se multiplican las llamadas.

El TTL es `TTL_ESTADO_SESION_MS` en `packages/service-kit`, en un solo lugar y documentado.

### D3 — Un contenedor Postgres, una base y un rol por servicio
Postgres no permite joins ni claves foráneas entre bases distintas, así que tres bases en un contenedor dan el mismo aislamiento que tres contenedores, con la cuarta parte de la memoria en el PC de desarrollo y en CI. Cada base tiene un rol dueño (`svc_identity`, `svc_learning`, `svc_matching`) y `REVOKE CONNECT ... FROM PUBLIC`, de modo que el rol de un servicio **no puede conectarse a la base de otro** aunque alguien equivoque el `DATABASE_URL`. En producción cada base puede ser una instancia separada sin tocar código: cambia solo la URL.

No existe `auth_db`, porque `auth-service` no tiene tablas.

### Comunicación entre servicios
- **REST interno sincrónico.** Sin bus de mensajes (RabbitMQ/Kafka) hasta que la latencia real lo justifique.
- Ningún servicio consulta la base de otro. Si `matching-service` necesita datos de una persona, llama a la API de `identity-service`.
- **Se reenvía el contexto del usuario:** el `Authorization` original y el `X-Request-Id` viajan en la llamada interna. El servicio que recibe verifica la firma y **toma la empresa de los claims verificados, nunca de un parámetro del request**. Un endpoint interno que reciba `empresaId` por query o por body y lo use sin verificar es un hoyo de aislamiento entre empresas; `packages/service-kit` incluye el test que lo comprueba.
- **Las rutas internas anteriores al login usan un secreto compartido** (`INTERNO_SECRETO`, cabecera `x-interno-secreto`, decorador `@SoloInterno`). Verificar una contraseña, rotar un refresh o aceptar una invitación ocurre cuando todavía no existe un token de usuario que reenviar, así que no hay contexto que propagar. Sin esto, cualquiera que alcanzara `identity-service` por la red podría probar contraseñas contra él sin pasar por el límite de intentos del gateway. La comparación del secreto es de tiempo constante, y un servicio que no lo tenga configurado rechaza esas rutas en vez de dejarlas abiertas. El gateway nunca expone `/interno/*` hacia afuera.

### Auditoría y Ley 21.719
- Una tabla `registro_auditoria` **por base**, con el mismo esquema y el mismo trigger append-only que hoy. Cada servicio audita lo suyo, donde lo escribe, sin llamadas de red en el camino crítico.
- La exportación y la supresión de los datos de una persona se **orquestan en el gateway**: consulta o anonimiza en los tres servicios y compone una sola respuesta. Si un servicio falla, la operación se reporta como incompleta y se puede reintentar; la anonimización es idempotente.
- Se construye **después de M2**, antes de cerrar el MVP. Hasta entonces el sistema no cumple el criterio 6 de SPEC §10.

### Dónde vive cada cosa que aún no existe
- `Tema` (catálogo por empresa) vive en **identity**. `learning` y `matching` guardan solo `temaId`, sin clave foránea.
- `Curso`, `EtapaCurso`, `Inscripcion`, `MaterialClase`, `Rubrica`, `Indicador`, `Medicion` → **learning**.
- `Match` → **matching**.
- `PerfilInteres` → **identity** (es un dato de la persona).

### Fases
M0 estructura · M1 mover Slices 0 a 3 · M2 gateway y frontend · M3 Slices 4 a 7 directamente en los servicios nuevos · M4 CI/CD y documentación. Cada fase se acota a una sesión de trabajo, termina con el sistema funcionando de punta a punta y deja `main` demostrable.

## Alternatives Considered
- **`Cuenta` en `auth_db` y `Persona` en `identity_db`** (corte conceptualmente más limpio): el alta de empresa pasaba a dos pasos. Era viable sin Saga, porque "empresa en onboarding sin invitación" ya es un estado válido del dominio y se repara con el botón "Reenviar invitación" que existe. Se descartó porque partía `Usuario` en dos bases con el mismo UUID y sin nada que garantizara la correspondencia.
- **Validar solo la firma del JWT sin consultar estado** (lo más simple y rápido): se descartó por reabrir el hoyo de T2.4. Alternativa evaluada: bajar el access token de 15 a 5 minutos, que reduce la ventana sin eliminarla.
- **Cuatro instancias de Postgres:** el aislamiento es idéntico al de cuatro bases con roles separados, y cuesta cinco contenedores en el PC y en CI. Se descartó para desarrollo; queda disponible para producción.
- **Un servicio de auditoría dedicado:** centraliza el rastro, pero agrega un quinto servicio en el camino crítico de toda escritura, y si se cae se pierde auditoría o se bloquean las escrituras. Se descartó.
- **Bus de mensajes desde el inicio:** resolvería la consistencia entre servicios, pero agrega infraestructura, un modelo de programación nuevo y depuración asincrónica a un equipo de 4–5 personas con un semestre de plazo. Se posterga explícitamente.

## Consequences
- **Se pierde la integridad referencial entre servicios.** La base ya no garantiza que `Curso.capacitadorId` apunte a una persona que existe, ni `Inscripcion`, ni `Match`, ni `PerfilInteres.temaId`. Cada servicio tiene que tolerar referencias huérfanas y no reventar al encontrarlas.
- **El matching y los dashboards dejan de ser una consulta SQL.** El mazo del swipe necesita la persona y su área, sus perfiles de interés (identity), los cursos en etapa Diagnóstico de su empresa y la valoración de cada capacitador (learning). Antes era un JOIN; ahora son varias llamadas REST y el score se calcula en memoria, sin poder ordenar por afinidad en la base. Para el piloto (3–4 empresas) alcanza de sobra; el diseño de T6.2 y T6.3 cambia por esto.
- **El secreto del JWT es compartido por todos los servicios.** Quien comprometa uno puede firmar tokens válidos para todos. A cambio, ninguna petición depende de `auth-service`.
- **Un despliegue de 5 servicios y 3 bases** en vez de 1 API y 1 base. Hay que verificar que quepa en el plan gratuito de Railway o Render antes de M4.
- **Depurar cruza cinco procesos.** Por eso el `X-Request-Id` se genera en el gateway y se propaga desde M0: sin él, "el login falló" son cinco logs sin nada en común.
- **El monolito `apps/api` se eliminó al terminar M2.** El gateway ocupa su puerto 3000 y la web no notó el cambio más allá de los prefijos de ruta.
