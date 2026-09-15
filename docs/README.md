# docs/ — Contexto del proyecto para Claude Code

Estos archivos contienen todo el contexto de negocio y las decisiones ya validadas con ENACTIVA SpA. Claude Code puede leerlos directamente citándolos por nombre (ej. "revisa docs/arquitectura-tecnica.md").

## Archivos

- **specs/SPEC.md** — Especificación vigente del MVP: roles y permisos, reglas de dominio confirmadas con la clienta (rúbrica, matching, mediciones, privacidad), límites y preguntas abiertas. **Es la fuente de verdad de qué construir.**

- **decisions/** — Registros de decisiones de arquitectura (ADRs): monorepo, modelo de datos, autenticación y permisos, correo transaccional.

- **arquitectura-tecnica.md** — Stack tecnológico decidido (React+TS, NestJS, PostgreSQL+Prisma), con el porqué de cada elección y las alternativas descartadas. Incluye el diagrama de arquitectura, retos técnicos esperados y el roadmap por fases del MVP. **Léelo antes de proponer cualquier estructura de carpetas o esquema de base de datos.** Nota: su roadmap ubica el Panel Admin en el MVP 3; la prioridad vigente lo pone primero (ver `../tasks/plan.md`).

- **requerimientos.xlsx** — ⚠️ **Histórico.** Planilla previa a las reuniones con la clienta; describe un concepto anterior (cartografía de red, motor de simulación, métricas de centralidad). No refleja el producto actual y no debe usarse como fuente de verdad.

- **mockup-sistema.html** — Prototipo interactivo con los 4 roles del sistema (Admin ENACTIVA, RRHH Empresa, Capacitador, Estudiante) ya validado visualmente. Ábrelo en el navegador para ver el comportamiento esperado de cada pantalla antes de construirla — el detalle de interacciones (qué se abre al hacer clic, qué campos tiene cada formulario) está ahí, no hace falta que lo repita en el prompt.

- **informe-fase1.docx** — Informe académico completo de la Fase 1 del Capstone: contexto de negocio, objetivos, metodología, plan de trabajo. Referencia solo si necesitas contexto de por qué se tomó alguna decisión de alcance.

## Orden de lectura sugerido

1. `specs/SPEC.md` — qué construir y con qué reglas.
2. `arquitectura-tecnica.md` y `decisions/` — el stack y el porqué.
3. `../tasks/plan.md` — qué se construye primero.
4. `mockup-sistema.html` — cómo debe comportarse cada pantalla.
5. `informe-fase1.docx` — solo si falta contexto de negocio. El nombre "Conecta" usado ahí no es un nombre comercial definido.
