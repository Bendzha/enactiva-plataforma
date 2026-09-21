# Especificación — la plataforma (MVP piloto ENACTIVA)

**Estado:** Aprobada por el equipo (2026-09-15) · **Fecha:** 2026-09-15
**Fuentes:** prompt de arquitectura del equipo, `docs/arquitectura-tecnica.md`, `docs/informe-fase1.docx`, `docs/mockup-sistema.html`, respuestas de la clienta (2026-09-15).

> Trazabilidad (mismo marco del informe): **[C]** confirmado por la clienta · **[S]** supuesto del equipo, por validar · **[P]** propuesta técnica del equipo.
> `docs/requerimientos.xlsx` es **histórico** (describe el concepto previo de cartografía de red / simulador) y no es fuente de verdad.

---

## 1. Objetivo

Ecosistema de capacitación entre pares: colaboradores de una empresa enseñan a otros colaboradores de la **misma empresa** una habilidad, contenido o actitud que dominan. La plataforma conecta a quien quiere aprender con quien puede enseñar (matching tipo swipe), estandariza cada curso (Diagnóstico → Clase → Monitoreo) y mide la evolución en tres dimensiones y tres momentos, para que ENACTIVA y RRHH decidan dónde invertir en desarrollo interno.

Piloto: 3–4 empresas. Equipo: 4–5 estudiantes. Plazo: un semestre.

## 2. Usuarios, roles y permisos

Una persona puede tener **varios roles a la vez** (ej. Capacitador y Estudiante) **[C]**.

| Rol | Alcance de datos | Qué hace |
|---|---|---|
| Admin ENACTIVA — **Principal** (Karina) | Todas las empresas | Todo lo del Admin Operativo + métricas/dashboards globales + gestión de otros admins **[C]** |
| Admin ENACTIVA — **Operativo** (equipo de Karina) | Todas las empresas | Cargar empresas, enviar/reenviar invitaciones **[C]**. **No** activa empresas **[C]**. **No** ve métricas ni dashboards **[C]** (la clienta lo plantea como necesidad futura; se diseña así desde ya) |
| RRHH | Solo su empresa | Dashboard y reportes de su empresa, con resultados individuales nominativos **[C]**; crea temas **[C]** |
| Capacitador | Sus cursos | Crea cursos, carga contenido, define rúbrica y umbral, evalúa a sus estudiantes **[C]**; crea temas **[C]** |
| Estudiante | Lo propio | Declara intereses, hace swipe, rinde tests, califica el curso al final **[C]** |

Los permisos se definen como un **mapa rol → permisos en código** (ver ADR-0003), no como tablas editables **[P]**.

## 3. Reglas de dominio

### 3.1 Empresas
- Estados: `ONBOARDING_PENDIENTE` → `ACTIVA`. El paso a Activa es **acción manual del Admin Principal** **[C]**.
- Rubro: texto libre **[C]**.
- Al agregar una empresa se crea la cuenta RRHH en estado `INVITADO` y se envía **correo real de invitación** **[C]**. El invitado completa su propio nombre y contraseña al activar **[P]** (minimización: el Admin solo ingresa el email).

### 3.2 Curso
- Etapas fijas, sin excepciones: **Diagnóstico → Clase → Monitoreo** **[C]**, más estado `FINALIZADO` al cerrar Monitoreo **[P]**.
- **Etapa ≠ momento de medición.** Momentos: diagnóstico, intermedio (ocurre durante la Clase), monitoreo **[C]**.
- **Contenido: archivos que sube el capacitador o la empresa** **[C]**; la plataforma aporta la estructura y los ordena por etapa. Almacenamiento, tipos y límites en ADR-0006.
- Sin cupo máximo **[C]**.

### 3.3 Rúbrica y logro
- La rúbrica pertenece a un curso; el capacitador define indicadores, la dimensión de cada indicador y los pesos **[C]**.
- Pesos: enteros que **suman 100 por rúbrica** **[C]**.
- Cada indicador se puntúa **0–100** **[C]**; la rúbrica la llena **el capacitador** **[C]**.
- **Umbral de "logrado"** lo define el capacitador **[C]**, **uno por rúbrica** **[C]**. Un indicador está logrado si `puntaje ≥ umbral`.
- La rúbrica se **congela** al abrir el Diagnóstico; después no se editan indicadores, pesos ni umbral **[P]** — si cambiara entre momentos, el delta dejaría de ser comparable.
- Fórmulas (estructura fija, idéntica para todo curso) **[C]** en su base, **[P]** en su forma exacta:
  - `logro_total = Σ(peso_i · puntaje_i) / 100`
  - `logro_dimensión = Σ_{i∈d}(peso_i · puntaje_i) / Σ_{i∈d} peso_i`
  - El umbral **no** afecta el % de logro; solo marca logrado / no logrado. Así el % sigue siendo comparable entre cursos aunque cada capacitador fije su umbral.
- **Delta** = porcentaje relativo **[C]**: `(logro_monitoreo − logro_diagnóstico) / logro_diagnóstico × 100`.
  - Si `logro_diagnóstico = 0` se muestra "sin línea base" en vez de un número **[P]**.
  - Los puntos porcentuales se muestran como dato secundario **[P]** (evita lecturas engañosas como "+300%" en bases bajas).

### 3.4 Tests
- Se reportan **separados** de la rúbrica **[C]**.
- **Distintos por momento, según nivel**: inicio/básico, intermedio, avanzado/final **[C]**.
- Como los tests tienen dificultad creciente, **su delta no es comparable**; el delta de evolución se toma de la **rúbrica** y los tests se muestran como % por nivel **[P, Q4]**.
- Tipo de pregunta (ej. selección múltiple): por definir.

### 3.5 Medición del capacitador
- Se mide por **cursos dictados** y **calificación de los estudiantes** **[C]**.
- La calificación se hace **al final del curso**, una sola nota sobre cómo le pareció el curso **[C]**; escala 1–5 estrellas **[S, Q5]** (coincide con el mockup).
- El capacitador ve el promedio, no quién calificó qué **[S, Q5]**.

### 3.6 Matching
- Solo dentro de la **misma empresa** **[C]**.
- Grafo: nodos = personas; arista potencial = A enseña tema T y B quiere aprender T (se calcula); arista decidida = `Match` (se guarda) **[P]**.
- Cada tarjeta del swipe es **capacitador + curso existente** **[C]**. Solo aparecen cursos en etapa **Diagnóstico**, para que el estudiante tenga línea base **[P]**.
- Like = **inscripción inmediata** al curso, sin aprobación del capacitador **[C]**. Descarte = no se vuelve a mostrar esa tarjeta **[P]**.
- Score de afinidad simple (sin ML) con **todos** los criterios **[C]**: dimensiones coincidentes, nivel, área, valoración del capacitador. Pesos iniciales iguales, constantes en código, ajustados con datos reales **[C]**. Signo del criterio área (misma área suma) **[S]**.
- Catálogo de temas: lo crean Admin, RRHH y Capacitador **[C]**. Temas **por empresa**, con nombre normalizado único y buscador que sugiere existentes antes de crear **[P]** (evita duplicados que romperían el matching).

### 3.7 Privacidad y cumplimiento (Ley 21.719)
- Registro de auditoría append-only desde el Slice 0 **[C]**.
- Exportación y supresión de datos por usuario **[C]**.
- En supresión las mediciones **se conservan** **[C]**, **anonimizadas** (desvinculadas de la persona) **[P — requisito legal]**: conservarlas ligadas a la persona no sería supresión.
- RRHH ve resultados nominativos **[C]** → el aviso de privacidad debe declararlo explícitamente, y esas lecturas se auditan **[P]**. El texto del aviso debe aprobarlo ENACTIVA (Q3).
- Minimización: no se recolecta RUT, teléfono, fecha de nacimiento ni foto **[P]**.
- HTTPS obligatorio. Sin cifrado a nivel de campo para puntajes (rompe agregaciones); se reevalúa si se agregan comentarios libres **[P]**.

## 4. Fuera de alcance
LMS con catálogo · IA generativa de contenidos · SaaS multi-tenant · certificación externa · colores por empresa (paleta fija `#00347A` / blanco / `#FFB627`).

## 5. Estructura del proyecto
Ver ADR-0001. Resumen:
```
apps/api        NestJS (monolito modular) + Prisma
apps/web        React + Vite + TanStack Query + shadcn/ui
packages/shared Zod schemas, tipos y enums compartidos
docs/           specs/, decisions/ (ADRs), material de la clienta
tasks/          plan.md (slices y tareas)
```

## 6. Comandos (se habilitan en Slice 0)
```bash
corepack enable                                # pnpm vía corepack (Node 24 LTS)
pnpm install
docker compose up -d                           # Postgres + Mailpit
cp apps/api/.env.example apps/api/.env         # completar variables del seed
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev                                       # api + web en paralelo
pnpm lint && pnpm typecheck && pnpm test
```

## 7. Estilo de código
- TypeScript estricto en todo el monorepo; ESLint + Prettier compartidos.
- **Dominio en español** (`Empresa`, `Curso`, `Rubrica`, `logroTotal`), **términos técnicos en inglés** (`Controller`, `Service`, `Guard`, `dto`).
- Modelos Prisma en PascalCase mapeados a tablas snake_case (`@@map`).
- Un módulo NestJS por contexto de negocio; un módulo no accede a tablas de otro sin pasar por su service.
- Validación de entrada con Zod (esquemas en `packages/shared`).

```ts
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Post()
  @RequierePermiso('empresas:crear')
  crear(@Body(new ZodPipe(crearEmpresaSchema)) dto: CrearEmpresaDto) {
    return this.empresas.crear(dto);
  }
}
```

## 8. Estrategia de testing
- **Backend:** Vitest (unitario, ver ADR-0005) para reglas de dominio — cálculo de logro, delta, score de matching — con cobertura alta en esas funciones; Supertest (e2e) contra Postgres real para cada endpoint.
- **Obligatorio en e2e:** por cada endpoint, casos 401 (sin token), 403 (rol sin permiso) y **acceso cruzado entre empresas** (RRHH de A no ve datos de B).
- **Frontend:** React Testing Library sobre Vitest para formularios y flujos por rol.
- CI (GitHub Actions) corre lint, typecheck y tests en cada PR.

## 9. Límites
**Siempre:** trabajar en vertical slices; auditar escrituras y lecturas de datos personales; test de scoping por empresa en cada endpoint nuevo; marcar datos sintéticos como demostración.
**Preguntar primero:** cambios al modelo de datos; reglas de rúbrica, matching o permisos; nuevas dependencias de pago; cualquier requisito no presente en esta spec.
**Nunca:** inventar reglas de negocio o un nombre comercial; mostrar métricas inventadas como reales; guardar contraseñas o tokens en claro; construir lo listado en §4.

## 10. Criterios de éxito del MVP
1. Admin crea una empresa, el contacto RRHH recibe la invitación por correo y activa su cuenta.
2. Un estudiante hace like a un curso de su empresa y queda inscrito.
3. Un capacitador evalúa a sus estudiantes con su rúbrica en los 3 momentos y el sistema calcula logro y delta según §3.3.
4. RRHH ve el dashboard de su empresa y lo exporta a PDF y Excel; el capacitador ve la evolución de sus estudiantes y la exporta.
5. Ningún usuario puede leer datos de otra empresa (verificado por tests e2e).
6. Un usuario puede exportar sus datos y solicitar supresión; toda acción queda en auditoría.

## 11. Preguntas abiertas
| # | Pregunta | Bloquea |
|---|---|---|
| Q1 | Nombre del dominio de ENACTIVA y quién administra su DNS (para SPF/DKIM). **Por ahora todo se trabaja en local** (correos en Mailpit); se define al publicar | Despliegue público |
| ~~Q2~~ | ✅ Resuelto 2026-09-15: el Admin Operativo solo carga empresas e invita; no activa | — |
| Q3 | Texto del aviso de privacidad (lo aprueba ENACTIVA) | Slice 2 |
| Q4 | ¿Son 3 tests (inicio/básico, intermedio, avanzado/final) o 4? ¿Confirma que el delta de evolución se toma solo de la rúbrica? | MVP 2 |
| Q5 | Escala de la calificación al capacitador (¿1–5 estrellas?) y si es anónima para el capacitador | MVP 2 |
| ~~Q6~~ | ✅ Resuelto 2026-09-21: son archivos que sube el capacitador o la empresa (ADR-0006) | — |
| ~~Q7~~ | ✅ Resuelto 2026-09-21: un umbral por rúbrica | — |
| Q8 | ¿Hay un límite de espacio en disco por empresa para los contenidos? | MVP 1 |
