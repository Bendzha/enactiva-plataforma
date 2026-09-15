# ENACTIVA — Análisis Técnico de Arquitectura
**Rol: Arquitecto de Software Senior · Documento vivo, versión 1**

> Basado en los requisitos confirmados hasta la Reunión 1: matching persona-a-persona (tipo "Tinder") con base en teoría de grafos, estructura de curso estandarizada (diagnóstico → clase → monitoreo), rúbricas con 3 dimensiones (contenido/habilidad/actitud), 4 roles, dos dashboards exportables, sin SaaS multi-tenant, MVP acotado a 3-4 empresas piloto.

---

## 1. Arquitectura y Stack Tecnológico

### 1.1 Filosofía de la decisión

Con 4-5 estudiantes, un semestre, y sin restricciones de infraestructura de ENACTIVA, el criterio no es "qué es más moderno" sino: **menor superficie de aprendizaje simultáneo, menor esfuerzo operativo, y librerías maduras para lo que realmente es difícil aquí** (motor de matching + medición estructurada). No es un proyecto de altísima escala — es un proyecto de **modelado de dominio correcto** con un componente de grafos acotado.

### 1.2 Frontend

**Elección: React + TypeScript + Vite**

| Criterio | React | Vue | Angular |
|---|---|---|---|
| Curva de aprendizaje para equipo nuevo | Media | Baja | Alta |
| Ecosistema de librerías de grafos (react-force-graph, Cytoscape.js, D3) | Excelente | Limitado | Limitado |
| Empleabilidad / relevancia de portafolio | Muy alta | Media | Media-alta (más nicho enterprise) |
| Peso/complejidad para un MVP de un semestre | Adecuado | Muy liviano | Excesivo (DI, RxJS, módulos) |

**Por qué React y no las alternativas:** Angular impone una estructura muy pesada (RxJS, inyección de dependencias, decoradores) que consume tiempo de aprendizaje que no se recupera en un semestre. Vue es más simple de aprender, pero el ecosistema de visualización de grafos/redes es notablemente más delgado que el de React — y ese componente (matching visual, red de conexiones) es el corazón técnico y académico del proyecto, así que conviene no quedarse cortos ahí. TypeScript no es opcional: con 4 roles distintos y estructuras de datos como rúbricas/tests, el tipado evita una clase entera de bugs de "propiedad que no existe" que en JS puro se descubren en producción.

### 1.3 Backend

**Elección: Node.js + NestJS + TypeScript**

| Criterio | NestJS (Node) | FastAPI (Python) | Express (Node) puro |
|---|---|---|---|
| Estructura impuesta (módulos, DI, capas) | Sí, fuerte | Media (según disciplina propia) | Ninguna — hay que autoimponerla |
| Un solo lenguaje full-stack | Sí (TS en front y back) | No (context-switch JS↔Python) | Sí |
| Librerías de grafos nativas | Limitadas (graphology) | Excelentes (NetworkX, igraph) | Limitadas |
| Curva de aprendizaje | Media | Baja-media | Baja pero indisciplinada a escala |

**Por qué NestJS y no FastAPI:** la tentación de usar Python es fuerte porque NetworkX es superior para álgebra de grafos. Pero el matching que se pidió para el MVP (¿quién quiere enseñar X y quién quiere aprender X, con qué nivel de afinidad?) **no requiere todavía** algoritmos de grafo pesados (community detection, caminos críticos) — es esencialmente una consulta filtrada con un score de afinidad. Con eso, el costo de mantener dos lenguajes (context-switch del equipo, dos pipelines de CI, dos formas de testear) no se justifica todavía. **Recomendación concreta:** partir 100% TypeScript (front+back) para el MVP, y si en una fase posterior se necesita un algoritmo de grafo más sofisticado, aislarlo como un módulo/servicio interno en Python — no antes.

**Por qué NestJS y no Express puro:** Express da libertad total, pero esa libertad para un equipo estudiantil sin arquitecto de tiempo completo se traduce en código inconsistente entre 4-5 personas. NestJS fuerza una estructura por módulos (auth, usuarios, cursos, matching, rúbricas, dashboard) que además es *casi directamente* el diagrama de arquitectura que van a tener que entregar en la documentación académica — ahorra tiempo en ambos frentes.

### 1.4 Base de datos

**Elección: PostgreSQL + Prisma ORM**

| Criterio | PostgreSQL | Neo4j (grafo nativo) | MongoDB |
|---|---|---|---|
| Modelo de datos del proyecto | Altamente relacional (personas, cursos, rúbricas, resultados, matches) | Pensado para grafos densos con muchas consultas de camino/relación | Documentos, débil para JOINs |
| Escala esperada del piloto (3-4 empresas, cientos de personas) | Sobra holgadamente | Sobredimensionado | No aporta ventaja real |
| Curva de aprendizaje / soporte / documentación | Muy alta | Media-alta (Cypher es otro lenguaje de consulta) | Alta |

**Por qué Postgres y no Neo4j:** esto contradice la intuición ("es un proyecto de grafos, uso una base de grafos"), pero es la decisión correcta para el volumen y tipo de consultas de este MVP. El "grafo" del matching se puede representar perfectamente como tablas relacionales (`personas`, `intereses`, `matches`, con claves foráneas) y calcular afinidad con consultas SQL o en la capa de aplicación. Neo4j brilla cuando necesitas recorridos de grafo de múltiples saltos a gran escala (ej. "amigos de amigos de amigos") — no es el caso aquí con 3-4 empresas. Se puede reevaluar Neo4j si en fases futuras se agregan métricas de red más avanzadas (centralidad, comunidades) sobre volúmenes reales grandes.

**Por qué Prisma:** genera tipos TypeScript automáticamente desde el esquema, reduce errores de mapeo objeto-relacional, y su sistema de migraciones es más simple de versionar en equipo que escribir SQL a mano — importante con 4-5 personas tocando el mismo esquema.

### 1.5 Autenticación y control de acceso

**Elección: Auth propio con JWT + bcrypt, gestionado dentro de NestJS (módulo `@nestjs/passport`)**

Se evaluó usar un servicio gestionado (Auth0, Clerk, Supabase Auth) para ahorrar tiempo, pero con 4 roles bien definidos y sin necesidad de login social/SSO, el costo de aprender la integración de un servicio externo es comparable al de implementarlo directamente, **y evita quedar atados a un proveedor externo con límites de usuarios en el plan gratuito** justo cuando estén haciendo la demo final con datos reales de 3-4 empresas. RBAC (control de acceso por rol) se implementa con guards/decoradores nativos de NestJS.

### 1.6 DevOps / Cloud

| Componente | Elección | Por qué / alternativa descartada |
|---|---|---|
| Hosting backend + DB | **Railway** o **Render** | Frente a AWS/GCP: configuración en minutos, sin curva de aprendizaje de IAM/VPC que no aporta nada a un MVP académico. Free tier alcanza para el piloto. |
| Hosting frontend | **Vercel** | Integración nativa con React/Vite, previews automáticos por PR — útil para que ENACTIVA revise avances sin esperar el deploy final. |
| CI/CD | **GitHub Actions** | Gratuito, ya viven en GitHub, no requiere herramienta adicional (descarta Jenkins/CircleCI por sobrecarga operativa). |
| Contenedores | **Docker** (solo para consistencia de entorno local) | No se justifica Kubernetes para este volumen — es sobreingeniería explícita que el propio brief del proyecto pide evitar. |

### 1.7 Diagrama de arquitectura recomendada

```
┌─────────────────────────────┐
│   Frontend (React + TS)     │
│  - Vistas por rol           │
│  - Visualización de red     │
│    (react-force-graph)      │
│  - Dashboards (Recharts)    │
└──────────────┬───────────────┘
               │ REST/HTTPS (JSON)
┌──────────────▼───────────────┐
│   Backend (NestJS, monolito  │
│   modular)                    │
│  ┌─────────┐ ┌─────────────┐ │
│  │ Auth/RBAC│ │ Usuarios/   │ │
│  │          │ │ Perfiles    │ │
│  └─────────┘ └─────────────┘ │
│  ┌─────────┐ ┌─────────────┐ │
│  │ Matching │ │ Cursos/     │ │
│  │ Engine   │ │ Rúbricas    │ │
│  └─────────┘ └─────────────┘ │
│  ┌─────────┐ ┌─────────────┐ │
│  │ Tests/   │ │ Dashboard/  │ │
│  │ Medición │ │ Exportación │ │
│  └─────────┘ └─────────────┘ │
└──────────────┬───────────────┘
               │ Prisma ORM
┌──────────────▼───────────────┐
│      PostgreSQL              │
└───────────────────────────────┘
```

Es un **monolito modular**, no microservicios — cada módulo (matching, cursos, rúbricas) vive en el mismo backend pero con límites claros de responsabilidad, lo que permite extraerlo a un servicio separado en el futuro si el proyecto escala más allá del Capstone, sin pagar el costo operativo de microservicios ahora.

---

## 2. Herramientas y Ecosistema

| Necesidad | Herramienta recomendada | Para qué |
|---|---|---|
| Visualización de red/matching | **react-force-graph** o **Cytoscape.js** | Grafo de fuerza dirigida interactivo — pedido explícitamente por ENACTIVA |
| Gráficos de dashboard | **Recharts** | Gráficos de barra/línea simples, se integra bien con React, curva de aprendizaje baja |
| Exportar a PDF | **Puppeteer** (server-side, renderiza HTML→PDF) o **@react-pdf/renderer** | Puppeteer es más simple si el PDF es "una versión imprimible del dashboard web"; react-pdf si se necesita un layout de PDF distinto y más controlado |
| Exportar a Excel | **SheetJS (xlsx)** | Estándar de facto, ya evaluado en la fase de definición de stack |
| Validación de formularios/datos | **Zod** | Se integra con TypeScript, valida tanto en frontend como en backend con el mismo esquema |
| Testing backend | **Jest + Supertest** | Estándar del ecosistema Node/Nest |
| Testing frontend | **React Testing Library** | Evita testear detalles de implementación, se enfoca en comportamiento |
| Componentes UI | **shadcn/ui + Tailwind CSS** | Acelera mucho el desarrollo de formularios/tablas/modales sin partir de cero, look profesional por defecto |
| Gestión de estado en frontend | **TanStack Query** (React Query) | Maneja cacheo y sincronización de datos del backend sin tener que armar un Redux completo — para un CRUD-heavy como este, es la opción correcta |
| Diagramas de arquitectura para la documentación académica | **Excalidraw** o **draw.io** | Rápidos, exportan a imagen, no requieren licencia |

**Regla general:** ninguna de estas herramientas requiere pago para el volumen del piloto (3-4 empresas). Si en algún momento se evalúa una herramienta de pago, debe justificarse explícitamente — no por defecto.

---

## 3. Análisis de Dificultad y Retos Técnicos

### 3.1 Nivel de complejidad general

**Media-alta**, pero no por la tecnología en sí (el stack elegido es todo estándar y bien documentado) sino por el **modelado de dominio**: traducir conceptos como "afinidad de matching", "rúbrica estandarizada pero flexible por curso", y "delta de aprendizaje entre 3 momentos" en un esquema de datos limpio es más difícil que escribir el código una vez que el modelo está bien pensado.

### 3.2 Principales obstáculos

**1. Diseñar el algoritmo de matching sin sobre-ingeniería**
El riesgo es partir queriendo un modelo de recomendación sofisticado (embeddings, ML) cuando el problema real del MVP es mucho más simple: cruzar "quiero aprender X" con "quiero enseñar X", ordenado por algún criterio de afinidad (área, nivel, disponibilidad).
*Mitigación:* para el MVP, implementar el matching como una consulta con score ponderado simple (coincidencia de tema + filtros), no un motor de ML. Se puede evolucionar después si el volumen de datos lo justifica.

**2. Rúbrica "estandarizada pero flexible"**
ENACTIVA pidió que la estructura sea siempre igual (diagnóstico → clase → monitoreo) pero que el contenido de cada rúbrica lo defina quien enseña. Modelar esto mal (ej. hardcodear indicadores) rompe la flexibilidad; modelarlo demasiado genérico (ej. JSON libre sin validación) rompe la posibilidad de calcular porcentajes de forma consistente.
*Mitigación:* modelar la rúbrica como una entidad con una lista de indicadores (cada uno con peso), y el porcentaje de logro se calcula siempre de la misma forma sin importar cuántos indicadores tenga. Esto se define en el esquema de base de datos desde la primera semana de desarrollo — es la decisión de diseño más importante del proyecto.

**3. Datos insuficientes para dashboards significativos en el piloto**
Con 3-4 empresas y pocos meses de uso real, los dashboards pueden verse "vacíos" o poco representativos en la demo final.
*Mitigación:* preparar un dataset sintético/de demostración adicional al real, generado con reglas coherentes, para que la demo muestre el potencial del dashboard aunque el uso real del piloto sea limitado. Debe quedar explícitamente marcado como datos de demostración, no reales.

**4. Cuatro roles con permisos cruzados**
Admin ENACTIVA ve todo; RRHH de empresa ve solo su empresa; capacitador ve sus propios cursos; estudiante ve lo suyo. Errores de scoping de datos (que una empresa vea datos de otra) son el bug más grave posible en este dominio.
*Mitigación:* aplicar el filtro de "empresa" a nivel de query base (no en cada endpoint por separado) usando un middleware/interceptor de NestJS que inyecte automáticamente el `empresaId` del usuario autenticado en cada consulta.

**5. Equipo de 4-5 estudiantes aprendiendo varias piezas nuevas a la vez**
NestJS, Prisma, y una librería de grafos son todas piezas nuevas para la mayoría de los equipos Capstone.
*Mitigación:* usar vertical slices (sección de la metodología del proyecto) — construir una funcionalidad end-to-end pequeña primero (ej. login + ver un perfil) para que todo el equipo se familiarice con el flujo completo antes de repartirse módulos en paralelo.

### 3.3 Cuellos de botella esperados por fase

| Fase | Cuello de botella probable |
|---|---|
| Semanas 1-2 | Definir el esquema de datos de rúbrica (es la pieza que más rediseño sufre si se apura) |
| Semanas 3-5 | Integrar auth + RBAC correctamente antes de construir features sobre una base insegura |
| Semanas 6-8 | Matching — pasar de "funciona con datos de prueba" a "tiene sentido con datos reales de una empresa piloto" |
| Semanas 9-11 | Dashboards con datos reales insuficientes (ver mitigación 3.2.3) |
| Semanas 12+ | Pulido, despliegue, preparación de demo final |

---

## 4. Hoja de Ruta (Roadmap) y Fases del MVP

### Fase 0 — Setup (semana 1-2)
- Repositorio, monorepo o repos separados (frontend/backend), configuración de ESLint/Prettier compartida.
- Esquema inicial de base de datos (personas, empresas, roles, cursos, rúbricas).
- Pipeline de CI básico (lint + test en cada PR).
- Wireframes de las pantallas principales por rol.

### MVP 0 — Vertical slice mínimo (semana 3-4)
- Auth + los 4 roles con RBAC funcional.
- Perfil de usuario con área de interés (aprender/enseñar).
- Un curso simple con estructura estándar, sin rúbrica todavía — solo para validar el flujo end-to-end.

### MVP 1 — Core del producto (semana 5-8)
- Motor de matching básico (filtro + score simple).
- Rúbrica estandarizada configurable + cálculo de porcentaje de logro.
- Los 3 momentos de medición (diagnóstico/intermedio/monitoreo) registrables.

### MVP 2 — Medición completa + Dashboards (semana 9-11)
- Módulo de tests (previo/intermedio/final).
- Dashboard RRHH-empresa y dashboard capacitador (versión inicial).
- Exportación a PDF/Excel.

### MVP 3 — Endurecimiento y demo (semana 12-14)
- Panel de administración global ENACTIVA.
- Módulo de feedback/microclase de refuerzo.
- Revisión de seguridad (scoping de datos por empresa, validación de inputs).
- Preparación de dataset de demostración + despliegue del piloto.

### Fuera del semestre (visión futura, no construir todavía)
- IA generativa para creación de cursos (mencionada por ENACTIVA como feature de pago a futuro).
- SaaS multi-tenant.
- Certificación externa.
- Gamificación/sistema de recompensas.
- Migración a base de datos de grafo nativa (Neo4j) si el volumen y complejidad de matching lo justifican.
- Las capas adicionales (onboarding, recuperación de conocimiento de gente que se jubila) — pendiente de que ENACTIVA priorice cuál desarrollar primero.

---

## Resumen de decisiones clave

| Capa | Decisión | Alternativa principal descartada |
|---|---|---|
| Frontend | React + TypeScript + Vite | Vue (ecosistema de grafos más débil) |
| Backend | NestJS (Node + TypeScript) | FastAPI (mejor para grafos pesados, pero no se necesita aún) |
| Base de datos | PostgreSQL + Prisma | Neo4j (sobredimensionado para el volumen del piloto) |
| Auth | JWT propio con NestJS | Auth0/Clerk (riesgo de límites de plan gratuito en demo) |
| Hosting | Railway/Render + Vercel | AWS/GCP (complejidad operativa innecesaria) |
| Arquitectura | Monolito modular | Microservicios (sobreingeniería para este alcance) |

**Nota final como arquitecto:** el mayor riesgo de este proyecto no es tecnológico — el stack elegido es sólido y probado. El riesgo real es el **modelado del dominio** (rúbrica, matching, roles). Recomiendo que la primera decisión técnica del equipo, antes de escribir una sola línea de UI, sea cerrar el esquema de base de datos completo y revisarlo con alguien externo al equipo (puede ser un profesor guía) antes de construir sobre él.
