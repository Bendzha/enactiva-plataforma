# ADR-0009: Valoración del encuentro, referencias públicas y tokens de reconocimiento

## Status
Aceptada — la clienta respondió Q15 a Q18 el 2026-10-13 y aprobó las salvaguardas

## Date
2026-09-29 (actualizada el 2026-10-13 con las respuestas de la clienta)

## Context
El mismo día de la reunión, la clienta agregó por WhatsApp una pieza que no estaba en el acta. En sus palabras:

> "debería haber algo dentro del dashboard que de puntuaciones a los matches: Si se reunieron o no / Si lograron reunirse en el día y hora acordado / Si la actividad fue como se la imaginaron / Si hacen match nuevamente con esa persona"

> "Y tal vez, para poder saber qué hizo que esto funcionara, que dejen una buena referencia del servicio o una especial de tokens de regalo a ese que enseñó"

Con un ejemplo concreto de la pantalla (claridad, seguridad percibida, aplicación, uso de materiales, asistencia y una referencia en texto libre marcada como "info pública"), y dos frases que fijan el rumbo:

> "Henry Cavill tokens ⭐ Visibles pero privados."

> "Así se puede usar la plataforma como: 1. Match corporativo 2. Gamificación corporativa"

Esto convierte la gamificación en un **segundo eje del producto**, no en un adorno. Y trae un elemento que el sistema no tenía: **texto libre escrito por una persona sobre otra persona identificada**, con intención de publicarse.

## Lo que respondió la clienta (2026-10-13)
Las cuatro preguntas que este ADR dejó abiertas quedaron contestadas
(`docs/reuniones/2026-10-13-respuestas-karina.md`):

- **Q15 — quién puntúa el match:** *"Ambas personas, post primera reunion"*. Lo contestan las dos
  partes, después de que se reúnen por primera vez. Si solo una responde, el match igual queda
  puntuado por esa parte: la otra no puede quedar bloqueada esperando.
- **Q16 — las estrellas:** *"Son siempre esas 4, se pueden agrega o cambiar en un futuro"*. Claridad,
  seguridad, aplicación y uso de materiales son fijas en el MVP. Se guardan como **filas de datos y
  no como columnas de la tabla**, para que agregar una quinta más adelante no sea una migración.
- **Q17 — las referencias:** *"Claro, podria manejarse como temas sensibles"*. Confirma que se ven
  dentro de la empresa, que RRHH puede ocultarlas, y pide tratarlas como dato sensible. Las
  salvaguardas propuestas más abajo quedan aprobadas.
- **Q18 — los tokens:** *"para canjear cosas, pero la empresa ve que valene sos tokens nosotros solo
  por el momento damos el recuento"*. **Sí tienen valor**, pero el canje lo define y administra cada
  empresa **fuera de la plataforma**; nosotros llevamos la cuenta.

Esa última respuesta cambia una cosa importante: si el recuento vale algo afuera, deja de ser un
adorno. Se guarda como **registro auditado y no editable a mano** —se suma al valorar un taller y
de ninguna otra forma—, porque desde el momento en que alguien canjea con él, un número mal puesto
es un problema real. Lo que seguimos sin construir es la economía: saldo, canje, premios ni
transferencias entre personas.

## Decision

### Se separa valorar el encuentro de valorar a la persona
Son dos cosas distintas y se guardan distinto:

- **Valoración del taller** (estrellas por dimensión + asistencia): alimenta el promedio del facilitador y el score de afinidad. Agregable, comparable.
- **Puntuación del match** (¿se reunieron?, ¿a la hora acordada?, ¿fue como esperaban?, ¿repetirían?): mide si el emparejamiento funcionó, que es lo que la clienta quiere entender. No es lo mismo que si el taller fue bueno.

Un match puede fallar (nunca se reunieron) sin que el taller sea malo, y al revés. Mezclarlos haría ilegible justamente el dato que la clienta pidió.

### Las referencias en texto libre llevan salvaguardas
La clienta las quiere públicas. Es texto libre sobre una persona identificada dentro de su trabajo, así que **entra de lleno en la Ley 21.719** y trae un riesgo que hasta ahora el sistema no tenía: una reseña negativa sobre un colega es un problema laboral, no un detalle de producto.

Confirmadas por la clienta el 2026-10-13:

- **Pública dentro de la empresa, nunca fuera de ella.** El aislamiento por empresa ya existe (ADR-0003) y aquí aplica igual.
- **Quien la escribe sabe que se publica con su nombre**, antes de escribirla. Una reseña anónima sobre un colega identificado es justo la combinación que invita al abuso.
- **RRHH puede ocultar una referencia**, y esa acción queda auditada. No se borra: se oculta, porque borrar evidencia de un conflicto laboral es peor que conservarla.
- **El aviso de privacidad tiene que declararlo** (Q3, que sigue pendiente: es el único cabo suelto
  que queda de este ADR, y la clienta quedó de revisar ese texto).
- Se escribe **después** del taller y sobre un taller al que la persona asistió.

### Los tokens son un recuento auditado; el canje lo administra la empresa
Se modelan como un registro de cuántos recibió alguien y por qué taller. **No se construye**
ninguna economía dentro de la plataforma: ni saldo, ni canje, ni premios, ni transferencias.
La clienta lo dijo así: la empresa decide qué valen y nosotros damos el recuento.

Mantener el canje afuera no hace desaparecer los problemas de una moneda interna —fraude entre dos
personas que se regalan tokens, presión de una jefatura sobre a quién reconocer, el tratamiento
tributario de un beneficio en especie—, pero los deja donde la empresa puede manejarlos con sus
propias reglas. Si alguna vez el canje entra a la plataforma, eso es otro producto y se decide
aparte.

### Dónde vive
En **learning-service**, junto al taller y la inscripción: la valoración cuelga de un taller al que alguien asistió. El **matching-service** consulta el promedio del facilitador para el score de afinidad, por REST, como ya hace con el resto (ADR-0007).

La alternativa era ponerlo en matching-service, porque la clienta habla de "puntuar el match". Se descartó: el dato nace del taller y el matching solo lo lee.

## Alternatives Considered
- **Una sola nota global al taller**, como estaba antes (§3.5 original): es lo que la clienta acaba de reemplazar con un ejemplo detallado. Descartada por obsoleta.
- **Referencias anónimas**: quita el riesgo de conflicto, pero la clienta las quiere públicas y firmadas ("info pública", con el nombre arriba). Anonimizarlas además las vuelve inútiles para lo que ella busca: entender *qué hizo que funcionara*.
- **Sin texto libre, solo estrellas**: más seguro y mucho más pobre. La clienta pidió explícitamente la referencia escrita, y es donde está la información que las estrellas no capturan.
- **Tokens con valor canjeable desde la v1**: fuera de alcance mientras no haya respuesta sobre qué son. Construir una moneda interna sin reglas claras es la forma más rápida de tener que deshacerla.

## Consequences
- **Aparece moderación** como responsabilidad de RRHH. Es una función de producto que antes no existía, con su pantalla y su auditoría.
- **El score de afinidad se vuelve más rico**, pero también más sensible: una mala racha de valoraciones puede sacar a alguien del mazo. Hay que decidir si el score tiene piso, o el sistema castiga de más a quien empezó con mal pie.
- **Crece la superficie de datos personales.** Texto libre sobre personas identificadas es lo más delicado que va a guardar la plataforma; la exportación y supresión (Ley 21.719) tienen que incluirlo.
- **La gamificación pasa a ser un eje declarado del producto**, y eso pesa en el informe académico: cambia cómo se justifica el proyecto.
- **Reemplazó al modelo de evaluación.** Este ADR anticipó que lo que la clienta describe mide *si el encuentro sirvió* y no *cuánto aprendió alguien*. El 2026-10-13 ella confirmó que las estrellas reemplazan la rúbrica: ver ADR-0010.
