# Especificación — la plataforma (MVP piloto ENACTIVA)

**Estado:** Aprobada por el equipo (2026-09-15) · **Revisada con la clienta el 2026-09-29** · **Alcance cerrado el 2026-10-13** · **Correcciones de la clienta el 2026-10-29**
**Fuentes:** prompt de arquitectura del equipo, `docs/arquitectura-tecnica.md`, `docs/informe-fase1.docx`, `docs/mockup-sistema.html`, respuestas de la clienta (2026-09-15), **acta de la reunión con la clienta del 2026-09-29**, **respuestas de la clienta del 2026-10-13**, **reunión del 2026-10-29** (`docs/reuniones/2026-10-29-reunion-karina.md`).

> **Qué cambió el 2026-09-29.** La clienta aclaró que la plataforma **no aloja clases**: conecta
> personas dentro de una misma empresa y convoca a talleres que ocurren en persona (ADR-0008).
> Cae la subida de contenidos (§3.2, ADR-0006, Q6 y Q8) y aparecen la ficha del taller, el cupo,
> la ubicación, la disponibilidad horaria, la agenda y los recordatorios por correo.
> Quedan en duda las secciones de evaluación (§3.3 y §3.4): ver Q9 y Q10.
>
> **Ese mismo día, por WhatsApp,** la clienta agregó la valoración del encuentro, las referencias
> públicas y los tokens de reconocimiento: "Así se puede usar la plataforma como: 1. Match
> corporativo 2. Gamificación corporativa". Está en §3.5 y en el ADR-0009.

> **Qué cambió el 2026-10-13.** La clienta contestó las nueve preguntas abiertas y cerró el alcance.
> Lo más grande: **se elimina el modelo de evaluación** —etapas, rúbrica, logro, delta, mediciones y
> tests—. En sus palabras: *"los modelos chocan cuando hay mucho de capacitación tradicional. Por lo
> tanto, lo mejor es que sea sólo conectar y convocar"* (ADR-0010). Las secciones §3.3 y §3.4 quedan
> vacías a propósito. También quedó cerrado que el producto se llama **ENACTIVA**, que el código
> mantiene el vocabulario actual (curso, capacitador), y las respuestas sobre valoración,
> referencias y tokens (§3.5).

> **Qué cambió el 2026-10-29.** La clienta vio el sistema funcionando y corrigió sobre lo que tenía
> en pantalla. Nada de esto cambia la forma del producto; ajusta reglas y pantallas:
> el **catálogo de temas pasa a ser solo de RRHH**, y quien enseña **propone** por una solicitud
> que RRHH aprueba o rechaza (§3.2); lo mismo para **pasar de quien aprende a quien enseña** (§2);
> los **tokens** cambian de regla y dependen de una **lista de asistencia** que pasa quien dicta
> (§3.5); el recuento de tokens es **privado** (§3.5), lo que cierra la lectura abierta que el
> equipo había tomado; **cada empresa personaliza su entorno** con su logo y sus colores (§3.8 y
> ADR-0011), lo que **revierte** una decisión del equipo que estaba en §4; los roles se llaman
> **«Quien enseña»** y **«Quien aprende»** en pantalla; y el login tiene recuperación de
> contraseña. Detalle y citas textuales en `docs/reuniones/2026-10-29-reunion-karina.md`.

> Trazabilidad (mismo marco del informe): **[C]** confirmado por la clienta · **[S]** supuesto del equipo, por validar · **[P]** propuesta técnica del equipo · **[E]** decisión del equipo que la clienta delegó.
> `docs/requerimientos.xlsx` es **histórico** (describe el concepto previo de cartografía de red / simulador) y no es fuente de verdad.

---

## 1. Objetivo

Ecosistema de capacitación entre pares: colaboradores de una empresa enseñan a otros colaboradores de la **misma empresa** una habilidad, contenido o actitud que dominan. La plataforma **conecta y convoca** **[C, 2026-10-13]**: empareja a quien quiere aprender con quien puede enseñar (matching tipo swipe), convoca el taller presencial y recoge si el encuentro funcionó, para que ENACTIVA y RRHH decidan dónde invertir en desarrollo interno.

Lo que **no** hace: alojar clases (acta 2026-09-29) ni medir cuánto aprendió cada persona (2026-10-13, ADR-0010).

Piloto: 3–4 empresas. Equipo: 4–5 estudiantes. Plazo: un semestre.

## 2. Usuarios, roles y permisos

Una persona puede tener **varios roles a la vez** (ej. Capacitador y Estudiante) **[C]**.

| Rol | Alcance de datos | Qué hace |
|---|---|---|
| Admin ENACTIVA — **Principal** (Karina) | Todas las empresas | Todo lo del Admin Operativo + métricas/dashboards globales + gestión de otros admins **[C]** |
| Admin ENACTIVA — **Operativo** (equipo de Karina) | Todas las empresas | Cargar empresas, enviar/reenviar invitaciones **[C]**. **No** activa empresas **[C]**. **No** ve métricas ni dashboards **[C]** (la clienta lo plantea como necesidad futura; se diseña así desde ya) |
| RRHH | Solo su empresa | Dashboard y reportes de su empresa, con resultados individuales nominativos **[C]**; **es el único que crea temas** **[C, 2026-10-29]**; crea y elimina talleres **[C, 2026-10-29]**; resuelve las solicitudes de su empresa **[C, 2026-10-29]**; personaliza el entorno de su empresa (§3.8) **[C, 2026-10-29]**; oculta referencias **[C]** |
| Capacitador — **«Quien enseña»** en pantalla | Sus cursos | Publica la ficha de sus talleres, declara su disponibilidad **[C]** y **pasa la lista de asistencia** al terminar **[C, 2026-10-29]**. **Ya no crea temas**: los **propone** a RRHH (§3.2) **[C, 2026-10-29]**. ~~Carga contenido~~ (acta 2026-09-29) y ~~define rúbrica y evalúa~~ (2026-10-13, ADR-0010) |
| Estudiante — **«Quien aprende»** en pantalla | Lo propio | Declara intereses, hace swipe, se inscribe y valora el encuentro al final **[C]**. Puede **pedirle a RRHH el rol de quien enseña** **[C, 2026-10-29]**. ~~Rinde tests~~ (2026-10-13, ADR-0010) |

Los permisos se definen como un **mapa rol → permisos en código** (ver ADR-0003), no como tablas editables **[P]**.

**Los nombres de los roles son etiquetas de pantalla** **[C, 2026-10-29]**: *«los nuevos roles son
capacitador pasa a ser quien enseña y estudiante quien aprende»*. El código mantiene
`CAPACITADOR` y `ESTUDIANTE`, como quedó cerrado en Q11; lo que cambia es lo que lee la gente.
Renombrar los enums sería una migración de las tres bases para ganar nada **[P]**.

### Solicitudes a RRHH
Dos cosas que una persona ya no puede hacer sola y ahora pide **[C, 2026-10-29]**:

| Solicitud | Quién la hace | Qué pasa al aprobarla |
|---|---|---|
| **Proponer un taller o un tema** | Quien enseña | RRHH crea el taller y el tema **a mano**; la aprobación solo cambia el estado |
| **Pasar a «quien enseña»** | Quien aprende | RRHH le agrega el rol |

- **Aprobar crea el tema** en el catálogo y deja declarado a quien propuso, con las dimensiones y
  el nivel que esa persona eligió al proponer **[C, 2026-11-10]**. **El taller lo sigue creando
  RRHH a mano**, que es lo que la clienta pidió: *«allí RRHH tiene que crear el taller»*.
  > La primera versión no creaba nada, leyendo al pie de la letra *«el tema en sí»*. No servía:
  > RRHH aprobaba y después tenía que reescribir el tema, que es tomar la misma decisión dos
  > veces. Aprobar **es** el control de RRHH sobre el catálogo, así que lo ejecuta.
- Por eso la propuesta lleva **dimensiones y nivel** desde que se escribe **[P]**: sin ellos habría
  que inventarle un nivel a alguien al aprobar.
- El rechazo puede ir **con motivo o sin motivo** **[C]**.
- **Son flujos separados** **[C]**: *«sobre los roles que sean asuntos separados, no que puedan
  haber 2 en una solicitud»*. Una solicitud es de una cosa o de la otra.
- Hoy el único camino para pedir un tema es un texto dentro del diálogo de «quiero aprender /
  puedo enseñar» que dice «pídele a RRHH que lo agregue». La clienta lo dio por mal hecho:
  *«ya que ahora está mal y lo hace mediante la sección de que quiero aprender»* **[C]**.

## 3. Reglas de dominio

### 3.1 Empresas
- Estados: `ONBOARDING_PENDIENTE` → `ACTIVA`. El paso a Activa es **acción manual del Admin Principal** **[C]**.
- Rubro: texto libre **[C]**.
- Al agregar una empresa se crea la cuenta RRHH en estado `INVITADO` y se envía **correo real de invitación** **[C]**. El invitado completa su propio nombre y contraseña al activar **[P]** (minimización: el Admin solo ingresa el email).

### 3.2 Taller (llamado "curso" en el código)
> Reescrita el 2026-09-29 a partir del acta. **La plataforma no aloja clases** (ADR-0008): conecta
> personas y convoca a una actividad que ocurre **en persona**.

- El facilitador publica una **ficha del taller** con: nombre, fecha, horario, cupo, objetivo,
  resultados esperados y **ubicación de la actividad presencial** **[C, acta 2026-09-29]**.
- **RRHH también crea y elimina talleres de su empresa** **[C, 2026-10-29]**, y es quien crea el
  taller cuando aprueba una propuesta (§2).
- **Un taller es de una sola sesión** **[E, 2026-11-09]** mientras Q20 siga abierta.
- La ficha cuelga de un **tema del catálogo** de la empresa **[P]**: sin tema no habría con qué armar
  el mazo del swipe, que es por donde la gente busca (§3.6). El tema no se cambia después, porque
  quien se inscribió lo hizo por ese tema.
- El taller se edita **mientras no haya empezado**, y el cupo nunca baja por debajo de la gente ya
  inscrita **[P]**: dejar a alguien fuera sin avisarle no es editar, es cancelarle.
- La **inscripción** es del tamaño del cupo y de nadie más: al llenarse, el taller deja de aceptar
  gente **[C, acta 2026-09-29]**. Quien se arrepiente puede cancelar y libera su lugar **[P]**.
- **No hay contenidos que subir.** Sin archivos, sin almacenamiento, sin descargas **[C, acta 2026-09-29]**.
  El ADR-0006 queda reemplazado por el ADR-0008.
- **Cupo máximo: sí existe** **[C, acta 2026-09-29]**. Corrige la respuesta del 2026-09-15 ("sin cupo
  máximo"): un taller presencial tiene el límite físico de la sala.
- **Disponibilidad horaria del facilitador**: declara cuándo puede enseñar, y los participantes lo ven
  **[C, acta 2026-09-29]**.
- **Agenda y recordatorios por correo** para facilitador y participantes **[C, acta 2026-09-29]**.
- La agenda junta en una sola lista **lo que dicta y a lo que va** cada persona **[P]**: quien enseña también aprende, y dos pantallas para "el martes a las 10 tengo algo" serían pedirle a la gente que lleve la cuenta en su cabeza. Lo que viene primero y el historial abajo, que es donde la valoración va a colgar (Slice 8).
- **Dos recordatorios por taller** **[E — decisión del equipo, 2026-10-25]**: uno el día antes, para reorganizar la agenda, y otro una hora antes, que es el que hace que la gente llegue. Las ventanas no se solapan: un taller publicado media hora antes recibe solo el de una hora.
- Los manda un **reloj dentro de learning-service** que despierta cada pocos minutos **[P]**. Es lo primero del sistema que ocurre sin que nadie lo pida. Si el servicio está caído a esa hora, ese correo no sale: es el costo de no tener una cola, y para un piloto es aceptable.
- ~~Etapas fijas **Diagnóstico → Clase → Monitoreo**~~ ⛔ **Eliminadas el 2026-10-13** **[C]**: *"lo mejor
  es que sea sólo conectar y convocar"*. El taller es una actividad única (ADR-0010). Q9 resuelta.

> **Q10 resuelta el 2026-10-13: §3.3 y §3.4 se eliminan.** La clienta confirmó que las estrellas de
> §3.5 reemplazan la rúbrica: *"si por el momento las remplaza, si no más bien es para mostrar como las
> estadísticas de la clase, dar un feedback"*. Ver ADR-0010.

### 3.3 Rúbrica y logro — ⛔ eliminada el 2026-10-13

La rúbrica, los pesos, el umbral, el logro por dimensión y el delta entre momentos **ya no son parte
del producto** (ADR-0010). La clienta lo pidió así: el modelo de capacitación tradicional choca con
conectar y convocar.

Lo que ocupa su lugar es la **valoración del encuentro** (§3.5), que mide si el taller sirvió, no
cuánto aprendió alguien. Lo que sí sobrevive de aquí son las **tres dimensiones** (habilidad,
contenido, actitud), pero solo en el perfil de cada persona (§3.6): ahí sirven para emparejar.

El número se conserva sin renumerar a propósito: hay secciones y comentarios del código que apuntan
aquí, y borrarlo escondería que existió.

### 3.4 Tests — ⛔ eliminados el 2026-10-13

Los tests por nivel caen junto con el resto del modelo de evaluación (ADR-0010). Con ellos queda
anulada Q4.
### 3.5 Valoración del encuentro y reconocimiento

> Reescrita el 2026-09-29 con lo que la clienta mandó por WhatsApp ese mismo día, después de la
> reunión. Reemplaza la nota única que había antes. Ver ADR-0009.

La clienta lo resumió así: **"Así se puede usar la plataforma como: 1. Match corporativo
2. Gamificación corporativa"** **[C]**.

#### Qué se pregunta al cerrar un taller
Al terminar, el participante valora el encuentro **[C]**. La clienta dio este ejemplo textual:

```
HENRY CAVILL
Taller sobre arreglos de CPU

Claridad                    ⭐⭐⭐⭐
¿Me sentí seguro en el taller?  ⭐⭐⭐⭐⭐
Aplicación                  ⭐⭐⭐⭐
Uso de materiales           ⭐
Mi asistencia al taller     ✅

Referencia (info pública): volveré al taller 2 porque ahora quiero
arreglar unos lentes de META.
```

- **Dimensiones en estrellas** **[C]**: claridad, seguridad percibida, aplicación y uso de
  materiales. **Escala de 1 a 5** **[C, 2026-10-24]**. **Son siempre esas
  cuatro** **[C, 2026-10-13]**: *"Son siempre esas 4, se pueden agrega o cambiar en un futuro"*, así que
  se guardan como datos y no como columnas, para que sumar una quinta no sea una migración. Q16 resuelta.
- ~~**Asistencia**, marcada por el participante~~ ⛔ **Movida el 2026-10-29**: la pasa **quien
  dicta**, en la lista de asistencia de más abajo. El formulario de valoración ya no la pregunta.
- **Referencia en texto libre**, declarada **"info pública"** por la clienta **[C]**. Se ve **dentro de
  la empresa**, firmada por quien la escribe, y **RRHH puede ocultarla dejando registro** **[C,
  2026-10-13]**: *"Claro, podria manejarse como temas sensibles"*. Q17 resuelta; las salvaguardas del
  ADR-0009 quedan aprobadas. Falta el aviso de privacidad que lo declare (Q3).

#### Cómo se puntúa el match
La clienta pidió que el dashboard puntúe **el match en sí**, no solo al facilitador **[C]**:

| Pregunta | Fuente |
|---|---|
| ¿Se reunieron o no? | WhatsApp 2026-09-29 |
| ¿Lograron reunirse en el día y hora acordados? | WhatsApp 2026-09-29 |
| ¿La actividad fue como se la imaginaron? | WhatsApp 2026-09-29 |
| ¿Volverían a hacer match con esa persona? | WhatsApp 2026-09-29 |

Las contestan **ambas personas, después de la primera reunión** **[C, 2026-10-13]**: *"Ambas personas,
post primera reunion"*. Si solo una responde, el match queda puntuado con esa respuesta: la otra parte
no puede dejar a nadie esperando **[P]**. Q15 resuelta.

#### Lista de asistencia
> Nueva el 2026-10-29. Existe porque de ella dependen los tokens: *«hay que hacer un sistema de
> asistencia con las personas inscritas»* **[C]**.

- **La pasa quien dicta**, al terminar el taller, sobre la lista de sus inscritos **[C, 2026-10-29]**.
- **Reemplaza la asistencia que declaraba el participante** sobre sí mismo —el ✅ del ejemplo de
  §3.5— **[P]**. Dos respuestas distintas a «¿fuiste?» dejarían el recuento de tokens en disputa
  justo cuando empezó a valer algo fuera de la plataforma, y la de quien dicta es la que la empresa
  reconocería.
- Cerrar la lista es lo que **paga los tokens**, en una sola transacción **[P]**, y ocurre **una
  vez**: un recuento que se puede recalcular es un recuento que se puede cambiar.
- **La lista solo la ve quien dicta** **[P]**. A cualquier otro se le responde **404 y no 403**:
  un 403 confirmaría que ese taller existe y quién lo dicta.

#### Tokens de reconocimiento
> Reescrita el 2026-10-29. La regla anterior —uno por taller con al menos una valoración— era del
> equipo **[E]** porque la clienta no había dicho cuántos. Ahora lo dijo, y esto la reemplaza.

La clienta lo dio así, textual **[C, 2026-10-29]**:

> *«Tokens por asistencia solamente se dará tokens al completar el curso con asistencia del 100%,
> y al capacitador se le darán tokens por inscripción: 2 tokens si son menos de 5, +1 token
> adicional si todas las personas que se inscribieron asisten»*

Dejaba dos huecos, que contestó preguntada:

| Situación | Tokens | Fuente |
|---|---|---|
| Quien enseña, **menos de 5 inscritos** | 2 | **[C]** |
| Quien enseña, **5 o más inscritos** | 3 | **[C, preguntado]** |
| Quien enseña, **asistieron todos los inscritos** | +1 | **[C]** |
| Quien aprende, **asistió** | 1 | **[C, preguntado]** |
| Taller **sin inscritos** | 0 | **[P]** |

- **Se pagan al cerrar el taller, una sola vez, y no dependen de cuántas sesiones tenga**
  **[C, 2026-11-10]**: *«los tokens se entregan al final de cada taller […] si un taller tiene 2
  sesiones se entregan solamente los tokens totales; ejemplo, si vale 1 se entrega 1 independiente
  que tenga 2 sesiones, igual para quien enseña»*. El número se fija por **taller**, nunca por
  sesión, así que partir un taller en dos no multiplica el reconocimiento. Deja la regla de tokens
  **inmune al multi-sesión** de Q20.

- **Un taller sin inscritos no paga**, aunque «menos de 5» lo incluiría literalmente **[P]**: pagar
  por un taller al que no fue nadie haría el recuento inflable publicando talleres vacíos.
- El recuento se guarda como **una fila por (taller, persona, motivo)** **[P]**: así siempre se
  puede explicar de dónde salió cada token, y corregir un error es borrar una fila y nunca editar
  un número.
- **El recuento es privado** **[C, 2026-10-29]**: *«los tokens tienen que ser privados»*. Cada
  quien ve el suyo y RRHH el de su empresa. Cierra la lectura abierta que el equipo había tomado
  de *«visibles pero privados»*.
- **Sirven para canjear cosas, pero el canje lo administra cada empresa fuera de la plataforma**
  **[C, 2026-10-13]**: *"para canjear cosas, pero la empresa ve que valene sos tokens nosotros solo por
  el momento damos el recuento"*. Q18 resuelta.
- La plataforma lleva **el recuento y nada más**: ni saldo, ni canje, ni premios, ni transferencias
  entre personas **[P]**.
- Como afuera valen algo, el recuento es un **registro auditado**: se suma al valorar un taller y de
  ninguna otra forma; nadie lo edita a mano **[P]**.

#### Lo que se conserva del modelo anterior
- El facilitador se sigue midiendo por **talleres dictados** y por la valoración que recibe **[C]**.
- La valoración alimenta el **score de afinidad** del matching (§3.6) **[P]**, pero **desde la
  tercera valoración** **[E]**: con una o dos el criterio no participa y su peso se reparte entre
  los demás. Sin ese piso, una sola opinión mala hundiría a alguien en el mazo para siempre, que
  es el riesgo que dejó anotado el ADR-0009.
- ~~"El capacitador ve el promedio, no quién calificó qué"~~ ⛔ **Cae a medias**: la clienta confirmó que
  la referencia se publica dentro de la empresa y va firmada (Q17). Las estrellas sí se muestran como
  promedio **[P]**: el detalle por persona no aporta y expone a quien valoró.

### 3.6 Matching
- Solo dentro de la **misma empresa** **[C]**.
- Grafo: nodos = personas; arista potencial = A enseña tema T y B quiere aprender T (se calcula); arista decidida = `Match` (se guarda) **[P]**.
- Cada tarjeta del swipe es **facilitador + taller convocado** **[C]**, con su fecha, su cupo y su lugar. Al mazo entran los talleres **que todavía no ocurren y tienen cupo** **[P]**: sin etapas, no hay otro estado que filtrar (Q9 resuelta, ADR-0010).
- Like = **inscripción inmediata** al taller, sin aprobación del facilitador **[C]**. Descarte = no se vuelve a mostrar esa tarjeta **[P]**. Al llenarse el cupo el taller sale del mazo **[P, acta 2026-09-29]**.
- **El mazo esconde lo descartado, no lo aceptado** **[P]**: un taller al que la persona entró no aparece porque ya está inscrita, y de eso sabe learning. Si cancela su inscripción, la tarjeta **vuelve**. Vale su última decisión.
- Score de afinidad simple (sin ML) con **todos** los criterios **[C]**: dimensiones coincidentes, nivel, área, valoración del capacitador. Pesos iniciales iguales, constantes en código, ajustados con datos reales **[C]**.
- **Un criterio que todavía no existe no participa del promedio** **[P]**: la valoración llega con el Slice 8, y hasta entonces su peso se reparte entre los otros tres en vez de arrastrar a todos con un cero que no significa nada.
- **Misma área suma** **[E — decisión del equipo, 2026-10-24]**: preguntada, la clienta respondió que las dos opciones le parecían bien. Se mantiene el supuesto porque el taller es presencial y coordinarse en el mismo piso es una ventaja real; quien está en otra área igual aparece, más abajo. Son dos constantes en `apps/matching-service/src/afinidad/score.ts`.
- El mazo **se arma en cada consulta y no se guarda** **[P]**: un mazo guardado envejece solo —el cupo se llena, el taller ocurre— y mostraría tarjetas que ya no existen. Lo único que se guarda es la decisión.
- Cada tarjeta **explica en una línea por qué apareció ahí** **[P]**: si el orden no se puede explicar, nadie confía en él.
- Catálogo de temas: ~~lo crean Admin, RRHH y Capacitador~~ → **solo RRHH** **[C, 2026-10-29]**. Quien enseña lo **propone** por una solicitud (§2). Temas **por empresa**, con nombre normalizado único y buscador que sugiere existentes antes de crear **[P]** (evita duplicados que romperían el matching).

#### Perfil corporativo (construido en el Slice 4)
- Cada persona declara, sobre un tema del catálogo de su empresa, que **puede enseñarlo** o que **quiere aprenderlo** **[C]**. Un mismo tema admite las dos cosas: enseñar Excel no impide querer aprenderlo mejor **[P]**.
- Cada declaración lleva **una o más dimensiones** (habilidad, contenido, actitud) **[P]**, que es lo que hace calculable el criterio "dimensiones coincidentes" del score.
- Y un **nivel** —cuánto domina quien enseña, desde dónde parte quien aprende—. La escala de tres pasos (básico, intermedio, avanzado) es **[S]**, ver Q19.
- El perfil guarda además los **intereses generales** en texto libre **[C, acta 2026-09-29]**: la clienta pidió recoger datos corporativos y limitar los personales. No hay biografía, foto ni teléfono **[P]**.
- El cargo y el área los administra RRHH; la persona los ve pero no los edita **[P]**.
- Cada quien gestiona **solo su propio perfil**: el usuario sale del token verificado y nunca de la URL **[P]**.
- Sobre estas declaraciones se calculan las **métricas de intereses** que la clienta pidió ver cuando la gente registrara sus temas **[C, acta 2026-09-29]**: cuánta gente tiene perfil, qué se ofrece, qué se busca y las **brechas** (temas que alguien quiere aprender y nadie de la empresa puede enseñar). Son agregados: nunca dicen quién declaró qué **[P]**.

### 3.7 Privacidad y cumplimiento (Ley 21.719)
- Registro de auditoría append-only desde el Slice 0 **[C]**. Guarda la acción, la entidad y los **nombres** de los campos tocados, nunca su contenido **[P]**: así sobrevive a la supresión sin volver a identificar a nadie.
- **Exportación y supresión de datos por usuario** **[C]**, y las ejerce la persona sola desde «Mi perfil» **[P]**: un derecho que depende de que alguien conteste un correo no es algo que la persona pueda ejercer.
- Los datos de alguien viven repartidos en tres bases que no se ven entre sí (ADR-0007), así que ninguna de las dos operaciones cabe en un servicio: el **gateway** le pregunta a cada uno por `/interno/datos-personales` y junta las respuestas **[P]**. Es lo único que el gateway compone en vez de reenviar.
- En los tres servicios el usuario sale del **token verificado**, nunca de la URL **[P]**: aunque el gateway se equivocara, nadie puede exportar ni borrar los datos de otro.
- La exportación se entrega como **archivo descargable** con un aviso dentro de qué incluye y qué no **[P]**: quien lo abre tiene que entender qué tiene en la mano.
- La supresión **anonimiza en vez de borrar la fila** de la persona **[P — requisito legal]**: se van su nombre, su correo, su contraseña, su perfil, sus declaraciones, sus inscripciones, su disponibilidad y sus decisiones del mazo; su id queda porque de él cuelgan cosas de otros (los talleres que dictó, donde otros se inscribieron, y el registro de auditoría). Conservar algo **ligado** a la persona no sería supresión; conservarlo **desvinculado** sí es lo que la ley pide.
- El orden importa y está fijado: identity va **al final**. Apenas anonimiza la cuenta la sesión muere, y cualquier llamada posterior dejaría datos a medio borrar **[P]**. Si un servicio no responde, no se borra nada y la cuenta sigue en pie.
- Una cuenta del equipo ENACTIVA no se suprime desde ahí **[P]**: si el único Admin Principal se borrara, nadie podría volver a administrar el piloto. Sí puede exportar.
- La frase `ELIMINAR MI CUENTA` hay que escribirla **[P]**: un botón solo es muy poco para algo irreversible.
- RRHH ve la participación nominativa **[C]** → el aviso de privacidad lo declara explícitamente, y esas lecturas se auditan **[P]**. El texto del aviso sigue siendo **borrador** y debe aprobarlo ENACTIVA (Q3).
- Minimización: no se recolecta RUT, teléfono, fecha de nacimiento ni foto **[P]**.
- HTTPS obligatorio. Sin cifrado a nivel de campo (rompe agregaciones); se reevalúa si se agregan comentarios libres **[P]**.

### 3.8 Personalización por empresa
> Nueva el 2026-10-29. **Revierte** la decisión del equipo que listaba «colores por empresa» en §4
> como fuera de alcance. Ver **ADR-0011**.

- Cada empresa personaliza **su logo y cuatro colores** **[C]**, y **lo hace RRHH** de esa empresa
  **[C]**: *«todo lo hace RRHH de cada empresa»*.
- Alcanza **solo a su propio entorno** **[C]**: *«eso no cambiará ni el login ni las demás empresas
  ni ENACTIVA»*. El login queda fuera porque es anterior a la sesión —nadie sabe aún de qué empresa
  es quien mira— y porque la clienta lo cerró aparte: *«déjemelos como están»*.
- Es **opcional**: quien no personaliza se queda con la plantilla actual, que pasa a ser el valor
  por omisión **[C]**.
- **El contraste no se fuerza** **[C]**: *«da igual que los colores se contrasten, eso lo tienen
  que ver ellos»*. El formulario avisa cuando un color queda ilegible, pero no bloquea **[E]**.
- Lo único que se valida es que el color sea **hexadecimal** **[P]**: de ahí sale una variable CSS,
  y un valor libre sería una inyección en la hoja de estilos.
- Se considera personalizada solo con **los cuatro colores** **[P]**: media paleta aplicada sería
  una pantalla a medio pintar, peor que la plantilla entera. Los dos tonos derivados del principal
  se **calculan** y no se piden.
- El logo va como **data URI** en la base, limitado a PNG, JPEG o WebP **[P]**. Para un piloto de
  3–4 empresas con un logo cada una no vale la pena reabrir el almacenamiento de archivos que el
  ADR-0008 eliminó. SVG queda fuera: admite código y no vale la pena discutirlo por un logo.
- **Cerrar sesión despinta y vacía lo cacheado** **[P]**: si no, la siguiente persona que entra en
  el mismo equipo —un turno de planta comparte el computador— hereda los colores, y con ellos
  cualquier otro dato que siguiera en memoria.

### 3.9 Sesión y «mantener sesión iniciada»
> La casilla la pidió la clienta en el boceto del login (2026-10-29). Preguntada por cuánto debía
> durar, respondió: *«lo más seguro que se pueda de momento»* **[C, 2026-11-10]**.

- **No se construye un «recordarme» largo.** La casilla **no alarga nada**: decide si la cookie de
  refresh **sobrevive al cierre del navegador** o muere con él **[E, a partir de [C]]**.
- Sin marcar —**el valor por omisión**— la sesión termina al cerrar el navegador.
- Marcada, dura lo que ya dura el refresh (`REFRESH_TTL_DIAS = 7`), sin extenderse.
- **Esto endurece lo que hay hoy**, no lo relaja: hoy no existe la casilla y la cookie se emite
  siempre con vencimiento a 7 días, así que la sesión sobrevive al cierre del navegador **para
  todo el mundo**. Es la opción menos segura y es la actual.
- Importa por dónde se usa: un turno de planta comparte el computador, y una sesión que sigue
  abierta para el turno siguiente es la cuenta de otra persona **[P]**.

## 4. Fuera de alcance
**Alojar clases o material: la plataforma no es un Moodle** **[C, acta 2026-09-29]** ·
**Medir cuánto aprendió alguien: rúbrica, tests, logro y delta** **[C, 2026-10-13, ADR-0010]** · LMS con catálogo ·
IA generativa de contenidos · SaaS multi-tenant · certificación externa.

~~Colores por empresa (paleta fija `#00347A` / blanco / `#FFB627`)~~ ⛔ **Sale de aquí el
2026-10-29**: la clienta pidió lo contrario y ahora está en §3.8 (ADR-0011). Era una decisión del
equipo que nunca se le preguntó.

**Límites de cursos por empresa o por persona:** la clienta **preguntó si existían**, no pidió que
existieran **[C, 2026-10-29]**. No se construye nada hasta que diga cuántos y de qué.

**Exportar el dashboard a PDF y Excel:** fuera de alcance **por ahora** **[C, 2026-11-10]**: *«nada
de exportar todavía»*. El «todavía» es suyo, así que no se declara muerto, pero no se construye.

Las métricas globales avanzadas (patrones de intereses entre empresas, detección de oportunidades de
nuevos servicios) quedan para **una fase posterior**: las métricas actuales del panel le bastan a la
clienta para la primera versión **[C, acta 2026-09-29]**.

## 5. Estructura del proyecto
Ver ADR-0001 y **ADR-0007** (microservicios; migración terminada el 2026-09-28). Resumen:
```
apps/api-gateway       único punto de entrada del frontend
apps/auth-service      emisión y rotación de JWT
apps/identity-service  empresas, personas, invitaciones, temas y correo
apps/learning-service  talleres, agenda y (si sigue en alcance) rúbricas y mediciones
apps/matching-service  motor de matching
apps/web               React + Vite + TanStack Query + shadcn/ui
packages/shared        Zod schemas, tipos, enums y permisos compartidos
packages/service-kit   infraestructura común de los servicios (no la usa el navegador)
docs/                  specs/, decisions/ (ADRs), material de la clienta
tasks/                 plan.md (slices, tareas y fases de la migración)
```
El reparto de datos entre servicios, y lo que se pierde al separarlos, está en ADR-0007.

## 6. Comandos (se habilitan en Slice 0)
```bash
corepack enable                                # pnpm vía corepack (Node 24 LTS)
pnpm install
docker compose up -d                           # Postgres + Mailpit
cp .env.example .env                           # completar secretos y SEED_ADMIN_*
pnpm --filter identity-service db:deploy
pnpm --filter identity-service db:seed
pnpm dev                                       # web, gateway y los cuatro servicios
pnpm lint && pnpm typecheck && pnpm test
```

## 7. Estilo de código
- TypeScript estricto en todo el monorepo; ESLint + Prettier compartidos.
- **Dominio en español** (`Empresa`, `Taller`, `Rubrica`, `logroTotal`), **términos técnicos en inglés** (`Controller`, `Service`, `Guard`, `dto`). El nombre definitivo de la entidad depende de Q11.
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
- **Backend:** Vitest (unitario, ver ADR-0005) para reglas de dominio — score de matching, cupo, promedios de valoración — con cobertura alta en esas funciones; Supertest (e2e) contra Postgres real para cada endpoint.
- **Obligatorio en e2e:** por cada endpoint, casos 401 (sin token), 403 (rol sin permiso) y **acceso cruzado entre empresas** (RRHH de A no ve datos de B).
- **Frontend:** React Testing Library sobre Vitest para formularios y flujos por rol.
- CI (GitHub Actions) corre lint, typecheck y tests en cada PR.

## 9. Límites
**Siempre:** trabajar en vertical slices; auditar escrituras y lecturas de datos personales; test de scoping por empresa en cada endpoint nuevo; marcar datos sintéticos como demostración.
**Preguntar primero:** cambios al modelo de datos; reglas de matching, valoración o permisos; nuevas dependencias de pago; cualquier requisito no presente en esta spec.
**Nunca:** inventar reglas de negocio o un nombre comercial; mostrar métricas inventadas como reales; guardar contraseñas o tokens en claro; construir lo listado en §4.

## 10. Criterios de éxito del MVP
1. Admin crea una empresa, el contacto RRHH recibe la invitación por correo y activa su cuenta.
2. Una persona hace like a un taller de su empresa y queda inscrita, respetando el cupo.
3. Un facilitador publica la ficha de un taller y tanto él como los inscritos lo ven en su agenda y reciben el recordatorio por correo.
4. Tras un taller, quien asistió lo valora con estrellas, deja su referencia y el facilitador recibe sus tokens.
5. ~~RRHH ve el dashboard de su empresa, con las puntuaciones de los matches, y lo exporta a PDF y
   Excel.~~ → **Reescrito el 2026-11-10** **[C]**: *«todo el dashboard se ve dentro de el admin de
   Karina, nada de exportar todavía»*. Queda así: **el Admin Principal ve, dentro de su panel, las
   puntuaciones de los matches y las valoraciones agregadas, empresa por empresa.** Sin exportar.
   ⚠️ **Es el único de los siete sin cumplir:** las puntuaciones del match se guardan pero no se
   agregan en ninguna pantalla. La **exportación a PDF y Excel sale de alcance** por ahora, y RRHH
   mantiene las métricas de intereses de su empresa, que ya existen.
6. Ningún usuario puede leer datos de otra empresa (verificado por tests e2e).
7. Un usuario puede exportar sus datos y solicitar supresión; toda acción queda en auditoría.

~~8. Un facilitador evalúa con su rúbrica en los 3 momentos~~ ⛔ eliminado el 2026-10-13 (ADR-0010).

## 11. Preguntas abiertas

El 2026-10-13 la clienta contestó las nueve que bloqueaban el desarrollo
(`docs/reuniones/2026-10-13-respuestas-karina.md`). Lo que queda abierto no frena construir.

| # | Pregunta | Bloquea |
|---|---|---|
| Q1 | Nombre del dominio de ENACTIVA y quién administra su DNS (para SPF/DKIM). **Por ahora todo se trabaja en local** (correos en Mailpit); se define al publicar | Despliegue público |
| **Q3** | **Texto del aviso de privacidad y de los términos legales.** Karina quedó de revisarlo (acta 2026-09-29) y pidió avanzar con un texto de ejemplo mientras tanto (2026-10-24). El texto real tiene que declarar las referencias públicas entre colegas (Q17) y los tokens **antes** de que alguien escriba la primera | Publicación |

| Q13 | ¿Cómo se enlaza con la web de ENACTIVA: botón de acceso, redirección, o software aparte? Karina quedó de averiguarlo. El 2026-10-29 mencionó que tiene hosting en **HostNet** | Despliegue público |
| Q14 | Modelo comercial: ¿se vende la aplicación completa o se incorpora una empresa como cliente? Quedó pendiente en el acta | Fuera del MVP |
| Q20 | **Talleres de varias sesiones:** queda por saber **si se pasa lista por sesión** y si el 100% de asistencia se mide sobre todas. La parte de los tokens ya está contestada (§3.5) y el multi-sesión sigue **diferido**, así que no frena nada | Volver a tocar la asistencia |

### Cerradas

| # | Cómo quedó |
|---|---|
| ~~Q2~~ | ✅ 2026-09-15: el Admin Operativo solo carga empresas e invita; no activa |
| ~~Q4~~ | ⛔ Anulada 2026-10-13: no hay tests ni delta (ADR-0010) |
| ~~Q6~~ | ⛔ Anulada 2026-09-29: no hay contenidos; el facilitador publica una ficha (ADR-0008) |
| ~~Q7~~ | ⛔ Anulada 2026-10-13: no hay rúbrica, así que no hay umbral (ADR-0010) |
| ~~Q8~~ | ⛔ Anulada 2026-09-29: sin archivos no hay espacio que limitar |
| ~~Q9~~ | ⛔ 2026-10-13: **las tres etapas desaparecen**. "Lo mejor es que sea sólo conectar y convocar" (ADR-0010) |
| ~~Q10~~ | ⛔ 2026-10-13: **la rúbrica, las mediciones y los tests salen de alcance**. Las estrellas los reemplazan y son feedback, no medición de aprendizaje (ADR-0010) |
| ~~Q11~~ | ✅ 2026-10-13: no se renombra. El código sigue con `curso` y `capacitador` |
| ~~Q12~~ | ✅ 2026-10-13: el producto se llama **ENACTIVA**. "Activa" era la transcripción |
| ~~Q15~~ | ✅ 2026-10-13: las cuatro preguntas del match las contestan **ambas personas, después de la primera reunión** |
| ~~Q16~~ | ✅ 2026-10-13: las cuatro dimensiones en estrellas son fijas, con espacio para sumar otras más adelante |
| ~~Q17~~ | ✅ 2026-10-13: la referencia se ve dentro de la empresa, firmada, y RRHH puede ocultarla; se trata como dato sensible (ADR-0009) |
| ~~Q18~~ | ✅ 2026-10-13: los tokens sirven para canjear, pero **el canje lo administra cada empresa fuera de la plataforma**; aquí solo se lleva el recuento (ADR-0009) |
| ~~Q19~~ | ✅ 2026-10-13: la escala de nivel queda en básico / intermedio / avanzado |
| ~~Q5~~ | ✅ 2026-10-24: las estrellas van **de 1 a 5** |
| ~~Q21~~ | ✅ 2026-11-10: **son dos documentos**. El equipo redactó el borrador de los T&C (`docs/legal/terminos-y-condiciones-borrador.md`) a pedido de la clienta, para que ella se haga una idea. Pendiente de revisión legal y de la aprobación de ENACTIVA |
| ~~Q22~~ | ✅ 2026-11-10: **el dashboard va dentro del admin de Karina** y **no se exporta**: *«todo el dashboard se ve dentro de el admin de Karina, nada de exportar todavía»*. El PDF y el Excel salen de alcance por ahora; el criterio 5 de §10 se reescribe |
| ~~Q23~~ | ✅ 2026-11-10: *«lo más seguro que se pueda de momento»*. Sin «recordarme» largo: la casilla decide si la cookie de refresh **sobrevive al cierre del navegador** y nada más (§3.9). Hoy sobrevive siempre, 7 días, así que esto **endurece** lo que hay |
