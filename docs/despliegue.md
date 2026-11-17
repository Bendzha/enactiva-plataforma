# Despliegue

Cómo se pone esta plataforma en un servidor. Describe lo que el código **exige** hoy; lo que
todavía no está decidido está marcado como abierto y no se inventa aquí.

> **Lo que falta para publicar de verdad:** el dominio de ENACTIVA y el acceso a su DNS (SPEC Q1),
> el hosting —la clienta mencionó **HostNet** (Q13)— y el **texto legal aprobado** del aviso de
> privacidad y de los términos (Q3). Lo último no es un detalle: la plataforma guarda texto libre
> de una persona sobre otra identificada, y los dos textos que hay son **borradores del equipo**.
> Hasta que ENACTIVA apruebe los definitivos, esto se despliega en un entorno de prueba, no al
> público.

---

## Qué se despliega

Seis procesos y un sitio estático (ADR-0007):

| Proceso | Puerto por defecto | Base de datos | ¿Público? |
| --- | --- | --- | --- |
| `api-gateway` | 3000 | — | **Sí, el único** |
| `auth-service` | 3101 | — | No |
| `identity-service` | 3102 | `identity_db` | No |
| `learning-service` | 3103 | `learning_db` | No |
| `matching-service` | 3104 | `matching_db` | No |
| `web` (Vite) | — | — | Sí, archivos estáticos |

La web habla **solo** con el gateway. Los cuatro servicios no se exponen: el gateway es la puerta
de calle y además bloquea cualquier ruta que contenga `/interno/`, que es como conversan entre
ellos. Ese bloqueo es la segunda línea, no la primera: **los servicios no deben ser alcanzables
desde fuera**, ni siquiera para llegar a su `/health`.

---

## Requisitos del servidor

- **Node** en la versión de [`.nvmrc`](../.nvmrc) y **pnpm** (ver `packageManager` en
  [`package.json`](../package.json)).
- **PostgreSQL 18**.
- Un **servidor SMTP** real. En local es Mailpit, que no manda nada a internet (ADR-0004); en el
  servidor hace falta uno de verdad, con SPF y DKIM del dominio de ENACTIVA (Q1) para que las
  invitaciones no caigan en spam.
- **HTTPS**, con un proxy inverso (Nginx, Caddy o el que ofrezca el hosting) delante del gateway.

---

## Construir

```bash
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` deja cada servicio en su `dist/` y la web en `apps/web/dist`. Cada servicio arranca
con su propio script:

```bash
pnpm --filter api-gateway start      # node dist/main.js
```

La web son archivos estáticos: los sirve el proxy inverso, no Node. **Se construye apuntando al
gateway público**, porque la URL de la API se incrusta en el bundle:

```bash
VITE_API_URL=https://api.ejemplo.cl pnpm --filter web build
```

---

## Configuración

Todas las variables están documentadas en [`.env.example`](../.env.example). Un solo `.env` en la
raíz lo leen los seis procesos, a propósito: el secreto del JWT tiene que ser **el mismo** en
todos, y mantener seis copias de la misma variable es la mejor forma de que se desincronicen sin
que nadie se dé cuenta.

Lo que **cambia** respecto de local:

| Variable | En el servidor |
| --- | --- |
| `NODE_ENV` | `production`. **No es cosmético**: la cookie de refresh sale con `Secure` solo con este valor, y sin él viaja por HTTP en claro |
| `WEB_ORIGIN` | El origen real de la web, con `https://`. Es lo que autoriza CORS con cookies; si no calza, el navegador no manda la cookie y nadie puede entrar |
| `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `INTERNO_SECRETO` | Generados para este servidor, mínimo 32 caracteres, distintos entre sí y distintos de los de desarrollo |
| `DATABASE_URL_*` | Las tres bases, cada una con **su** rol y su contraseña propia |
| `URL_*_SERVICE` | Las direcciones internas, alcanzables solo desde el servidor |
| `PROXIES_DELANTE_DEL_GATEWAY` | `1` con un proxy inverso delante. Ver «Proxy inverso» |
| `SMTP_HOST`, `SMTP_PORT`, `CORREO_DESDE` | El servidor de correo real |
| `DEMO_PASSWORD`, `PERMITIR_RESET_DEMO` | **No van.** Ver «Lo que nunca va al servidor» |

Generar un secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

El `.env` **no se versiona** y nunca se ha versionado (ADR-0003). Si el hosting ofrece un gestor
de variables de entorno, mejor ahí que en un archivo.

---

## Base de datos

Tres bases y tres roles, uno por servicio (ADR-0007). El script
[`docker/postgres/00-bases.sql`](../docker/postgres/00-bases.sql) muestra la forma exacta: roles
separados, `REVOKE CONNECT` sobre las bases ajenas, y cada base con su dueño. **No se copia tal
cual**: sus contraseñas son de desarrollo y están en el repositorio.

Dos diferencias con local:

- Los roles **no llevan `CREATEDB`**. Ese permiso existe en local solo porque `prisma migrate dev`
  crea una base sombra para comparar el esquema; en el servidor se usa `migrate deploy`, que no la
  necesita.
- El `REVOKE CONNECT` deja de ser una comodidad y pasa a ser la red de seguridad: aunque alguien
  equivoque un `DATABASE_URL`, el rol de un servicio no puede conectarse a la base de otro.

Migraciones, en cada despliegue y **antes** de arrancar los procesos nuevos:

```bash
pnpm --filter identity-service db:deploy
pnpm --filter learning-service db:deploy
pnpm --filter matching-service db:deploy
```

`db:deploy` es `prisma migrate deploy`: aplica lo que falte y no borra nada. **Nunca** se usa
`db:migrate` ni `db:reset` en un servidor: el primero compara esquemas y puede pedir reescribir, y
el segundo borra la base entera.

### El primer Admin Principal

```bash
pnpm --filter identity-service db:seed
```

Lee `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del entorno. Esa contraseña **no se escribe en
ningún archivo del repositorio** y se cambia desde la aplicación apenas se entra la primera vez.

---

## Proxy inverso

Lo mínimo que tiene que hacer:

1. Terminar TLS y servir `apps/web/dist` en el dominio de la web.
2. Reenviar la API al gateway, conservando la ruta: la cookie de refresh está acotada a `/auth`,
   así que si el proxy reescribe ese prefijo, deja de viajar y las sesiones se caen al recargar.
3. Mandar `X-Forwarded-For` con la IP de quien pide.
4. **No** publicar los puertos 3101–3104.

Y en el `.env`, **`PROXIES_DELANTE_DEL_GATEWAY=1`**: uno por ese proxy. De ahí sale cuánto de la
cabecera se cree cada proceso, y con eso la IP que ve la aplicación. Importa en dos lados:

- **La auditoría.** Sin el número correcto, todos los registros dicen la dirección del gateway y
  no sirven para saber desde dónde se hizo nada (Ley 21.719).
- **El límite de intentos de login, que es por IP.** Si todas las peticiones parecen venir del
  mismo lugar, deja de proteger una cuenta y pasa a dejar fuera a toda la empresa en cuanto
  alguien escriba mal su contraseña cinco veces.

El número es **cuántos proxies hay delante del gateway**, no cuántos hay en total: los servicios
suman solo el gateway por su cuenta. Poner más de los que hay es peor que poner cero, porque
entonces cualquiera escribe la cabecera y se inventa la IP que quiera.

---

## Respaldos

```bash
pg_dump "$DATABASE_URL_IDENTITY" > identity-AAAA-MM-DD.sql
```

Las tres bases, por separado.

> **Los respaldos no van al repositorio.** `identity_db` contiene los **hashes de contraseña** de
> todas las cuentas y los datos personales de la gente de las empresas cliente. Van a un lugar
> cifrado, fuera de Git, con acceso restringido. Un `.sql` olvidado en una carpeta del proyecto es
> una filtración esperando que alguien haga `git add .`.

La tabla de auditoría es **append-only por un trigger de Postgres** (Ley 21.719): un respaldo no
la reemplaza ni la corrige, y restaurar uno viejo encima de una base viva **pierde** el registro
de todo lo que pasó en medio.

---

## Lo que nunca va al servidor

- **`pnpm demo:reset`**, que borra y recrea las tres bases. Exige `PERMITIR_RESET_DEMO=si` en el
  `.env` justamente para que no pueda correr por accidente; esa línea no existe en el servidor.
- **Las cuentas de demo** (`docs/DEMO.md`) y `DEMO_PASSWORD`. Son de juguete, su contraseña está
  escrita en un archivo del repositorio y todas la comparten.
- **Mailpit.** Captura los correos sin mandarlos: en el servidor, las invitaciones no llegarían a
  nadie.

---

## Comprobar que quedó bien

```bash
curl https://api.ejemplo.cl/health          # 200, dice qué servicio contestó
curl https://api.ejemplo.cl/identity/interno/sesiones/actual   # 404: nunca se expone
curl -I https://api.ejemplo.cl              # sin cabeceras de servidor de desarrollo
```

Y en el navegador, iniciando sesión: la cookie `refresh_token` tiene que aparecer con **`Secure`**,
`HttpOnly`, `SameSite=Lax` y `Path=/auth`. Si falta `Secure`, `NODE_ENV` no quedó en `production`.

Después, el recorrido de [`docs/DEMO.md`](DEMO.md) sirve igual para verificar un servidor: crear
una empresa, recibir la invitación **en el correo real**, activarla y entrar.
