# Demo presencial — ENACTIVA

Cómo dejar la plataforma funcionando en un computador cualquiera, desde un clon limpio, y cómo
volver a dejarla como estaba si algo se tuerce en medio de la presentación.

**Probado el 2026-10-21** en Windows 11, clonando el repositorio de cero. Lo que falló durante
esa prueba está anotado en [Cosas que pasan](#cosas-que-pasan).

---

## Lo que tiene que estar instalado

| | Versión | Cómo verificar |
|---|---|---|
| Node | 24.x (está en `.nvmrc`) | `node --version` |
| pnpm | 12.4.2 | `pnpm --version` |
| Docker Desktop | cualquiera reciente, **corriendo** | `docker info` |
| Git | cualquiera | `git --version` |

Si falta pnpm: `npm install -g pnpm@12.4.2`.

**Docker tiene que estar abierto antes de empezar.** En Windows, Docker Desktop tarda un minuto
largo en levantar su motor; si `docker info` da error, espera a que el icono deje de animarse.

---

## Levantar todo

**Medido el 2026-10-21:** 1 minuto y medio desde `git clone` hasta la plataforma respondiendo,
en un computador que ya tenía las imágenes de Docker descargadas y el almacén de pnpm con las
dependencias. En un computador recién instalado hay que sumarle lo que tarde en bajar unos
500 MB de imágenes y el `pnpm install` completo: cuenta **20 o 30 minutos con buena conexión**.

Por eso conviene dejar todo descargado antes (ver [Demo sin internet](#demo-sin-internet)).

### 1. Clonar e instalar

```bash
git clone https://github.com/Bendzha/enactiva-plataforma.git
cd enactiva-plataforma
pnpm install
```

`pnpm install` descarga las dependencias y genera los clientes de Prisma. Es el paso más lento:
la primera vez toma varios minutos.

### 2. Crear el `.env`

```bash
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

Abre el `.env` y completa **cuatro** valores. Los tres secretos se generan así (corre el comando
tres veces y pega un valor distinto en cada uno):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

```ini
JWT_ACCESS_SECRET=<pega el primero>
REFRESH_TOKEN_PEPPER=<pega el segundo>
INTERNO_SECRETO=<pega el tercero>

DEMO_PASSWORD=Demo-Enactiva-2026
```

`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` son **opcionales**: sirven para crear un Admin
Principal tuyo. La demo ya trae el suyo, así que puedes dejarlos vacíos.

> `DEMO_PASSWORD` es la contraseña de todas las cuentas de demo y es de juguete: no uses ninguna
> contraseña real. El repositorio es público.

### 3. Levantar Postgres y Mailpit

```bash
docker compose up -d --wait
```

La primera vez descarga dos imágenes. `--wait` no devuelve el control hasta que ambas están sanas.

### 4. Crear las tablas

Cada servicio tiene su propia base, así que cada uno aplica sus migraciones:

```bash
pnpm --filter identity-service db:deploy
pnpm --filter learning-service db:deploy
```

> `matching-service` no aparece porque todavía no tiene tablas: llegan con el Slice 6. No falta
> un paso.

### 5. Sembrar los datos de la demo

```bash
pnpm demo:seed
```

Deja dos empresas, diez personas, siete temas, once declaraciones de perfil, tres talleres con
sus inscripciones y la disponibilidad de dos facilitadores. Correrlo de nuevo no duplica nada.

> El seed **agrega y actualiza, pero no borra**. Si alguien edita `tools/demo/datos.ts` y quita
> algo, ese dato sigue en la base hasta que corras `pnpm demo:reset`.

### 6. Arrancar la plataforma

```bash
pnpm dev
```

Levanta seis procesos en la misma terminal: el frontend, el gateway y los cuatro servicios.
**Déjala abierta**; para apagar todo, Ctrl+C.

### 7. Comprobar que quedó lista

En **otra** terminal:

```bash
pnpm demo:check
```

Revisa los cinco procesos, Mailpit, el frontend, el login y los datos sembrados. Si algo está
mal, lo dice y termina con error. Espera hasta 30 segundos por cada servicio, así que puedes
correrlo apenas arranques `pnpm dev`.

---

## Dónde queda cada cosa

| | URL |
|---|---|
| **La plataforma** | http://localhost:5173 |
| Gateway (lo único que usa el navegador) | http://localhost:3000 |
| Bandeja de correo (Mailpit) | http://localhost:8025 |
| auth-service | http://localhost:3101/health |
| identity-service | http://localhost:3102/health |
| learning-service | http://localhost:3103/health |
| matching-service | http://localhost:3104/health |

---

## Cuentas de la demo

Todas usan la contraseña que pusiste en `DEMO_PASSWORD` (arriba: `Demo-Enactiva-2026`).

| Rol | Email | Qué puede mostrar |
|---|---|---|
| Admin Principal | `admin.principal@demo.enactiva.local` | Empresas del piloto, métricas globales, gestión de admins |
| Admin Operativo | `admin.operativo@demo.enactiva.local` | Carga empresas e invita, **sin** métricas ni activación |
| RRHH | `rrhh@demo.plantanorte.local` | Su gente, el CSV, y qué quiere aprender su organización |
| Facilitador | `facilitador@demo.plantanorte.local` | Su perfil, sus talleres, su disponibilidad |
| Participante | `participante@demo.plantanorte.local` | Declarar intereses e inscribirse en un taller |

Hay cinco personas más en las empresas de demo, con la misma contraseña, que existen para que
los cupos y las métricas no muestren siempre "1 de 1".

**Ninguna de estas cuentas es real.** El Admin Principal de verdad, si lo creaste, usa las
credenciales de tu `.env` y no están en este documento a propósito.

---

## Un recorrido que funciona

> Para la presentación del 23-10, el guion con el reparto por persona, los tiempos y las
> preguntas probables está en [GUION-DEMO.md](GUION-DEMO.md).

1. **Admin Principal** → *Empresas*: las dos del piloto, con su estado y su gente.
2. Crear una empresa en vivo → el correo de invitación llega a http://localhost:8025.
3. **Admin Principal** → *Métricas*: perfiles completos, temas, declaraciones y **brechas** por
   empresa. Las brechas son temas que alguien quiere aprender y nadie puede enseñar.
4. **RRHH** → *Personas*: la lista, y abajo "Qué quiere aprender tu gente" con esas mismas
   brechas. *Inglés técnico* lo quieren dos personas y no lo enseña nadie.
5. **Facilitador** → *Mi perfil*: lo que puede enseñar y lo que quiere aprender.
6. **Facilitador** → *Talleres*: publicar una ficha nueva (fecha, cupo, lugar) y su disponibilidad.
7. **Participante** → *Talleres*: inscribirse en "Excel para turnos". El contador sube.
   "Qué hacer antes de que pase" ya está lleno: muestra que el cupo manda.

---

## Si algo se rompe en medio

```bash
pnpm demo:reset
```

Borra las tres bases, las vuelve a crear, aplica las migraciones y siembra de nuevo. Tarda unos
15 segundos y deja la demo igual que recién instalada.

Para que corra hay que tener esto en el `.env`:

```ini
PERMITIR_RESET_DEMO=si
```

Es a propósito: el comando es destructivo y se lleva también el registro de auditoría. No se
pueden borrar solo las filas de demo, porque la auditoría es append-only y la base rechaza los
DELETE (ADR-0002).

No hace falta apagar `pnpm dev`: lo probamos con todo corriendo y los servicios se reconectaron
solos. Si algo responde raro después de un reset, reinicia `pnpm dev` y listo.

> **Hay un solo Postgres por computador**, compartido por cualquier copia del repositorio que
> tengas. Un reset borra las bases para todas: si además trabajas en otra carpeta del proyecto,
> vas a tener que volver a correr su `pnpm --filter identity-service db:seed`. Nos pasó probando
> esto y dejó los tests en rojo hasta que lo notamos.

---

## Cosas que pasan

**"Demasiados intentos" al entrar (HTTP 429).** El login permite 5 intentos por minuto y por IP.
Si corriste `pnpm demo:check` varias veces seguidas, el siguiente login falla aunque la
contraseña esté bien. Espera un minuto, o sube el límite en el `.env` de la máquina de la demo:

```ini
LOGIN_INTENTOS_POR_MINUTO=20
```

**El puerto ya está ocupado.** Si una sesión anterior dejó un proceso vivo, el servicio nuevo no
arranca y el navegador sigue viendo el viejo. En Windows:

```powershell
Get-NetTCPConnection -LocalPort 3000,3101,3102,3103,3104,5173 -State Listen |
  Select-Object LocalPort, OwningProcess
Stop-Process -Id <el PID> -Force
```

**`docker compose up` falla.** Docker Desktop no está corriendo, o todavía está partiendo.

**La página se va al login al recargar.** Ya está arreglado, pero si aparece: significa que la
sesión se cortó sola. Vuelve a entrar.

**Los talleres se ven con fechas viejas.** El seed calcula las fechas relativas al día en que se
corre. Si sembraste hace una semana, corre `pnpm demo:seed` otra vez.

---

## Respaldo de las bases

**Los respaldos NO van al repositorio.** Traen hashes de contraseña y datos personales. Guárdalos
fuera del proyecto (un pendrive, una carpeta en Documentos); `.gitignore` ya bloquea `respaldos/`
y los `*.dump` por si acaso.

### Exportar

Dentro del contenedor y copiando el archivo después, para que la consola no toque el contenido:

```bash
mkdir -p ../respaldos-enactiva
docker compose exec -T postgres pg_dump -U enactiva -d identity_db -Fc -f /tmp/identity.dump
docker compose exec -T postgres pg_dump -U enactiva -d learning_db -Fc -f /tmp/learning.dump
docker compose exec -T postgres pg_dump -U enactiva -d matching_db -Fc -f /tmp/matching.dump
docker compose cp postgres:/tmp/identity.dump ../respaldos-enactiva/identity.dump
docker compose cp postgres:/tmp/learning.dump ../respaldos-enactiva/learning.dump
docker compose cp postgres:/tmp/matching.dump ../respaldos-enactiva/matching.dump
```

En PowerShell es lo mismo, cambiando `mkdir -p` por `New-Item -ItemType Directory -Force` y las
barras por `\`. **En Windows conviene usar PowerShell para esto.**

> **Si usas Git Bash en Windows**, `/tmp/identity.dump` no llega así al contenedor: Git Bash lo
> convierte en una ruta de Windows y `pg_dump` falla con "could not open output file". Antepón
> `MSYS_NO_PATHCONV=1` a cada comando que lleve una ruta del contenedor:
>
> ```bash
> MSYS_NO_PATHCONV=1 docker compose exec -T postgres pg_dump -U enactiva -d identity_db -Fc -f /tmp/identity.dump
> ```

> **No uses `pg_dump ... > archivo.sql` en PowerShell.** La redirección de PowerShell guarda el
> archivo en UTF-16 y `psql` después no lo puede leer. Por eso el dump se escribe dentro del
> contenedor y se copia con `docker compose cp`: así nadie reinterpreta el contenido.

### Importar

```bash
docker compose cp ../respaldos-enactiva/identity.dump postgres:/tmp/identity.dump
docker compose exec -T postgres pg_restore -U enactiva -d identity_db --clean --if-exists /tmp/identity.dump
```

Igual para `learning_db` y `matching_db`. Probado el 2026-10-21: borramos todos los talleres y
sus inscripciones, restauramos el respaldo y volvieron los tres talleres con sus siete inscritos.

Si la base no existe, créala antes:

```bash
docker compose exec -T postgres psql -U enactiva -d postgres -c 'CREATE DATABASE identity_db OWNER svc_identity;'
```

---

## Demo sin internet

En la sala puede no haber red. Todo lo que hace falta se puede dejar descargado antes.

### Las dos imágenes de Docker

Son las únicas que usa el proyecto: `postgres:18-alpine` y `axllent/mailpit:v1.31`.

Con internet, en el computador que sí tiene red:

```bash
docker pull postgres:18-alpine
docker pull axllent/mailpit:v1.31
docker save postgres:18-alpine axllent/mailpit:v1.31 -o imagenes-enactiva.tar
```

El archivo pesa unos **128 MB** y tarda segundos en generarse. Cabe en cualquier pendrive.

En el computador de la demo:

```bash
docker load -i imagenes-enactiva.tar
```

Después de eso `docker compose up -d --wait` no necesita red.

### Las dependencias de Node

Si la demo corre en **el mismo computador** donde ya hiciste `pnpm install`, no hay nada que
hacer: `node_modules` ya está y `pnpm dev` no descarga nada.

Para un computador distinto, con internet en el primero:

```bash
pnpm config set store-dir ./almacen-pnpm --location project
pnpm fetch                      # baja todo lo del lockfile al almacén
```

Copia la carpeta del proyecto completa (con `almacen-pnpm`) y allá:

```bash
pnpm install --offline
```

### Lo que igual necesita red

Nada de la plataforma. Los correos quedan en Mailpit, que es local, y no hay servicios externos
ni fuentes remotas. El navegador solo habla con `localhost`.

---

## Qué hay y qué no

Esto es lo que se puede mostrar hoy: empresas, invitaciones por correo, personas y carga CSV,
perfiles con lo que cada quien enseña y quiere aprender, métricas de intereses con brechas, y
talleres con cupo e inscripción.

Todavía **no** existen el swipe de matching (Slice 6), la agenda con recordatorios (Slice 7) ni
la valoración con estrellas y tokens (Slice 8). La evaluación con rúbrica salió del alcance el
2026-10-13 a pedido de la clienta (ADR-0010).
