# Reunión con la clienta — 2026-10-29

**Participantes:** Karina López Fuentealba (ENACTIVA) y el equipo.
**Formato:** se le mostró el sistema funcionando tal como estaba en `main` y ella fue dando
feedback sobre lo que veía en pantalla.

Este documento se armó con las notas que tomó el equipo durante la reunión y con las
**aclaraciones posteriores de contexto** (2026-11-09 y 2026-11-10), que son las que resolvieron
qué quería decir cada punto. Donde la aclaración cambió lo que parecía pedido en la reunión, se
deja dicho.

---

## 1. Inicio de sesión

La clienta mandó un boceto de cómo quiere el login. De ahí salen:

- La estructura en dos columnas y el nombre **«ENACTIVA Match»** en pantalla.
- «Entro como» para elegir por dónde entrar.
- **«¿Olvidaste tu contraseña?»** y **«Probar un match»** son lo que ella marcó como
  *«primordial»* del boceto.
- **«Mantener sesión iniciada»**.
- El resto de lo que aparece en el boceto es **decorativo**: *«Son solamente cosas decorativas
  del login nada que ver con lo interno»*.

Los colores del login **no se tocan**: *«déjemelos como están»*. La personalización de cada
empresa no alcanza al login (ver punto 6).

## 2. Los logros por empresa

*«Logros por empresa revisarlo»*. Era el «Logro promedio — aún sin mediciones» que quedaba
reservado en cuatro pantallas desde el Slice 1. Es un resto del modelo de evaluación que ella
misma eliminó el 2026-10-13 (ADR-0010), así que contradecía su propia decisión. **Se quitó.**

## 3. El catálogo de temas y las solicitudes

*«Solo recursos humanos tiene que crear los temas, por lo que se debería crear un sistema de
solicitud para que un capacitador proponga un taller; RRHH puede crear, eliminar, etc. talleres»*.

El permiso ya se movió: `temas:crear` es solo de RRHH. Lo que **falta** es el sistema de
solicitudes, y así quedó definido:

- Quien enseña **propone**; RRHH **aprueba o rechaza**.
- Al aprobarse, la solicitud solo cambia de estado: **el taller y el tema los crea RRHH a mano**
  después. La aprobación no crea nada por sí sola.
- El rechazo **puede ir con motivo o sin motivo**.
- Hoy el único camino para pedir un tema es el diálogo de «quiero aprender / puedo enseñar», que
  solo muestra un texto diciendo «pídele a RRHH que lo agregue». La clienta lo dio por **mal
  hecho**: *«ya que ahora está mal y lo hace mediante la sección de que quiero aprender»*.

## 4. Cambio de rol

*«Poder cambiar roles de estudiante a capacitador mediante una solicitud a RRHH»*.

Es un **flujo aparte** del de proponer un taller: *«sobre los roles que sean asuntos separados, no
que puedan haber 2 en una solicitud»*. Una solicitud es de una cosa o de la otra, nunca de las dos.

## 5. Tokens y asistencia

La regla que ella dio, textual:

> *«Tokens por asistencia solamente se dará tokens al completar el curso con asistencia del 100%,
> y al capacitador se le darán tokens por inscripción: 2 tokens si son menos de 5, +1 token
> adicional si todas las personas que se inscribieron asisten»*

Preguntada por los dos huecos que dejaba, respondió:

- Quien aprende recibe **1 token** por asistir.
- Con **5 o más inscritos**, quien enseña recibe **3**.

Esto obligó a construir una **lista de asistencia**: *«hay que hacer un sistema de asistencia con
las personas inscritas»*. La pasa quien dicta, y reemplaza el ✅ que antes marcaba quien aprendía
sobre sí mismo.

**Los tokens son privados:** *«los tokens tienen que ser privados»*. Cierra la lectura abierta que
el equipo había tomado de *«visibles pero privados»*; cada quien ve el suyo y RRHH el de su empresa.

## 6. Personalización por empresa

*«Personalización en el entorno de empresas de RRHH»*, aclarado así:

> *«Lo que pensé yo es que la empresa pueda personalizar todo su entorno pero algo básico;
> nosotros le dejamos la plantilla ya como está ahora y ellos deciden si personalizar. Todo lo
> hace RRHH de cada empresa.»*

Y sobre el alcance:

> *«Cada empresa podrá personalizar solo su entorno […] eso no cambiará ni el login ni las demás
> empresas ni ENACTIVA»*

- Lo personalizable: **el logo y entre 3 y 4 colores**.
- Lo hace **RRHH de cada empresa**, no ENACTIVA.
- La plantilla actual es el punto de partida y el que no personaliza se queda con ella.
- **El contraste es problema de la empresa:** *«da igual que los colores se contrasten, eso lo
  tienen que ver ellos»*.

Esto **contradice la SPEC §4**, que listaba «colores por empresa» como fuera de alcance con una
paleta fija. Ver **ADR-0011**.

## 7. Ley de protección de datos

*«Ley de protección de datos: botón para aceptar los términos y condiciones; ENACTIVA solo debe
visualizar métricas»*.

Sobre lo segundo, la aclaración lo bajó de requisito a comentario:

> *«Esto solo fue como una aclaración, no te lo tomes tan a fondo, ya que ENACTIVA en sí, en el
> admin de Karina, solo ve métricas y obviamente tiene que tener los correos y empresas activas»*

**No hay cambio que hacer:** el equipo de ENACTIVA ya ve métricas, empresas y el estado de sus
invitaciones, y nada del detalle de las personas de cada empresa.

Lo del **botón de términos y condiciones sigue abierto** (ver «Lo que quedó sin resolver»).

## 8. Visualización de inscripciones

La clienta pidió poder ver las inscripciones. Hoy se ve el **recuento** («7 de 12 inscritos») en
Talleres y en la Agenda, y los **nombres** solo dentro de «Pasar lista», al cerrar el taller.
Si quería la lista con nombres antes del taller, falta.

## 9. Los nombres de los roles

*«Los nuevos roles son: capacitador pasa a ser quien enseña, y estudiante, quien aprende»*.

Son **etiquetas de pantalla**: el código mantiene `CAPACITADOR` y `ESTUDIANTE`, como quedó cerrado
en Q11. Una persona puede tener los dos roles a la vez, que ya era así.

## 10. Talleres de varias sesiones

Salió en la reunión, y quedó **diferido** por el equipo: *«si va a quedar para después, luego te
confirmo eso; por mientras hay que dejarlo por 1 sesión o como está»*.

## 11. Límites de cursos

Karina **preguntó si existía algún límite**, no pidió uno. No hay nada que construir: *«esto
ignóralo, solo fue Karina que consultó si existía algún límite»*.

## 12. Hospedaje

La clienta mencionó **HostNet** como el hosting que tiene. No se decidió nada técnico; queda
atado a Q1 (dominio y DNS) y a la fase M4.

---

## Lo que quedó sin resolver

Cuatro preguntas del equipo sin respuesta de la clienta. Ninguna frena construir las solicitudes
ni la personalización, pero las dos primeras **sí frenan publicar**.

| # | Pregunta |
|---|---|
| Q20 | **Talleres de varias sesiones:** ¿se pasa lista por sesión? ¿El 100% es de todas? ¿Los tokens se pagan al cerrar la última? Cambia qué es «un taller», así que conviene saberlo antes de tocar la asistencia otra vez |
| Q21 | **Los términos y condiciones: ¿son otro documento que el aviso de privacidad?** Si son dos, son dos aceptaciones con dos versiones, y hay que decidir si a quien ya aceptó se le vuelve a pedir |
| Q22 | **El dashboard exportable del criterio 5 de SPEC §10** («las puntuaciones de los matches, exportado a PDF y Excel»): se escribió antes de que cayera el modelo de evaluación. ¿Sigue en pie, y con qué contenido? |
| Q23 | **¿Cuánto dura «mantener sesión iniciada»?** Es una decisión de seguridad: en un equipo compartido de planta, un «recordarme» largo deja la sesión de alguien abierta para el turno siguiente |

Q3 (el texto real del aviso de privacidad) sigue abierta desde el 2026-09-29 y es la que bloquea
publicar, porque el Slice 8 ya guarda texto libre de una persona sobre otra identificada.
