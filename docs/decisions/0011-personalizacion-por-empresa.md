# ADR-0011: Cada empresa personaliza su propio entorno

## Status
Aceptada

## Date
2026-11-10

## Context

La SPEC §4 listaba **«colores por empresa»** explícitamente fuera de alcance, con una paleta fija
`#00347A` / blanco / `#FFB627`. Esa decisión era del equipo y nunca se le preguntó a la clienta:
se tomó para no construir un sistema de temas en un piloto de un semestre.

En la reunión del 2026-10-29 la clienta la contradijo. Pidió *«personalización en el entorno de
empresas de RRHH»*, y al pedirle contexto:

> «Lo que pensé yo es que la empresa pueda personalizar todo su entorno pero algo básico;
> nosotros le dejamos la plantilla ya como está ahora y ellos deciden si personalizar. Todo lo
> hace RRHH de cada empresa.»

> «Cada empresa podrá personalizar solo su entorno […] eso no cambiará ni el login ni las demás
> empresas ni ENACTIVA»

Y sobre el riesgo obvio —que alguien elija un azul sobre el que no se lee el texto blanco—:

> «Da igual que los colores se contrasten, eso lo tienen que ver ellos»

El cambio tiene sentido de negocio: el piloto va a 3–4 empresas que van a pedirle a su gente que
entre todos los días a una herramienta que no lleva su marca. Pero toca la pantalla de todos, así
que necesita un límite escrito.

## Decision

### Qué se personaliza
- **El logo de la empresa**, que reemplaza la marca dentro de su entorno.
- **Cuatro colores**, que son los que ya existen como variables CSS en `apps/web/src/index.css`:
  `--color-marca`, `--color-acento`, `--color-fondo` y `--color-texto` **[E]**.

Los derivados (`--color-marca-oscuro` y `--color-marca-suave`) **se calculan** a partir del color
de marca y no se piden **[E]**: pedir seis colores para que tres de ellos sean versiones del
primero es trabajo del formulario, no de la persona.

### Quién la administra
**RRHH de cada empresa [C]**, desde su propio entorno. No ENACTIVA: el equipo de Karina administra
el piloto, no la identidad visual de sus clientes. Es el mismo criterio con el que RRHH gestiona
las personas, las áreas y el catálogo de temas.

### Hasta dónde llega
La personalización vive **dentro del entorno de esa empresa y en ningún otro lugar [C]**. No alcanza:

- **El login**, porque es anterior a la sesión y nadie sabe todavía de qué empresa es quien mira.
  La clienta además lo dejó cerrado aparte: *«déjemelos como están»*.
- **Las pantallas de ENACTIVA** (empresas, métricas globales, equipo), que son de quien opera la
  plataforma y tienen que verse igual mirando a cualquier empresa.
- **Las otras empresas**, que es el mismo aislamiento por empresa que ya rige los datos.
- **Los correos** **[E]**: salen del servidor, no del navegador, y ninguno de los dos recorridos
  que los manda —la invitación y el reloj de recordatorios— tiene hoy motivo para leer la
  configuración visual de una empresa. Se puede agregar después si lo pide.

### El contraste no se fuerza
Se guarda lo que RRHH elija, tal cual **[C]**. El formulario **muestra una vista previa** y
**avisa** cuando un color queda con poco contraste, pero no bloquea **[E]**: la clienta dijo que
es problema de la empresa, y un aviso es la forma de que sea un problema que vieron venir.

Lo único que no se negocia es que el color **no pueda romper la aplicación**: se valida que sea un
color hexadecimal, porque de ahí sale una variable CSS y un valor libre sería una inyección en la
hoja de estilos.

### Quien no personaliza
Se queda con la plantilla actual **[C]**. La configuración es opcional y su ausencia es el estado
normal, no un estado incompleto: la paleta de hoy pasa a ser el valor por omisión, no un requisito.

## Consequences

- **La SPEC §4 cambia**: «colores por empresa» sale de «Fuera de alcance». Es la primera vez que
  una decisión del equipo se revierte porque la clienta pidió lo contrario, y queda anotado para
  que nadie la reconstruya leyendo la versión vieja.
- Hace falta **guardar el logo**, que es el primer archivo que sube alguien desde el ADR-0008, que
  eliminó la subida de contenidos. Dónde se guarda se decide al construirlo; no reabre el ADR-0006,
  porque un logo por empresa no es un repositorio de material de clase.
- La paleta deja de ser una constante y pasa a ser **datos**, así que cualquier color escrito a
  mano en un componente se vuelve un error que solo se ve con una empresa personalizada. Hay que
  revisar los que ya existen —`accent-[#00347A]` en `AgregarInteres.tsx` es uno— antes de dar la
  configuración por terminada.
- **Riesgo aceptado:** una empresa puede dejar su entorno ilegible. La clienta lo aceptó
  explícitamente. El aviso de contraste existe para que no sea una sorpresa, y la plantilla sigue
  ahí para volver atrás.
