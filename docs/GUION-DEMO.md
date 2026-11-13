# Guion de la presentación — viernes 23-10

Doce minutos, cuatro personas, el sistema corriendo de verdad. Lo que el profesor pidió ver:
pantallas, navegación, formularios, conexión con el backend y la base, y qué falta.

El paso a paso para levantar el sistema está en [DEMO.md](DEMO.md). Esto es **qué decir y qué
hacer** una vez que está arriba.

> **Regla de oro:** nunca abran el archivo `.env` en pantalla. Tiene los secretos de verdad.
> Si necesitan mostrar configuración, muestren `.env.example`.

---

## Antes de entrar a la sala (15 minutos antes)

```bash
docker compose up -d --wait
pnpm demo:reset          # deja los datos como recién instalados
pnpm dev                 # dejar esta terminal abierta
```

En otra terminal:

```bash
pnpm demo:check          # tiene que decir "Todo en orden: 12 revisiones"
```

Si algo sale en rojo, la terminal dice qué es y [DEMO.md](DEMO.md#cosas-que-pasan) cómo
arreglarlo. **No improvisen frente al curso: si falla, corran `pnpm demo:reset` y vuelvan a
empezar.** Son 15 segundos.

### Dejar el escritorio listo

- **Zoom del navegador al 125 %** (`Ctrl` + `+` dos veces). En un proyector, el tamaño normal
  no se lee desde atrás.
- **Cuatro pestañas abiertas**, en este orden: la plataforma (`localhost:5173`), Mailpit
  (`localhost:8025`), DBeaver, y la terminal de `pnpm dev`.
- **Notificaciones en silencio.** Windows: `Win` + `N` → activar "No molestar".
- **Sesión cerrada** en la plataforma, para empezar desde el login.
- Un archivo `personas-demo.csv` en el Escritorio (ver el bloque de Patricio).

### Las cuentas

Todas con la contraseña de `DEMO_PASSWORD` (está en [DEMO.md](DEMO.md#cuentas-de-la-demo)).

| Rol | Email |
|---|---|
| Admin Principal | `admin.principal@demo.enactiva.local` |
| RRHH | `rrhh@demo.plantanorte.local` |
| Facilitador | `facilitador@demo.plantanorte.local` |
| Participante | `participante@demo.plantanorte.local` |

Ténganlas escritas en un papel. Escribir un email largo frente al curso, con la cabeza en otra
cosa, es la forma más fácil de perder treinta segundos.

---

## Bloque 1 — Giovanni · 3 minutos

**Qué es esto y quién administra el piloto.**

### Lo que dices

> "ENACTIVA es una plataforma de capacitación entre pares: dentro de una misma empresa, quien
> sabe algo le enseña a quien quiere aprenderlo. Lo que hace el sistema es **conectar y
> convocar** — no aloja clases, el taller ocurre en persona. Esa definición nos la dio la
> clienta el 13 de octubre y cambió la mitad del alcance; vuelvo a eso al final."

### Lo que haces

1. **Login** como Admin Principal. *(Mientras escribes: "Hay cinco roles. Entro como el equipo
   de ENACTIVA, que administra el piloto completo.")*
2. Caes en **Empresas**. Señala los indicadores de arriba y las dos empresas con su estado.
3. Abre una empresa para mostrar la ficha con su contacto de RRHH.
4. **Crea una empresa en vivo**: botón `+ Agregar empresa`. Nombre, rubro y el email del
   contacto. Usa un email inventado, por ejemplo `rrhh@constructora-demo.cl`.
5. Cambia a la pestaña de **Mailpit** y abre el correo que acaba de llegar.

> "Esto no es una pantalla de ejemplo: el sistema mandó un correo real. Está en Mailpit, un
> servidor de correo local que usamos en desarrollo para no mandarle nada a nadie por error."

6. Abre el correo y muestra el enlace de activación. **No lo completes** — di que ese flujo lo
   verán en el bloque siguiente.
7. Pasa rápido por **Métricas** y **Equipo** para que se vea que existen, sin detenerte.

### Si te preguntan

- *¿Por qué dos tipos de administrador?* El Principal ve todo y activa empresas; el Operativo
  solo carga empresas e invita. Lo pidió la clienta para no darle sus dashboards a su equipo.
- *¿El correo sale de verdad?* En producción sí. En la demo lo captura Mailpit para que nada
  salga a internet.

---

## Bloque 2 — Patricio · 3 minutos

**El rol de RRHH: su gente y lo que su organización necesita aprender.**

### Lo que dices al tomar el control

> "Giovanni mostró el lado de ENACTIVA. Ahora entro como RRHH de una de las empresas, y van a
> ver que la plataforma es otra cosa."

### Lo que haces

1. **Cerrar sesión** y entrar como RRHH.
2. **Detente un segundo en las pestañas de arriba.** Antes decían Empresas, Métricas y Equipo;
   ahora dicen Mi perfil, Talleres y Personas.

> "No es que escondamos los botones: los permisos están en el servidor. Si escribo la URL de
> Empresas a mano, el sistema me manda a una pantalla de sin permiso."

3. **Hazlo**: escribe `localhost:5173/empresas` en la barra de direcciones. Cae en *Sin permiso*.
   Vuelve atrás.
4. Entra a **Personas**: la lista, las áreas, el estado de cada uno, quién tiene invitación
   pendiente.
5. **Importa el CSV**: botón `Importar CSV` y sube `personas-demo.csv`.

> "Antes de escribir nada en la base, el sistema muestra qué filas entrarían y cuáles no. Esta
> de aquí tiene el email mal escrito y esta otra un rol que no existe: las demás entran igual,
> no se pierde el archivo completo por un error."

6. Confirma la importación y muestra a la gente nueva en la lista.
7. Baja a la tarjeta **"Qué quiere aprender tu gente"**.

> "Esto es lo que la clienta quiere para decidir dónde invertir. *Inglés técnico* lo quieren
> aprender dos personas y **nadie** en la empresa puede enseñarlo: ahí hay que traer formación
> de afuera. *Excel avanzado*, en cambio, ya lo ofrece alguien de la casa."

### El archivo CSV

Créalo antes, en el Escritorio, con este contenido exacto:

```csv
email,roles,area,cargo
camila.rojas@demo.plantanorte.local,ESTUDIANTE,Operaciones,Operadora
pedro.silva@demo.plantanorte.local,ESTUDIANTE;CAPACITADOR,Mantención,Técnico
correo-malo,ESTUDIANTE,Operaciones,Ayudante
valentina.diaz@demo.plantanorte.local,JEFE,Calidad,Supervisora
```

Las dos primeras filas entran; la tercera falla por el email y la cuarta por el rol. **Esa es
la gracia**: se ve la validación fila por fila.

### Si te preguntan

- *¿Y si suben mil personas?* El archivo acepta hasta 500 filas por carga.
- *¿RRHH de una empresa ve a la otra?* No, y hay tests automáticos que lo comprueban en cada
  endpoint.

---

## Bloque 3 — Benjamín · 4 minutos

**El corazón: alguien publica un taller y otro se inscribe.**

### Lo que dices al tomar el control

> "Hasta aquí vimos quién administra. Ahora viene lo que hace la gente todos los días."

### Lo que haces

1. **Cerrar sesión** y entrar como **Facilitador**.
2. Entra a **Mi perfil**.

> "Cada persona declara dos cosas: qué puede enseñar y qué quiere aprender, con las dimensiones
> que definió la clienta — habilidad, contenido y actitud — y su nivel. Esto es lo que después
> alimenta el emparejamiento."

3. **Agrega un tema en vivo**: `+ Agregar tema` en "Quiero aprender". Escribe algo que no
   exista, por ejemplo `Power BI`, y usa el botón `+ Crear el tema`.

> "El catálogo es por empresa y busca antes de crear. Si cada uno escribiera el tema a mano,
> 'Excel', 'excel' y 'EXCEL avanzado' serían tres temas distintos y nadie haría match nunca."

4. Entra a **Talleres** y **publica uno en vivo** con `+ Publicar taller`:
   - Tema: *Excel avanzado*
   - Nombre: *Tablas dinámicas en una hora*
   - Fecha: la próxima semana · de 10:00 a 12:00
   - Dónde: *Sala de reuniones, segundo piso*
   - Cupo: **2** (importante: dos, para que se llene en vivo)
   - Objetivo y resultados: una línea cada uno
5. Muestra la ficha recién creada en "Los que dicto yo".
6. Abre **Mi disponibilidad** y agrega una franja. *(Lo pidió la clienta en la reunión: el
   facilitador declara cuándo puede enseñar.)*
7. **Cerrar sesión** y entrar como **Participante**.
8. En **Talleres**, busca el taller que Benjamín acaba de publicar y presiona **Inscribirme**.
   Señala cómo el contador pasa de `0 de 2` a `1 de 2`.
9. Baja hasta **"Qué hacer antes de que pase"**: está lleno y muestra **Sin cupos**, con el
   botón deshabilitado.

> "El cupo no es un adorno de la pantalla: lo decide el servidor dentro de una transacción. Si
> dos personas pelean por el último lugar al mismo tiempo, solo una entra."

### Si te preguntan

- *¿Puede inscribirse en su propio taller?* No, el servidor lo rechaza.
- *¿Puede editar el taller después?* Sí, mientras no haya empezado, y el cupo nunca baja por
  debajo de la gente ya inscrita.

---

## Bloque 4 — Nicolás · 3 minutos

**Cómo está hecho por dentro y qué falta.**

### Lo que dices al tomar el control

> "Todo lo que vieron es una aplicación React hablando con una API. Les muestro que no es una
> maqueta."

### Lo que haces

1. Con la plataforma abierta, presiona **F12** → pestaña **Red** (*Network*).
2. Recarga la pantalla de Talleres. Haz clic en la llamada `talleres`.

> "El navegador nunca habla con la base de datos. Habla con un **API Gateway** en el puerto
> 3000, que es la única puerta de entrada. Fíjense en el encabezado: va con un token de sesión,
> y el servidor decide qué puede ver esta persona."

3. Cambia a la **terminal de `pnpm dev`** y haz scroll.

> "Detrás del gateway hay cuatro microservicios: autenticación, identidad, talleres y matching.
> Cada uno con su propia base de datos. Partimos con un monolito y migramos en octubre, porque
> una falla en una parte no puede botar el sistema completo."

4. Abre **DBeaver** → `identity_db` → `public` → **Tables**.
5. Abre la tabla `taller` de `learning_db` y muestra **la fila del taller que Benjamín creó hace
   dos minutos**.

> "Ese es el taller que acaban de ver publicarse. No es un dato de ejemplo: nació en esta demo."

6. Si alcanzas, muestra `registro_auditoria`.

> "Cada acción sobre datos personales queda registrada, y la tabla es de solo escritura: la base
> rechaza borrar o modificar un registro. Es un requisito de la Ley 21.719."

### Lo que falta — dilo tú, antes de que lo pregunten

> "Lo que no está todavía: el **matching tipo swipe**, que es la siguiente etapa; la **agenda
> con recordatorios por correo**; y la **valoración del taller con estrellas y tokens**, que la
> clienta nos pidió por WhatsApp.
>
> Y algo que sí hicimos y vale la pena contar: el 13 de octubre la clienta nos sacó del alcance
> todo el modelo de evaluación — rúbricas, mediciones en tres momentos, tests. Nos dijo
> textualmente que *'los modelos chocan cuando hay mucho de capacitación tradicional'*. Era la
> mitad del trabajo que nos quedaba. Lo documentamos y rehicimos el plan."

---

## Preguntas probables y quién responde

| Pregunta | Responde | Respuesta corta |
|---|---|---|
| ¿Está conectado a una base de datos real? | Nicolás | Sí, PostgreSQL en Docker, una base por microservicio. Lo acabamos de mostrar. |
| ¿Cuánto del sistema está terminado? | Giovanni | Seis de nueve etapas. Lo que falta es matching, agenda y valoración. |
| ¿Tienen pruebas automáticas? | Nicolás | 274, y corren solas en cada cambio con GitHub Actions. |
| ¿Por qué microservicios para un proyecto así? | Nicolás | Es un requisito del equipo y está documentado; la clienta además lo preguntó en la reunión. |
| ¿Quién definió estos requisitos? | Giovanni | La clienta, Karina López, en dos reuniones y por WhatsApp. Todo está versionado en `docs/reuniones`. |
| ¿Cómo manejan los datos personales? | Patricio | Minimización: solo datos corporativos. Auditoría de solo escritura y aislamiento por empresa. |
| ¿Y si se cae internet en la sala? | Giovanni | Corre completo en el notebook. No necesita red. |

---

## Si algo se rompe en vivo

**No lo escondas.** Di "se nos cayó, lo levantamos en quince segundos" y hazlo. Un equipo que
sabe recuperarse se ve mejor que uno que improvisa una excusa.

| Qué pasa | Qué haces |
|---|---|
| Una pantalla queda cargando | `F5`. Si sigue, mira la terminal de `pnpm dev`. |
| "Demasiados intentos" al entrar | Esperaste poco entre logins. Espera un minuto. **Por eso no cierren sesión más veces de las que dice el guion.** |
| Los datos se ven raros | `pnpm demo:reset` en otra terminal. 15 segundos. |
| Un servicio no responde | `Ctrl+C` en `pnpm dev` y vuelve a correrlo. |
| Se cerró Docker | `docker compose up -d --wait` y después `pnpm dev`. |

---

## El reparto en una línea

| | Quién | Qué muestra | Minutos |
|---|---|---|---|
| 1 | Giovanni | Qué es, login, empresas, correo real en Mailpit | 3 |
| 2 | Patricio | RRHH, permisos por rol, carga CSV, brechas de formación | 3 |
| 3 | Benjamín | Perfil, publicar un taller, inscribirse, cupo lleno | 4 |
| 4 | Nicolás | API en DevTools, microservicios, base de datos, qué falta | 3 |

Trece minutos con los traspasos. Si los apuran: Patricio salta el CSV y Benjamín salta la
disponibilidad. Con eso quedan en diez.
