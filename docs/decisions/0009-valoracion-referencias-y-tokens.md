# ADR-0009: Valoración del encuentro, referencias públicas y tokens de reconocimiento

## Status
Propuesta — las salvaguardas de privacidad necesitan el visto bueno de la clienta (Q17)

## Date
2026-09-29

## Context
El mismo día de la reunión, la clienta agregó por WhatsApp una pieza que no estaba en el acta. En sus palabras:

> "debería haber algo dentro del dashboard que de puntuaciones a los matches: Si se reunieron o no / Si lograron reunirse en el día y hora acordado / Si la actividad fue como se la imaginaron / Si hacen match nuevamente con esa persona"

> "Y tal vez, para poder saber qué hizo que esto funcionara, que dejen una buena referencia del servicio o una especial de tokens de regalo a ese que enseñó"

Con un ejemplo concreto de la pantalla (claridad, seguridad percibida, aplicación, uso de materiales, asistencia y una referencia en texto libre marcada como "info pública"), y dos frases que fijan el rumbo:

> "Henry Cavill tokens ⭐ Visibles pero privados."

> "Así se puede usar la plataforma como: 1. Match corporativo 2. Gamificación corporativa"

Esto convierte la gamificación en un **segundo eje del producto**, no en un adorno. Y trae un elemento que el sistema no tenía: **texto libre escrito por una persona sobre otra persona identificada**, con intención de publicarse.

## Decision

### Se separa valorar el encuentro de valorar a la persona
Son dos cosas distintas y se guardan distinto:

- **Valoración del taller** (estrellas por dimensión + asistencia): alimenta el promedio del facilitador y el score de afinidad. Agregable, comparable.
- **Puntuación del match** (¿se reunieron?, ¿a la hora acordada?, ¿fue como esperaban?, ¿repetirían?): mide si el emparejamiento funcionó, que es lo que la clienta quiere entender. No es lo mismo que si el taller fue bueno.

Un match puede fallar (nunca se reunieron) sin que el taller sea malo, y al revés. Mezclarlos haría ilegible justamente el dato que la clienta pidió.

### Las referencias en texto libre llevan salvaguardas
La clienta las quiere públicas. Es texto libre sobre una persona identificada dentro de su trabajo, así que **entra de lleno en la Ley 21.719** y trae un riesgo que hasta ahora el sistema no tenía: una reseña negativa sobre un colega es un problema laboral, no un detalle de producto.

Propuesta, a confirmar (Q17):

- **Pública dentro de la empresa, nunca fuera de ella.** El aislamiento por empresa ya existe (ADR-0003) y aquí aplica igual.
- **Quien la escribe sabe que se publica con su nombre**, antes de escribirla. Una reseña anónima sobre un colega identificado es justo la combinación que invita al abuso.
- **RRHH puede ocultar una referencia**, y esa acción queda auditada. No se borra: se oculta, porque borrar evidencia de un conflicto laboral es peor que conservarla.
- **El aviso de privacidad tiene que declararlo** (Q3, que sigue pendiente con la clienta).
- Se escribe **después** del taller y sobre un taller al que la persona asistió.

### Los tokens son un contador de reconocimiento, sin valor canjeable
Hasta que la clienta aclare Q18, se modelan como un contador: cuántos recibió y por qué taller. **No se construye** ninguna economía, saldo, canje ni premio.

Si más adelante tuvieran valor real, aparecen problemas que hoy no existen: fraude (dos personas intercambiándose tokens), presión jerárquica sobre quién regala a quién, y consecuencias tributarias de un beneficio en especie. Ese es un producto distinto y se decide aparte.

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
- **Refuerza la duda sobre el modelo de evaluación (Q10).** Lo que la clienta describe mide *si el encuentro sirvió*, no *cuánto aprendió alguien*. Es una forma distinta de responder la misma pregunta de negocio, y hace más urgente saber si la rúbrica de tres momentos sigue en pie o si esto la reemplaza.
