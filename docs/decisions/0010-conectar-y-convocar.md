# ADR-0010: Conectar y convocar — se elimina el modelo de evaluación

## Status
Aceptada

## Date
2026-10-13

## Context
Desde el principio el producto tenía dos mitades: **conectar** personas que quieren enseñar y
aprender dentro de una empresa, y **medir** lo que pasaba después con una rúbrica de indicadores,
tres momentos de medición y tests por nivel. La clienta había confirmado esa segunda mitad en
detalle el 2026-09-15.

El acta del 2026-09-29 describió un taller presencial único y no mencionó la evaluación ni para
confirmarla ni para descartarla. El equipo dejó la duda registrada como Q9 y Q10 en vez de
construir sobre un supuesto, y se la preguntó. El 2026-10-13 la clienta respondió:

> "Hoy hice un estudio de esto y en verdad, los modelos chocan cuando hay mucho de capacitación
> tradicional. Por lo tanto, lo mejor es que sea sólo conectar y convocar."

Y sobre si las estrellas reemplazan la rúbrica:

> "si por el momento las remplaza, si no mas bien es para mostrar como las estadisticas de la
> clase, dar un feedback"

No es un recorte de alcance por tiempo: es la clienta diciendo que el modelo de capacitación
tradicional **estorba** al producto que quiere.

## Decision

### Desaparece el modelo de evaluación
Se eliminan del alcance, y no se construyen:

- Las etapas fijas **Diagnóstico → Clase → Monitoreo**.
- La **rúbrica**: indicadores, dimensiones por indicador, pesos que suman 100 y umbral de logrado.
- El **logro** total y por dimensión, y el **delta** entre momentos.
- Las **mediciones en tres momentos**.
- Los **tests** por nivel.

Con ellos caen Q4 (¿3 o 4 tests?) y el Slice 9 completo.

### En su lugar queda la valoración del encuentro
Las estrellas del ADR-0009 ocupan ese espacio, pero **no son lo mismo**: miden si el encuentro
sirvió y le dan feedback a quien enseñó. No dicen cuánto aprendió nadie, y la plataforma no va a
afirmar que lo dicen.

### Las tres dimensiones sobreviven, con otro papel
`HABILIDAD`, `CONTENIDO` y `ACTITUD` se quedan, pero solo donde ya se usan: en lo que cada persona
declara que puede enseñar o quiere aprender (Slice 4). Ahí sirven para **emparejar**, que es lo que
la clienta sí quiere. Dejan de ser ejes de medición.

### El vocabulario del código no cambia
La clienta respondió "dejémoslos como está" a renombrar `curso` y `capacitador` a `taller` y
`facilitador`. Se mantiene el vocabulario actual en el código y en la base; las pantallas siguen
hablando como habla ella.

### El producto se llama ENACTIVA
"Activa" en el acta era la transcripción, no un nombre nuevo: *"Que sea enactiva"*. Queda cerrada
Q12 y sigue en pie la regla de no inventar un nombre comercial.

## Alternatives Considered
- **Dejar la rúbrica como opcional, por si alguna empresa la quiere.** Es exactamente el choque que
  la clienta describe: una pantalla de evaluación formal al lado de un taller que se arma entre dos
  personas empuja el producto de vuelta al modelo tradicional. Y una función opcional que nadie
  pidió igual hay que construirla, probarla y mantenerla.
- **Guardar las tablas vacías por si vuelve.** Código muerto con forma de promesa. Si vuelve a
  pedirse, se decide de nuevo y con la información de ese momento.
- **Conservar los tests como autoevaluación sin nota.** No lo pidió nadie; sería inventar.

## Consequences
- **Se achica el MVP y baja el riesgo.** Lo que queda —conectar, convocar, agendar, valorar— es
  alcanzable en el semestre. La mitad que se elimina era la más grande y la más incierta.
- **El informe académico cambia su justificación.** El proyecto ya no se defiende como "medimos la
  evolución del aprendizaje en tres momentos", sino como "conectamos a quien sabe con quien quiere
  aprender dentro de la empresa, y medimos si ese encuentro funcionó". El equipo tiene que
  actualizar el relato de la fase 1, no solo el código.
- **Se pierde el número de aprendizaje.** Ya no habrá un porcentaje de logro que mostrar. Lo que
  RRHH verá son brechas, encuentros y valoraciones. Si más adelante quieren medir impacto, hay que
  volver a abrir esta decisión: la clienta dijo "por el momento".
- **Queda vocabulario huérfano en el código**: los enums `MOMENTOS` y `ETAPAS_CURSO` de
  `packages/shared` no los usa ninguna tabla todavía. Se eliminan en el mismo cambio, para que el
  código no siga describiendo un producto que ya no existe.
- **Las secciones §3.3 y §3.4 de la SPEC quedan vacías a propósito.** No se renumeran: otras
  secciones y varios comentarios del código las referencian, y borrar el número escondería que ahí
  hubo algo. Quedan como constancia de lo que se eliminó y por qué.
