# ADR-0002: Modelo de datos inicial

## Status
Aceptada

## Date
2026-09-15

## Context
El riesgo principal del proyecto es el modelado del dominio (rúbrica, matching, permisos). Las reglas confirmadas por la clienta están en `docs/specs/SPEC.md` §3. Las mediciones reales de las empresas piloto no se pueden reconstruir si el modelo es incorrecto, así que el esquema se acuerda completo antes de implementar, aunque **cada slice migra solo las tablas que usa**.

## Decision

### Convenciones
- IDs UUID (no enumerables en URLs). `createdAt` / `updatedAt` en todas las tablas mutables.
- Conceptos de estructura fija como **enums de Postgres**: roles, dimensiones, momentos, etapas.
- Se guardan **puntajes crudos**, no solo porcentajes: permite recalcular si la fórmula cambia.
- `empresaId` presente en toda entidad de negocio que RRHH consulta, para filtrar en la consulta base (ADR-0003). Esto es scoping de autorización, **no** multi-tenancy.

### Enums
```
Rol              ADMIN_ENACTIVA | RRHH | CAPACITADOR | ESTUDIANTE
NivelAdmin       PRINCIPAL | OPERATIVO
EstadoEmpresa    ONBOARDING_PENDIENTE | ACTIVA
EstadoUsuario    INVITADO | ACTIVO | SUSPENDIDO | ANONIMIZADO
TipoToken        REFRESH | INVITACION | RESET_PASSWORD
Dimension        HABILIDAD | CONTENIDO | ACTITUD
TipoInteres      ENSENAR | APRENDER
NivelDominio     BASICO | MEDIO | ALTO                        [S]
EstadoMatch      DESCARTADO | INSCRITO
EstadoCurso      DIAGNOSTICO | CLASE | MONITOREO | FINALIZADO
Momento          DIAGNOSTICO | INTERMEDIO | MONITOREO
EstadoRubrica    BORRADOR | CONGELADA
EstadoMedicion   BORRADOR | CERRADA
AccionAuditoria  LOGIN | LOGIN_FALLIDO | LEER | CREAR | ACTUALIZAR | ELIMINAR | EXPORTAR | ANONIMIZAR
TipoSolicitud    ACCESO | SUPRESION
```

### Tablas
```
── Organización e identidad ────────────────────────────────────────────────
Empresa           id, nombre, rubro (texto), estado, activadaAt?, activadaPorId?, creadaPorId
Area              id, empresaId, nombre                                UNIQUE(empresaId, nombre)
Usuario           id, empresaId? (null = equipo ENACTIVA), areaId?, email UNIQUE, passwordHash?,
                  nombre?, apellido?, cargo?, estado, nivelAdmin?, anonimizadoAt?
                  Invariante: nivelAdmin no nulo ⇔ tiene rol ADMIN_ENACTIVA
UsuarioRol        usuarioId, rol                                       PK(usuarioId, rol)
TokenAcceso       id, usuarioId, tipo, tokenHash, expiraAt, usadoAt?, revocadoAt?

── Intereses y matching ────────────────────────────────────────────────────
Tema              id, empresaId, nombre, nombreNormalizado, creadoPorId?
                  UNIQUE(empresaId, nombreNormalizado)
PerfilInteres     id, usuarioId, temaId, tipo, dimensiones Dimension[], nivel?, descripcion?, activo
                  UNIQUE(usuarioId, temaId, tipo)
Match             id, empresaId, estudianteId, capacitadorId, cursoId, temaId,
                  scoreSnapshot Decimal(5,2), estado, createdAt
                  UNIQUE(estudianteId, cursoId)

── Cursos y rúbricas ───────────────────────────────────────────────────────
Curso             id, empresaId, capacitadorId, temaId, titulo, descripcion,
                  dimensiones Dimension[], estado
EtapaCurso        cursoId, etapa, iniciadaAt?, cerradaAt?             PK(cursoId, etapa)
SesionClase       id, cursoId, orden, titulo, contenido               (formato pendiente, SPEC Q6)
Inscripcion       id, cursoId, estudianteId, matchId? UNIQUE, createdAt
                  UNIQUE(cursoId, estudianteId)
Rubrica           id, cursoId, version, estado, umbralLogrado Int(0–100), congeladaAt?
                  UNIQUE(cursoId, version)
Indicador         id, rubricaId, dimension, descripcion, peso Int, orden

── Mediciones ──────────────────────────────────────────────────────────────
Medicion          id, cursoId, rubricaId, estudianteId, evaluadorId, momento, estado, cerradaAt?,
                  logroTotal?, logroHabilidad?, logroContenido?, logroActitud?
                  (Decimal(5,2), snapshot calculado al cerrar)
                  UNIQUE(cursoId, estudianteId, momento)
PuntajeIndicador  medicionId, indicadorId, puntaje Int(0–100)          PK(medicionId, indicadorId)
Test              id, cursoId, momento, titulo, estado                 UNIQUE(cursoId, momento)   [S, SPEC Q4]
Pregunta          id, testId, dimension?, enunciado, orden                                        [S]
Alternativa       id, preguntaId, texto, esCorrecta                                               [S]
IntentoTest       id, testId, estudianteId, puntaje Decimal(5,2)?, enviadoAt
                  UNIQUE(testId, estudianteId)
RespuestaTest     intentoId, preguntaId, alternativaId                 PK(intentoId, preguntaId)
Valoracion        id, cursoId, estudianteId, capacitadorId, estrellas Int(1–5) [S, SPEC Q5], createdAt
                  UNIQUE(cursoId, estudianteId)

── Cumplimiento Ley 21.719 ─────────────────────────────────────────────────
RegistroAuditoria id BIGSERIAL, actorId?, actorRol?, empresaId?, accion, entidad, entidadId?,
                  camposModificados text[], ip, createdAt
                  Append-only. Sin FK. Nunca guarda valores de datos personales, solo nombres de campos.
AceptacionAviso   id, usuarioId, versionAviso, aceptadoAt, ip
SolicitudDerecho  id, usuarioId, tipo, estado, createdAt, resueltaAt?, resueltaPorId?
```

### Invariantes (se validan en la capa de aplicación y con tests)
1. La suma de `Indicador.peso` de una rúbrica es 100 para poder congelarla.
2. La rúbrica pasa a `CONGELADA` cuando el curso entra a Diagnóstico; después no se editan indicadores, pesos ni umbral.
3. Una `Medicion` solo usa indicadores de su `rubricaId` y se cierra con todos los indicadores puntuados.
4. `Match` e `Inscripcion`: estudiante, capacitador y curso de la misma empresa; estudiante ≠ capacitador; el curso está en estado `DIAGNOSTICO`.
5. `Valoracion` solo si el curso está `FINALIZADO` y el estudiante estaba inscrito.
6. Ninguna entidad de negocio relaciona dos empresas distintas.

### Supresión de un usuario
`Usuario` → estado `ANONIMIZADO`: email, nombre, apellido, cargo y passwordHash se reemplazan o anulan; se revocan sus tokens; se borran sus `PerfilInteres` y los `Match` en estado `DESCARTADO`. `Medicion`, `IntentoTest`, `Valoracion` e `Inscripcion` **se conservan** apuntando al usuario anonimizado. `RegistroAuditoria` conserva el `actorId`, que ya no identifica a nadie.

## Alternatives Considered
- **Neo4j para el grafo:** descartado en `arquitectura-tecnica.md` §1.4; el matching del MVP es una consulta filtrada con score.
- **Rúbrica como JSON libre:** impide validar pesos y calcular logro de forma uniforme. Rechazado.
- **Guardar solo el % de logro:** impide recalcular si la fórmula cambia. Rechazado.
- **Tablas de permisos editables:** flexibilidad que nadie pidió. Rechazado (ver ADR-0003).
- **Roles excluyentes (una columna `rol`):** contradice que una persona sea Capacitador y Estudiante a la vez. Rechazado.

## Consequences
- El delta de evolución proviene de `Medicion` (rúbrica), que es comparable entre momentos; los tests se reportan por nivel.
- Agregar una dimensión o un momento requiere migración: es intencional, la estructura es fija por negocio.
- Las tablas de tests y valoración quedan en borrador hasta resolver las preguntas Q4 y Q5 de la SPEC.
