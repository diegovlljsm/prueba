# Puesta en marcha de urbanFlow

Guía para dejar urbanFlow funcionando en un equipo nuevo, verlo desde el
celular y empezar a desarrollar.

Está escrita para que la siga alguien que **no conoce el proyecto** y sin dar
por sabido nada: se explica qué es cada pieza y por qué hace falta, no solo qué
teclear. Si ya sabes lo que es un contenedor o una clave de API, salta esas
explicaciones; están en recuadros aparte para que se puedan ignorar.

Ficha que la origina: [REQ-013](../requerimientos/REQ-013-entorno-demo-red-local.md).

> **Cómo usar esta guía.** Cada fase termina en una **comprobación**. Si la
> comprobación no pasa, no sigas: busca el síntoma en
> [Cuando algo falla](#cuando-algo-falla). Avanzar con una fase rota multiplica
> el trabajo de diagnóstico por tres.
>
> Tiempo estimado la primera vez: **una hora**, de la cual 40 minutos son
> descargas y trámites en las consolas de Google.

---

## Índice

1. [Qué vas a montar](#1-qué-vas-a-montar)
2. [Conceptos mínimos](#2-conceptos-mínimos)
3. [Fase 0 · Instalar las herramientas](#fase-0--instalar-las-herramientas)
4. [Fase 1 · Traer el código y levantar los servicios](#fase-1--traer-el-código-y-levantar-los-servicios)
5. [Fase 2 · Las credenciales de Google](#fase-2--las-credenciales-de-google)
6. [Fase 3 · Verlo desde el celular](#fase-3--verlo-desde-el-celular)
7. [Fase 4 · HTTPS con Tailscale](#fase-4--https-con-tailscale)
8. [Fase 5 · Instalarla como app (PWA)](#fase-5--instalarla-como-app-pwa)
9. [Trabajo diario: cómo pasamos cambios](#trabajo-diario-cómo-pasamos-cambios)
10. [Cuando algo falla](#cuando-algo-falla)
11. [Referencia rápida](#referencia-rápida)

---

## 1. Qué vas a montar

urbanFlow no es un solo programa: son **cuatro piezas** que hablan entre sí. En
tu equipo vas a levantarlas todas.

```
         Tu navegador  ·  o el de tu celular
                        │
                        ▼
        ┌───────────────────────────────┐
        │   FRONTEND (Vite)   :5173     │  Lo que se ve: mapa, listas,
        │   React + Tailwind            │  formularios. Es la maqueta
        │                               │  de Diego hecha código.
        └───────────────┬───────────────┘
                        │  las peticiones que empiezan por /api
                        │  las reenvía a la pieza de abajo
                        ▼
        ┌───────────────────────────────┐
        │   API (Express)     :8080     │  Las reglas: quién puede
        │   Node + TypeScript           │  publicar, qué se aprueba,
        │                               │  qué spots hay cerca de ti.
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   BASE DE DATOS     :5432     │  Donde vive todo: spots,
        │   PostgreSQL + PostGIS        │  usuarios, eventos, fotos.
        └───────────────────────────────┘

        ADMINER  :8081   Una web para mirar las tablas por dentro.
```

Además, **dos servicios de Google** que no corren en tu equipo sino en internet:

- **Firebase Auth** — es quien comprueba que eres tú cuando pulsas "Entrar con
  Google". Nosotros nunca vemos ni guardamos tu contraseña.
- **Google Maps** — dibuja el mapa y calcula las rutas de "Cómo llegar".

Por eso hay una fase entera dedicada a las consolas de Google: sin esas dos
credenciales, la app arranca pero la pantalla principal está vacía.

---

## 2. Conceptos mínimos

Cinco ideas que aparecen todo el rato en esta guía. Si te suenan, salta al
[Fase 0](#fase-0--instalar-las-herramientas).

<details>
<summary><strong>¿Qué es un contenedor y por qué usamos Docker?</strong></summary>

La API necesita Node 22. La base de datos necesita PostgreSQL 16 con una
extensión llamada PostGIS. Instalar eso a mano en tu equipo significa
descargar, configurar, tropezar con versiones distintas a las de tu socio y
acabar con dos entornos que se comportan diferente.

Un **contenedor** es un paquete cerrado que trae dentro el programa *y* todo lo
que necesita para correr. Docker los ejecuta. Nuestro fichero
`docker-compose.yml` describe los tres contenedores del proyecto, así que
`docker compose up` levanta exactamente lo mismo en tu Windows y en el macOS de
Diego.

La ventaja práctica: si algo se rompe, `docker compose down -v` lo borra todo y
`docker compose up` lo reconstruye limpio en dos minutos. No hay nada que
desinstalar.
</details>

<details>
<summary><strong>¿Qué es un puerto?</strong></summary>

Tu equipo tiene una sola dirección de red, pero puede correr muchos programas
que reciben conexiones. El **puerto** es el número que distingue a cuál de ellos
va cada conexión: como el número de departamento en un edificio.

En este proyecto: `5173` es el frontend, `8080` la API, `5432` la base de datos
y `8081` Adminer. Cuando escribes `http://localhost:5173` le estás diciendo al
navegador "conéctate a mi propio equipo, al programa que atiende en el 5173".

`localhost` significa *este mismo equipo*. Por eso el celular **no** puede usar
`localhost`: para el celular, `localhost` es el celular.
</details>

<details>
<summary><strong>¿Qué es una variable de entorno y qué son los ficheros .env?</strong></summary>

Hay datos que cambian según dónde corra el programa: la contraseña de la base,
la clave de Google, la dirección de la API. Ponerlos dentro del código sería
un problema — acabarían subidos a GitHub y habría que tocar el código para
cambiar de entorno.

En su lugar viven en ficheros `.env`, que el programa lee al arrancar. Este
proyecto tiene dos:

| Fichero | Para | Lo lee |
|---|---|---|
| `.env` (raíz) | Base de datos, CORS, modo de autenticación | Docker Compose |
| `frontend/.env.local` | Claves de Google y Firebase | Vite |

**Ninguno de los dos se sube a git** — están en `.gitignore`. Por eso cada
persona rellena el suyo, y por eso existen los `.env.example`: son la plantilla
con las variables vacías y explicadas.

> ⚠️ **Se leen al arrancar, no en caliente.** Si cambias un valor, hay que
> reiniciar el programa que lo lee. Es la causa nº1 de "lo cambié y no pasó
> nada".
</details>

<details>
<summary><strong>¿Qué es una clave de API y por qué se restringe?</strong></summary>

Google no regala su mapa: lleva la cuenta de cuántas veces lo pides y se lo
cobra a alguien. La **clave de API** es el identificador que dice "esta petición
es del proyecto de urbanFlow, cóbrasela a esa cuenta".

Aquí viene lo que confunde a todo el mundo: **esa clave no es un secreto.** Va
dentro del código que tu navegador descarga, así que cualquiera que abra las
herramientas de desarrollo la puede leer. Es inevitable y es así por diseño.

Lo que impide que un desconocido gaste tu cuota son las **restricciones**, y hay
dos tipos distintos que se confunden constantemente:

| Restricción | Responde a | Ejemplo |
|---|---|---|
| **De aplicaciones** | ¿*Desde dónde* se puede usar? | Solo desde `http://localhost:5173/*` |
| **De API** | ¿*Qué servicios* puede llamar? | Solo Maps JavaScript API y Directions API |

Confundirlas nos costó dos horas la primera vez. Están en la misma pantalla,
una encima de la otra, con nombres casi idénticos.
</details>

<details>
<summary><strong>¿Qué es un "contexto seguro" y por qué me bloquea el GPS?</strong></summary>

Los navegadores no entregan funciones delicadas —la ubicación GPS, la cámara,
el micrófono— a cualquier página. Exigen que la conexión sea **HTTPS**, es
decir, cifrada y con certificado.

Hay una única excepción: `http://localhost` se considera seguro, porque el
tráfico no sale de tu equipo y no hay nadie en medio que pueda espiarlo.

La consecuencia práctica, que es la que nos afecta:

| Dirección | ¿El mapa se dibuja? | ¿Da el GPS? |
|---|---|---|
| `http://localhost:5173` | Sí | **Sí** (la excepción) |
| `http://192.168.1.105:5173` | Sí | **No** — es HTTP puro |
| `https://algo.ts.net` | Sí | **Sí** |

Esto **no se puede forzar ni configurar**. No es un fallo del código ni de
Google: es la política del navegador. Por eso existe la Fase 4.
</details>

---

## Fase 0 · Instalar las herramientas

| Herramienta | Windows | macOS | Para qué |
|---|---|---|---|
| **Docker Desktop** | [Descargar](https://www.docker.com/products/docker-desktop/) | Ídem — elige **Apple Silicon** si tu Mac es M1/M2/M3/M4, o **Intel** si es anterior | Levanta base de datos y API sin instalar nada más |
| **Node.js 22 LTS** | [nodejs.org](https://nodejs.org) — elige "LTS" | `brew install node@22`, o el instalador de la web | Compila y sirve el frontend |
| **Git** | [git-scm.com](https://git-scm.com) | Ya viene; si no, `xcode-select --install` | Traer el código y pasar cambios |
| **Tailscale** | [Descargar](https://tailscale.com/download) | Ídem | HTTPS y acceso remoto — solo para la Fase 4 |
| **Un editor** | VS Code | VS Code | Para tocar el código |

> **Instala Docker Desktop primero y déjalo abierto.** En Windows tarda uno o
> dos minutos en arrancar su motor interno, y absolutamente todo lo demás
> depende de que esté corriendo. El icono de la ballena en la barra de tareas
> deja de animarse cuando está listo.

### Comprobación de la Fase 0

Abre una terminal —**PowerShell** en Windows, **Terminal** en macOS— y ejecuta
las tres líneas, una a una:

```bash
docker --version
node --version
git --version
```

Deben responder con un número de versión cada una. Si alguna dice *"no se
reconoce como un comando"*, esa herramienta no está instalada o el instalador
no terminó: reinstálala y **cierra y vuelve a abrir la terminal** (los
instaladores modifican el PATH, y una terminal abierta no se entera del cambio).

> **Windows: PowerShell no es lo mismo que el Símbolo del sistema (CMD).**
> Son dos terminales distintas con comandos distintos. Esta guía usa PowerShell.
> Para abrirla: tecla `Windows` → escribe `powershell` → Enter. Si necesitas
> permisos de administrador (solo en un paso de la Fase 3), clic derecho →
> **Ejecutar como administrador**.

---

## Fase 1 · Traer el código y levantar los servicios

### 1.1 · Clonar el repositorio

En la terminal, colócate donde quieras que viva el proyecto (por ejemplo la
raíz del disco, o tu carpeta de proyectos) y ejecuta:

```bash
git clone https://github.com/diegovlljsm/prueba.git urbanFlow
cd urbanFlow
git checkout dev
```

- `git clone` descarga una copia completa del proyecto, con todo su historial.
- `urbanFlow` al final es el nombre de la carpeta que se creará.
- `git checkout dev` te sitúa en la rama de trabajo diario. **Esto importa:** la
  rama `main` solo guarda estado estable, y todo el desarrollo ocurre en `dev`.

### 1.2 · Crear el fichero de variables del backend

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
```

```bash
# macOS
cp .env.example .env
```

Abre el `.env` recién creado con el editor y cambia **una sola línea**: pon tu
correo de Google en `ADMIN_EMAILS`.

```ini
ADMIN_EMAILS=tu-correo@gmail.com
```

> **Por qué importa.** La primera vez que inicies sesión, la API mira si tu
> correo está en esa lista. Si está, te da rol de administrador y podrás ver la
> cola de revisión y borrar spots. Si no, entras como usuario normal. Se pueden
> poner varios separados por coma.

El resto de valores del `.env` sirven tal cual para desarrollo local. No los
toques todavía.

### 1.3 · Levantar los tres contenedores

```bash
docker compose up -d --build
```

Qué significa cada parte:

- `docker compose` lee el fichero `docker-compose.yml` de la carpeta actual.
- `up` levanta todos los servicios que describe.
- `-d` los deja corriendo en segundo plano ("detached"), devolviéndote la
  terminal. Sin esto, la terminal se queda ocupada mostrando registros.
- `--build` construye la imagen de la API a partir del código. Solo hace falta
  la primera vez y cuando cambian las dependencias, pero no estorba.

**La primera vez tarda varios minutos.** Está descargando PostgreSQL con
PostGIS (unos cientos de megas), construyendo la imagen de la API, creando la
base de datos, aplicando las migraciones y sembrando los datos de ejemplo. Las
siguientes veces arranca en segundos.

### Comprobación de la Fase 1

```bash
docker compose ps
```

Deben aparecer **tres** servicios —`db`, `api` y `adminer`— en estado `running`.
El de `db` además debe decir `healthy`.

```bash
curl http://localhost:8080/api/health
```

Debe devolver algo parecido a esto:

```json
{"ok":true,"entorno":"development","modoAuth":"dev","postgis":"3.4 ..."}
```

Si quieres ver los datos por dentro, abre `http://localhost:8081` en el
navegador. Es **Adminer**, un cliente web de base de datos:

| Campo | Valor |
|---|---|
| Motor | PostgreSQL |
| Servidor | `db` |
| Usuario | `urbanflow` |
| Contraseña | `urbanflow` |
| Base de datos | `urbanflow` |

> `db` y no `localhost` porque Adminer corre *dentro* de la red de Docker, y ahí
> cada contenedor se llama por el nombre de su servicio.

---

## Fase 2 · Las credenciales de Google

Esta es la fase larga, y la única que no se puede automatizar: son trámites en
dos consolas web distintas. No hay código de por medio.

> **Las dos consolas, y por qué son dos.** Firebase y Google Cloud son la misma
> plataforma con dos caras. Firebase es la versión simplificada para apps;
> Google Cloud es la consola completa. **El proyecto es el mismo**
> (`urbanflow-a0b95`), pero unas cosas se configuran en una cara y otras en la
> otra. La autenticación se toca en Firebase; el mapa, en Google Cloud.

> ⚠️ **Antes de empezar:** si tienes varias cuentas de Google abiertas en el
> navegador, comprueba arriba a la derecha que estás con la correcta en cada
> consola, y que el proyecto seleccionado es `urbanflow-a0b95`. Trabajar sin
> darse cuenta sobre otro proyecto es el error más común y el más difícil de
> ver, porque todo parece funcionar hasta que nada funciona.

### Enlaces directos

| Paso | Enlace |
|---|---|
| 2.1 · App web y config del SDK | [settings/general](https://console.firebase.google.com/project/urbanflow-a0b95/settings/general) |
| 2.2 · Habilitar Google como proveedor | [authentication/providers](https://console.firebase.google.com/project/urbanflow-a0b95/authentication/providers) |
| 2.2 · Dominios autorizados | [authentication/settings](https://console.firebase.google.com/project/urbanflow-a0b95/authentication/settings) |
| 2.3 · Facturación | [billing](https://console.cloud.google.com/billing?project=urbanflow-a0b95) |
| 2.3 · Maps JavaScript API | [habilitar](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=urbanflow-a0b95) |
| 2.3 · Directions API | [habilitar](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com?project=urbanflow-a0b95) |
| 2.3 · Credenciales | [apis/credentials](https://console.cloud.google.com/apis/credentials?project=urbanflow-a0b95) |

### 2.1 · Obtener la configuración de Firebase

1. Abre [settings/general](https://console.firebase.google.com/project/urbanflow-a0b95/settings/general).
2. Baja hasta **"Tus apps"**.
3. Si ya hay una app web (icono `</>`), pulsa en ella. Si no hay ninguna:
   **Agregar app** → icono `</>` → nombre `urbanFlow Web` → **Registrar app**.
   *No marques Firebase Hosting*, no lo usamos.
4. En **Configuración del SDK**, marca la opción **Configuración** (no "CDN").
   Verás un bloque como este:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "urbanflow-a0b95.firebaseapp.com",
  projectId: "urbanflow-a0b95",
  storageBucket: "urbanflow-a0b95.firebasestorage.app",
  messagingSenderId: "436521479027",
  appId: "1:436521479027:web:...",
  measurementId: "G-..."
};
```

Cópialo entero a un bloc de notas. Lo usarás en el paso 2.4.

> **Nada de esto es secreto.** Esa configuración viaja en el código que
> descarga cualquier navegador. Lo que protege el proyecto son los dominios
> autorizados del paso siguiente y las reglas de seguridad, no esconder estos
> valores.

### 2.2 · Habilitar el acceso con Google

1. Abre [authentication/providers](https://console.firebase.google.com/project/urbanflow-a0b95/authentication/providers).
   Si es la primera vez que se entra a Authentication, pedirá **"Comenzar"**.
2. Pestaña **Método de acceso** → busca **Google** en la lista de proveedores →
   pulsa sobre él → interruptor **Habilitar**.
3. Pedirá un **correo de asistencia del proyecto**: elige el de la cuenta.
4. **Guardar**. Debe quedar como `Google · Habilitada`.
5. Ahora ve a la pestaña **Configuración** → sección **Dominios autorizados**.
   Debe figurar `localhost` en la lista. Normalmente viene por defecto; si no
   está, **Agregar un dominio** → `localhost`.

> **Qué son los dominios autorizados.** Firebase solo acepta iniciar sesión
> desde direcciones que tú hayas declarado. Es lo que impide que alguien copie
> tu app, la publique en su dominio y recoja las sesiones de tus usuarios. Si
> falta el dominio desde el que abres la app, el login falla con
> `auth/unauthorized-domain`.

### 2.3 · La clave de Google Maps

**Primero la facturación.** Abre
[billing](https://console.cloud.google.com/billing?project=urbanflow-a0b95) y
comprueba que el proyecto tiene una cuenta de facturación vinculada.

> Google exige una tarjeta asociada aunque no vayas a pagar nada: el tramo
> gratuito mensual cubre de sobra el uso de desarrollo. Sin tarjeta, las APIs
> responden pero el mapa sale gris con una marca de agua de "solo para
> desarrollo".

**Después, habilita las dos APIs.** Son servicios distintos y hacen falta las
dos:

- [**Maps JavaScript API**](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=urbanflow-a0b95) → botón **Habilitar**. Dibuja el mapa.
- [**Directions API**](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com?project=urbanflow-a0b95) → botón **Habilitar**. Calcula "Cómo llegar" y los tramos paso a paso.

**Por último, crea la clave.** En
[Credenciales](https://console.cloud.google.com/apis/credentials?project=urbanflow-a0b95):

1. **Crear credenciales** → **Clave de API**. Aparece la clave; cópiala al bloc
   de notas junto con la configuración de Firebase.
2. Pulsa sobre el nombre de la clave para editarla.

> 🚨 **Aquí está la trampa que nos costó dos horas.** La pantalla de edición
> tiene **dos bloques de restricciones distintos**, uno encima del otro, con
> nombres casi idénticos. Hacen cosas diferentes y hay que configurar **los
> dos**:
>
> | Bloque | Posición | Qué controla |
> |---|---|---|
> | **Restricciones de API** | Arriba | *Qué* servicios puede llamar la clave |
> | **Restricciones de aplicaciones** | Abajo | *Desde dónde* se puede usar |
>
> En nuestro caso la clave quedó restringida a `Address Validation API` y
> `BigQuery Connection API` —las dos primeras del desplegable en orden
> alfabético, marcadas sin querer— y todos los intentos de arreglo fueron a
> parar al bloque de abajo, que no tenía nada que ver.

**Bloque de arriba — Restricciones de API:**

- Marca **Restringir clave**.
- En el desplegable, selecciona **Maps JavaScript API** y **Directions API**.
- **Antes de guardar, lee la lista "API seleccionadas"** que aparece debajo del
  desplegable. Debe mostrar exactamente esas dos y ninguna más. El desplegable
  es largo y hay APIs de nombre casi idéntico (*Maps Embed API*, *Maps Static
  API*) que no sirven.

**Bloque de abajo — Restricciones de aplicaciones:**

- Marca **Sitios web**.
- **Add** → `http://localhost:5173/*`

El `/*` del final significa "cualquier página dentro de esa dirección". Sin él,
solo valdría la raíz exacta.

3. **Guardar**. Google avisa de que **tarda hasta 5 minutos** en aplicarse, y es
   cierto: si pruebas de inmediato y falla, espera antes de dar nada por roto.

### 2.4 · Rellenar `frontend/.env.local`

```powershell
# Windows, desde la raíz del repositorio
Copy-Item frontend\.env.example frontend\.env.local
```

```bash
# macOS
cp frontend/.env.example frontend/.env.local
```

Abre `frontend/.env.local` y rellena **las siete variables** con los valores del
bloc de notas:

```ini
VITE_GOOGLE_MAPS_API_KEY=AIza...          ← la clave que acabas de crear
VITE_FIREBASE_API_KEY=AIza...             ← apiKey del bloque de Firebase
VITE_FIREBASE_AUTH_DOMAIN=urbanflow-a0b95.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=urbanflow-a0b95
VITE_FIREBASE_STORAGE_BUCKET=urbanflow-a0b95.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=436521479027
VITE_FIREBASE_APP_ID=1:436521479027:web:...
API_URL=http://localhost:8080
```

`measurementId` no se pone: es de Google Analytics y el código no lo usa.

> 🚨 **O las rellenas todas, o el fichero queda peor que vacío.**
>
> `src/firebase.ts` tiene una reserva: si una variable está vacía, usa el valor
> de `firebase-applet-config.json`, un fichero heredado que apunta a un proyecto
> antiguo. El resultado de dejarse una a medias no es un error claro, sino una
> configuración híbrida entre dos proyectos distintos que falla sin explicar por
> qué. Rellena las siete.

### 2.5 · Arrancar el frontend

En una **terminal nueva** (la de Docker puedes cerrarla, los contenedores siguen
corriendo solos):

```bash
cd frontend
npm install
npm run dev
```

- `npm install` descarga las librerías del frontend. Tarda un par de minutos la
  primera vez y crea la carpeta `node_modules`, que no se sube a git.
- `npm run dev` arranca Vite, el servidor de desarrollo. **Deja esta terminal
  abierta**: mientras esté, la app está servida. Se para con `Ctrl+C`.

### Comprobación de la Fase 2

Abre `http://localhost:5173` y verifica, en este orden:

- [ ] Abre las herramientas de desarrollo (`F12`) → pestaña **Consola**. Debe
      aparecer `[firebase] proyecto activo: urbanflow-a0b95`. Si dice otro
      nombre, vuelve al paso 2.4: falta alguna variable.
- [ ] Se ve el **mapa de Google** con tema oscuro, no un aviso de "se requiere
      una API Key".
- [ ] Hay **marcadores** de colores sobre Santiago.
- [ ] **"Entrar con Google"** abre la ventana de Google y la sesión se
      establece: arriba a la derecha aparece tu nombre.
- [ ] Como tu correo está en `ADMIN_EMAILS`, tienes acceso a la cola de
      revisión.

**Con esto la app está operativa.** Todo lo que sigue es para verla en otros
dispositivos.

---

## Fase 3 · Verlo desde el celular

El objetivo: abrir la app en el celular, conectado a la misma red Wi-Fi.

> **Por qué no sirve `localhost`.** Para el celular, `localhost` es el propio
> celular. Hay que usar la dirección de tu equipo *dentro de la red de casa*,
> que tiene la forma `192.168.1.x` o `10.0.0.x` y se la asigna el router.

### 3.1 · Averigua la IP de tu equipo

```powershell
# Windows
ipconfig | Select-String "IPv4"
```

```bash
# macOS
ipconfig getifaddr en0
```

Anota la que empiece por `192.168.` o `10.`. En el equipo de Alfredo es
`192.168.1.105`; **la tuya será otra**, sustitúyela en todo lo que sigue.

> Esa dirección puede cambiar si reinicias el router, porque se asigna
> automáticamente. Si un día deja de funcionar, vuelve a mirarla aquí.

### 3.2 · Haz que Vite escuche fuera de tu equipo

Por defecto Vite solo atiende conexiones del propio equipo, por seguridad. Para
abrirlo a la red local, para el servidor con `Ctrl+C` y arráncalo así:

```bash
npm run dev -- --host
```

> El `--` extra no es un error de tecleo: le dice a npm "lo que viene después no
> es para ti, pásaselo al programa".

Ahora imprime varias direcciones:

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.105:5173/     ← esta es la del celular
```

### 3.3 · Abre el puerto en el Firewall

Windows bloquea por defecto las conexiones entrantes. Hay dos formas:

**La fácil:** abre la dirección en el celular. Si Windows muestra un cuadro
preguntando si permites el acceso, marca **redes privadas** y acepta. Eso crea
la regla solo.

**La explícita:** abre **PowerShell como administrador** (tecla `Windows` →
escribe `powershell` → clic derecho → *Ejecutar como administrador*) y pega
esto en una sola línea:

```powershell
New-NetFirewallRule -DisplayName "urbanFlow Vite" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Private
```

Si prefieres el Símbolo del sistema (CMD), el equivalente es otro:

```
netsh advfirewall firewall add rule name="urbanFlow Vite" dir=in action=allow protocol=TCP localport=5173 profile=private
```

> **PowerShell y CMD no comparten comandos.** `New-NetFirewallRule` solo existe
> en PowerShell; en CMD responde *"no se reconoce como un comando"*. Usa el que
> corresponda a la terminal que tengas abierta.
>
> En macOS no suele hacer falta nada: el firewall viene desactivado por defecto.

### 3.4 · Autoriza la nueva dirección en las consolas de Google

Cada origen desde el que se abra la app hay que declararlo. Son **dos sitios**:

1. **La clave de Maps** — [Credenciales](https://console.cloud.google.com/apis/credentials?project=urbanflow-a0b95)
   → tu clave → **Restricciones de aplicaciones** → *Sitios web* → **Add**:
   ```
   http://192.168.1.105:5173/*
   ```
   Sin esto, el mapa falla en el celular con `RefererNotAllowedMapError`.

2. **El backend** — en el `.env` de la raíz, añade el origen a la lista:
   ```ini
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://192.168.1.105:5173
   ```
   Y aplica el cambio: `docker compose restart api`.

### Comprobación de la Fase 3

Desde el celular, en la misma Wi-Fi, abre `http://192.168.1.105:5173`.

- [ ] Carga la pantalla de bienvenida de urbanFlow.
- [ ] Pulsa **"Continuar como Invitado"** → se ve el mapa con los marcadores.
- [ ] Las listas de spots y los filtros funcionan.

Y **dos cosas que van a fallar, y es lo esperado**:

- ❌ **"Entrar con Google"** muestra un aviso de dominio no autorizado. Es
  correcto: Firebase solo acepta orígenes declarados, y no admite direcciones IP
  como dominio autorizado.
- ❌ **Tu ubicación real** no aparece. HTTP no es contexto seguro y el navegador
  no entrega el GPS. No se puede forzar.

Las dos se resuelven en la Fase 4, y de una sola vez.

---

## Fase 4 · HTTPS con Tailscale

> **Estado: pendiente.** Fase 0 a 3 verificadas el 2026-09-20 en el equipo de
> Alfredo; esta todavía no.

**Tailscale** crea una red privada entre tus dispositivos —tu equipo, tu
celular, el equipo de tu socio— aunque estén en casas distintas. No hay que
abrir puertos en el router ni exponer nada a internet: los dispositivos se ven
entre sí como si estuvieran en la misma red.

Encima de eso, `tailscale serve` pone un **certificado HTTPS real** sobre un
nombre estable del tipo `mi-equipo.tailnet-abcd.ts.net`. Eso desbloquea de una
sola vez el GPS, el acceso con Google y el uso desde fuera de casa.

1. **Instala Tailscale** en el equipo y en el celular (hay app de iOS y
   Android). Inicia sesión en ambos con la **misma cuenta**.

2. **Habilita los certificados HTTPS** del tailnet, una sola vez por cuenta:
   [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns) →
   **HTTPS Certificates** → *Enable*.

3. **Averigua el nombre de tu máquina:**
   ```bash
   tailscale status
   ```
   La primera línea es tu equipo. El nombre completo tiene la forma
   `nombre-equipo.tailnet-xxxx.ts.net`.

4. **Autoriza ese nombre en Vite.** Vite rechaza las peticiones cuyo `Host` no
   reconoce, así que hay que declararlo. En `frontend/vite.config.ts`, dentro
   del bloque `server`:
   ```ts
   server: {
     host: true,
     allowedHosts: ['.ts.net'],
     // ...el resto sin tocar
   }
   ```

5. **Publica el frontend por HTTPS:**
   ```bash
   tailscale serve --bg 5173
   ```
   Responde con la URL. `tailscale serve status` muestra qué hay publicado;
   `tailscale serve reset` lo apaga.

6. **Registra el nuevo nombre en los tres sitios de siempre:**
   - Firebase → Authentication → Configuración → **Dominios autorizados**
   - Google Cloud → tu clave de Maps → **Restricciones de aplicaciones** →
     `https://nombre-equipo.tailnet-xxxx.ts.net/*`
   - El `.env` de la raíz → `CORS_ORIGINS` → y `docker compose restart api`

### Comprobación de la Fase 4

Desde el celular, con Tailscale conectado, abre la URL `https://…ts.net`:

- [ ] Candado de seguridad en la barra del navegador.
- [ ] **"Entrar con Google"** funciona.
- [ ] Al conceder el permiso de ubicación, el mapa centra en tu posición real y
      las tarjetas muestran distancias.
- [ ] Funciona también con datos móviles, fuera de la Wi-Fi de casa.

> ⚠️ **No uses `tailscale funnel`.** Ese otro comando publica el servicio en
> internet abierto. El backend corre con `AUTH_MODE=dev`, que decodifica los
> tokens **sin verificar la firma**: cualquiera con la URL podría hacerse pasar
> por administrador. `serve` es privado a tu red de Tailscale; `funnel`, no.

---

## Fase 5 · Instalarla como app (PWA)

> **Estado: pendiente de implementar.**

Con un `manifest.webmanifest` y un service worker mínimos, la web pasa a
instalarse en la pantalla de inicio del celular y a abrirse a pantalla completa,
sin barra de navegador. Para una demo es indistinguible de una app nativa, y no
cierra la puerta a la decisión pendiente de [ADR-004](../decisiones/) —envolver
la web o portar a React Native—.

Requiere HTTPS, es decir, la Fase 4 terminada.

---

## Trabajo diario: cómo pasamos cambios

Una vez el entorno funciona, el ciclo de cada día es este.

### Arrancar por la mañana

```bash
docker compose up -d          # base de datos y API
cd frontend && npm run dev    # frontend (deja la terminal abierta)
```

No hace falta `--build` salvo que hayan cambiado las dependencias del backend.

### Las dos ramas

| Rama | Para qué | Regla |
|---|---|---|
| `dev` | Trabajo diario. Todo commit va aquí primero | Puede romperse; se arregla en el momento |
| `main` | Estado estable, lo que se despliega | Solo recibe cambios desde `dev`, y solo cuando el entorno local corre entero |

**Nada se commitea directamente sobre `main`.**

### Subir un cambio

```bash
git status                     # qué has tocado
git add .                      # prepararlo todo
git commit -m "Descripción de lo que hiciste"
git pull --rebase origin dev   # traer lo del otro ANTES de subir
git push origin dev
```

> **`git pull --rebase` antes de `push`, siempre.** Trae los cambios de tu socio
> y coloca los tuyos encima. Sin esto, si los dos habéis trabajado a la vez, el
> `push` es rechazado y se lía.

### Promover a `main` cuando todo está sano

```bash
git checkout main
git merge --no-ff dev
git push origin main
git checkout dev
```

El `--no-ff` es a propósito: deja un commit de fusión que marca en el historial
dónde estuvo cada estado estable.

### Lo que NO se sube nunca

Ya está cubierto por `.gitignore`, pero conviene saberlo:

- `node_modules/` — se reconstruye con `npm install`
- `.env` y `frontend/.env.local` — cada uno tiene el suyo, con sus claves
- `backend/secrets/` — claves de servicio de Firebase

> Si alguna vez `git status` muestra uno de estos, **para y avisa**: significa
> que el `.gitignore` no lo está cubriendo, y subir claves a un repositorio es
> muy difícil de deshacer.

### Antes de pedir ayuda por un fallo

Ten a mano estas tres cosas; sin ellas el diagnóstico es a ciegas:

1. El **error exacto de la consola del navegador** (`F12` → Consola), copiado
   como texto, no descrito de memoria.
2. Qué **dirección** tenías abierta (`localhost`, la IP, el nombre `.ts.net`).
3. Qué **cambiaste justo antes** de que dejara de funcionar.

---

## Cuando algo falla

| Síntoma | Causa | Solución |
|---|---|---|
| `failed to connect to the docker API` | Docker Desktop no está arrancado | Ábrelo y espera a que el icono deje de animarse |
| `docker compose ps` no muestra los tres | Alguno se cayó al arrancar | `docker compose logs api` para ver por qué |
| La consola dice un `proyecto activo` distinto de `urbanflow-a0b95` | Falta alguna `VITE_FIREBASE_*` y cayó al JSON heredado | Rellena las seis y reinicia Vite |
| `auth/unauthorized-domain` | El dominio desde el que abres no está autorizado | Firebase → Authentication → Configuración → Dominios autorizados |
| `auth/popup-blocked` | Brave y Safari bloquean ventanas emergentes | La app reintenta por redirección; permite emergentes para el sitio |
| Aviso "se requiere una API Key de Google Maps" | `VITE_GOOGLE_MAPS_API_KEY` vacía | Paso 2.3 y 2.4. **Reinicia Vite**: las variables se leen al arrancar |
| Mapa negro y `ApiTargetBlockedMapError` | La clave está restringida a APIs que **no incluyen** la Maps JavaScript API. Es el bloque **de API**, no el de aplicaciones | Clave → *Restricciones de API* → verifica "API seleccionadas". Para aislarlo, marca temporalmente **No restringir clave** |
| `RefererNotAllowedMapError` | La restricción *de sitios web* no cubre el origen desde el que abres | Añadir el origen exacto, con `/*` al final |
| `ApiNotActivatedMapError` | La API no está habilitada en el proyecto | Paso 2.3, habilitar las dos |
| Mapa gris con marca de agua | Sin cuenta de facturación vinculada | Google Cloud → Facturación |
| "Cómo llegar" responde `REQUEST_DENIED` | Falta la **Directions API** | Es un servicio distinto del mapa; habilítalo y añádelo a la clave |
| El celular no abre la IP | Vite sin `--host`, o el Firewall | Paso 3.2 y 3.3 |
| `Blocked request. This host is not allowed` | Vite no reconoce el `Host` | `allowedHosts` en `vite.config.ts` (paso 4.4) |
| El GPS no responde en el celular | HTTP no es contexto seguro | No tiene arreglo por HTTP. Es la Fase 4 |
| Cambié un `.env` y no pasó nada | Se leen al arrancar | `docker compose restart api` y reinicia Vite |
| `New-NetFirewallRule no se reconoce` | Estás en CMD, no en PowerShell | Usa la variante `netsh` del paso 3.3 |
| Quiero empezar de cero, sin datos | — | `docker compose down -v` y luego `docker compose up -d --build` |

> **Dos errores de Google que parecen lo mismo y no lo son.**
> `ApiNotActivatedMapError` significa que la API no está habilitada en el
> proyecto. `ApiTargetBlockedMapError` significa que **sí** lo está, pero la
> clave no tiene permiso de llamarla. Distinguirlos ahorra mucho tiempo: el
> primero se arregla en la Biblioteca de APIs, el segundo en las restricciones
> de la clave.

---

## Referencia rápida

### Comandos

```bash
# Contenedores (desde la raíz del repositorio)
docker compose up -d --build      # levantar todo
docker compose ps                 # ver estado
docker compose logs -f api        # seguir los registros de la API
docker compose restart api        # aplicar cambios del .env
docker compose down               # parar
docker compose down -v            # parar y BORRAR la base de datos

# Frontend (desde frontend/)
npm install                       # instalar dependencias
npm run dev                       # solo este equipo
npm run dev -- --host             # visible en la red local
npm run lint                      # comprobar tipos de TypeScript

# Tailscale
tailscale status                  # nombre e IP de tus máquinas
tailscale serve --bg 5173         # publicar con HTTPS
tailscale serve status            # qué hay publicado
tailscale serve reset             # dejar de publicar
```

### Direcciones

| Dirección | Qué es |
|---|---|
| `http://localhost:5173` | La app |
| `http://localhost:8080/api/health` | Salud de la API |
| `http://localhost:8081` | Adminer, para mirar las tablas |

### Ficheros que vas a tocar

| Fichero | Qué contiene | ¿Se sube a git? |
|---|---|---|
| `.env` | Base de datos, CORS, `ADMIN_EMAILS` | No |
| `frontend/.env.local` | Claves de Google y Firebase | No |
| `docker-compose.yml` | Definición de los tres contenedores | Sí |
| `frontend/vite.config.ts` | Configuración del servidor de desarrollo | Sí |
