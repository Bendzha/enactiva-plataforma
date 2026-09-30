# ADR-0008: La plataforma no aloja clases; el facilitador publica una ficha de taller

## Status
Aceptada

## Date
2026-09-29

## Context
En la reunión con la clienta del 2026-09-29 (acta "ACTA REUNIÓN - CAPSTONE DUOC", 29-09-2026) Karina corrigió de forma explícita la interpretación con la que veníamos trabajando. Cita del acta:

> "Se aclaró que el sistema no debe albergar clases completas ni convertirse en una plataforma educativa tradicional. Los facilitadores solo cargarán una ficha general con la información esencial del taller, y los participantes organizarán directamente la actividad presencial."

Y, en el apartado de definiciones:

> "El equipo corrigió la interpretación anterior de que se construiría un Moodle dentro de la aplicación y acordó enfocarse en matches corporativos."

Esto contradice el ADR-0006, que se escribió el 2026-09-21 a partir de una respuesta anterior de la clienta ("el contenido de las clases son archivos que sube el capacitador o la empresa"). Con la aclaración nueva, esa respuesta se entiende en otro marco: la actividad ocurre **en persona**, y lo que la plataforma guarda es la convocatoria, no el material.

El acta también agrega tres elementos que antes no existían, como acciones asignadas al equipo de desarrollo:

> "Incorporar una ficha estándar para que los facilitadores indiquen el nombre, fecha, cupo, objetivo, horario y resultados esperados de cada taller."
> "Registrar la ubicación acordada para cada actividad presencial."
> "Considerar la disponibilidad horaria, la agenda y los recordatorios por correo para facilitadores y participantes."

## Decision

### La plataforma conecta y convoca; no enseña
Lo que el sistema guarda de un taller es una **ficha**, no contenido:

| Campo | Origen |
|---|---|
| Nombre | acta 2026-09-29 |
| Fecha | acta 2026-09-29 |
| Horario | acta 2026-09-29 |
| Cupo | acta 2026-09-29 |
| Objetivo | acta 2026-09-29 |
| Resultados esperados | acta 2026-09-29 |
| Ubicación de la actividad presencial | acta 2026-09-29 |

### Se deja sin efecto el ADR-0006
No hay subida de archivos, ni almacenamiento en disco, ni descarga con permisos, ni validación de bytes de cabecera, ni antivirus pendiente. **Desaparece también la pregunta Q8** (límite de espacio por empresa) y con ella el supuesto de 2 GB, que nunca llegó a implementarse.

Es trabajo que se elimina, no que se pospone: el ADR-0006 queda marcado como reemplazado por este.

### Aparece la dimensión de agenda
El facilitador declara **cuándo está disponible**; los participantes ven esa disponibilidad. El sistema envía **recordatorios por correo** a facilitador y participantes. La infraestructura de correo ya existe desde el Slice 1 (ADR-0004), así que esto es lógica de negocio, no infraestructura nueva.

### El cupo pasa a existir
Contradice la respuesta del 2026-09-15 ("cursos sin cupo máximo"). Se toma la del acta por ser posterior y explícita, y porque un taller presencial en una sala tiene un límite físico que el anterior modelo en línea no tenía. Queda registrado como cambio de criterio, no como olvido.

## Alternatives Considered
- **Mantener el ADR-0006 "por si acaso"**, dejando la subida de archivos como opcional: se descartó. Karina fue explícita en que no quiere una plataforma educativa, y construir un almacenamiento de archivos que nadie pidió consume el tiempo que necesitan el matching y la agenda.
- **Modelar la ficha como un texto libre** en vez de campos: se descartó. Los campos vienen enumerados en el acta y son los que después alimentan la tarjeta del swipe y los recordatorios; en texto libre no se pueden usar para nada.
- **Guardar un enlace a material externo** (Drive, por ejemplo) dentro de la ficha: no lo pidió la clienta. Se anota como posible mejora futura, no se construye.

## Consequences
- **Se elimina trabajo del MVP:** todo el Slice 5 se reduce de "cursos con contenidos" a "ficha de taller y agenda". Es la primera vez en el proyecto que el alcance baja en lugar de subir.
- **La tarjeta del swipe cambia.** Deja de ser "capacitador + curso en etapa Diagnóstico" y pasa a ser un taller convocado, con su fecha, su cupo y su lugar. El criterio de qué aparece en el mazo hay que redefinirlo (SPEC §3.6).
- **Aparece el tiempo como dimensión del dominio:** disponibilidad, fechas, cupos que se llenan y recordatorios que se disparan. Nada de eso existía en el modelo de datos.
- **Queda en el aire el modelo de evaluación.** La rúbrica, los tres momentos de medición, los tests y la calificación al capacitador (SPEC §3.3 a §3.5) no se mencionan en el acta, ni para confirmarlos ni para descartarlos. Están confirmados por la clienta desde el 2026-09-15, así que **siguen vigentes hasta que ella diga lo contrario**, pero hay que preguntárselo antes de construir los Slices 5 y 7: si un taller es una sesión presencial única, medir en tres momentos deja de tener un lugar evidente donde ocurrir.
- **El vocabulario del acta no es el del código.** Karina habla de *taller* y *facilitador*; la especificación y el código dicen *curso* y *capacitador*. Hay que decidir si se renombra el dominio, porque afecta tablas, endpoints y pantallas ya construidas.
