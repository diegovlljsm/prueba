---
id: REQ-013
titulo: Entorno de demostración en red local y réplica para el socio
estado: en-curso
prioridad: P0
epica: infra
esfuerzo: M
responsable: Alfredo
depende_de: []
bloquea: [REQ-005, FEAT-002, FEAT-005]
creado: 2026-09-19
actualizado: 2026-09-20
---

## Problema

urbanFlow tiene backend, base de datos y frontend funcionando, pero **nadie ha
visto la app entera funcionando todavía**. La pantalla principal —el mapa
geolocalizado, que es el corazón del producto— no se puede mostrar porque
faltan credenciales de consola, no porque falte código.

Tres huecos concretos, verificados hoy sobre el repositorio:

1. `frontend/.env.local` tiene la configuración de Firebase **a medias**:
   `VITE_FIREBASE_AUTH_DOMAIN`, `_PROJECT_ID` y `_STORAGE_BUCKET` apuntan a
   `urbanflow-a0b95`, pero `_API_KEY`, `_MESSAGING_SENDER_ID` y `_APP_ID` están
   vacías. Al estar vacías, `src/firebase.ts` cae al
   `firebase-applet-config.json`, que apunta al proyecto viejo de AI Studio
   (`project-5edc560e-…`). El resultado es una configuración híbrida entre dos
   proyectos distintos: el acceso con Google no puede funcionar así.
2. `VITE_GOOGLE_MAPS_API_KEY` está vacía. Sin ella, `App.tsx` sustituye el mapa
   por un aviso. La app arranca, pero la pantalla principal no existe.
3. `localhost` no figura en los dominios autorizados de Firebase Auth. Ya está
   diagnosticado en la bitácora (`auth/unauthorized-domain`) y sigue pendiente.

Y por encima de eso, el objetivo real: ver la app **desde el celular** y poder
**entregarle a Diego un procedimiento que reproduzca lo mismo en su casa**, sin
que eso dependa de que Alfredo esté delante.

## Solución propuesta

Cinco fases, cada una utilizable por sí sola. No se pasa a la siguiente hasta
que la anterior se ve funcionando.

**Fase 0 — Operativa en el PC de Alfredo.** Docker Desktop arriba, los tres
contenedores sanos, `.env.local` completo con un único proyecto de Firebase,
Maps JavaScript API y Directions API habilitadas, `localhost` autorizado.
Criterio: se entra con Google y se ve el mapa con los spots en
`http://localhost:5173`.

**Fase 1 — Visible en el celular por red local.** Vite escuchando en todas las
interfaces (`npm run dev -- --host`), el puerto abierto en el Firewall de
Windows y el origen de la IP local añadido a `CORS_ORIGINS`. Criterio: el mapa
se ve desde el celular en `http://192.168.1.105:5173`.

**Fase 2 — HTTPS por Tailscale.** La Fase 1 muestra el mapa, pero **no la
ubicación del usuario ni el acceso con Google**: los navegadores solo entregan
`navigator.geolocation` en contexto seguro —HTTPS o `localhost`—, y una IP
desnuda no lo es. `tailscale serve` pone un certificado real sobre un nombre
estable `*.ts.net` sin abrir un solo puerto al exterior. Ese nombre sí se puede
registrar como dominio autorizado en Firebase y como referente de la clave de
Maps. Criterio: desde el celular se entra con Google y aparece la posición real
del usuario en el mapa.

**Fase 3 — Instalable en el celular (PWA).** Manifiesto y service worker
mínimos para que la web se añada a la pantalla de inicio y se abra a pantalla
completa, sin barra de navegador. Es el camino barato a "multiplataforma"
mientras ADR-004 —envolver la web o portar a React Native— sigue sin decidirse.

**Fase 4 — Réplica en casa de Diego.** El paso a paso de
[`docs/guias/puesta-en-marcha.md`](../guias/puesta-en-marcha.md), ejecutado por
Diego de principio a fin sobre macOS, sin asistencia. Cada punto donde se
atasque es un defecto de la guía, no de Diego, y se corrige en la guía.

## Alcance

**Incluye:** puesta en marcha local reproducible, acceso desde el celular en la
red local, HTTPS para desbloquear GPS y login, empaquetado PWA, y la guía
escrita que permite a Diego repetirlo.

**No incluye:** el VPS, el dominio público, el almacenamiento de imágenes en
CDN ni las copias de seguridad. Todo eso es producción y vive en REQ-005,
REQ-006 y REQ-007. Este entorno es de demostración e iteración, no de
producción.

## Criterios de aceptación

- [x] **Dado** el PC de Alfredo recién arrancado, **cuando** se ejecutan los
      pasos de la guía, **entonces** los tres contenedores quedan sanos y
      `GET /api/health` responde correctamente. *(2026-09-20: verificado —
      PostGIS 3.4, spots y eventos sembrados, `amoyap.dev@gmail.com` reconocido
      como administrador.)*
- [x] **Dado** el frontend en `http://localhost:5173`, **cuando** se pulsa
      "Entrar con Google", **entonces** la sesión se abre sin
      `auth/unauthorized-domain` y el usuario queda con rol de administrador.
      *(2026-09-20: primer inicio de sesión real, correcto.)*
- [x] **Dado** un usuario con sesión, **cuando** carga la pantalla principal,
      **entonces** ve el mapa de Google con los marcadores de los spots
      aprobados, no el aviso de clave ausente. *(2026-09-20: mapa con el tema
      oscuro de la maqueta y los marcadores sobre Santiago.)*
- [x] **Dado** un celular en la misma red Wi-Fi, **cuando** abre la IP local en
      el navegador, **entonces** la app carga entera y el mapa se dibuja.
      *(2026-09-20: verificado desde un iPhone en Safari contra
      `http://192.168.1.105:5173`, entrando como invitado.)*
- [ ] **Dado** el acceso por el nombre `*.ts.net` con HTTPS, **cuando** el
      usuario concede el permiso de ubicación, **entonces** el mapa centra en su
      posición real y las tarjetas muestran distancias.
- [ ] **Dado** el mismo acceso HTTPS desde el celular, **cuando** se pulsa
      "Entrar con Google", **entonces** la sesión se abre igual que en el
      escritorio.
- [ ] **Dado** que Diego sigue la guía en su macOS sin ayuda, **cuando**
      termina, **entonces** tiene la app funcionando contra su propia base de
      datos local.

## Notas técnicas

- **Contexto seguro.** Es la trampa no evidente de todo el requerimiento.
  `http://localhost` es contexto seguro por excepción de la especificación;
  `http://192.168.1.105` no lo es. Por eso el mapa se dibuja en la Fase 1 pero
  la geolocalización queda muda: no es un fallo de la app, es la política del
  navegador.
- **Dos claves distintas, dos consolas.** La configuración web de Firebase sale
  de la consola de Firebase; la clave de Maps, de Google Cloud → Credenciales.
  Ambas del mismo proyecto `urbanflow-a0b95`. Ninguna de las dos es secreta:
  viajan en el bundle del navegador por diseño. Lo que protege el proyecto son
  las restricciones por referente y los dominios autorizados.
- **Dos APIs, no una.** Maps JavaScript API dibuja el mapa; Directions API
  calcula "Cómo llegar". Habilitar solo la primera deja `RutaAlSpot`
  respondiendo `REQUEST_DENIED`.
- **`firebase-applet-config.json` es una trampa heredada.** Mientras exista como
  reserva, una variable olvidada no produce un error ruidoso: produce una
  conexión silenciosa al proyecto equivocado. Conviene sustituir esa reserva por
  un fallo explícito en el arranque.
- **`AUTH_MODE=dev` no sale de la red local.** Ese modo decodifica el token de
  Firebase **sin comprobar la firma**: cualquiera podría fabricar un token de
  administrador. Sirve para trabajar en casa; es inaceptable en cuanto la API
  sea alcanzable desde fuera. De ahí que la Fase 2 use `tailscale serve`
  —privado al tailnet— y **no** `tailscale funnel`, que publica en internet.
- **CORS.** `CORS_ORIGINS` del `.env` raíz debe listar cada origen nuevo desde
  el que se abra la app. Mientras se entre por el proxy de Vite la petición sale
  del mismo origen y no hay CORS de por medio; el punto se vuelve crítico en
  cuanto se llame a la API directamente.
- **Tailscale ya está instalado** en el PC de Alfredo (IP de tailnet
  `100.97.187.78`), así que la Fase 2 no añade herramienta nueva.

## Riesgos y preguntas abiertas

- [ ] ¿El proyecto `urbanflow-a0b95` tiene ya una app web creada en Firebase? Si
      no, hay que crearla para que exista `appId`. → Alfredo, Fase 0.
- [ ] ¿Se factura la clave de Maps? Google exige tarjeta asociada al proyecto
      aunque el consumo caiga dentro del tramo gratuito. → Alfredo.
- [ ] ¿La consola de Firebase admite una IP como dominio autorizado? Si la
      rechaza, la Fase 2 deja de ser opcional y pasa a ser la única vía para
      probar el login desde el celular.
- [ ] Diego trabaja en macOS y Alfredo en Windows. La guía debe cubrir ambas
      columnas o se romperá en la Fase 4.
- [ ] ¿Se decide ADR-004 antes o después de la PWA? La PWA no cierra ninguna
      puerta, pero sí puede volver innecesaria la decisión durante meses.

## Trazabilidad

- Origen: petición de Alfredo del 2026-09-19 — dejar la app operativa, verla
  desde el celular y entregar un procedimiento reproducible al socio antes de
  iterar hacia producción.
- Guía operativa derivada: [puesta-en-marcha.md](../guias/puesta-en-marcha.md).
- Relacionados: [[REQ-005]], [[REQ-006]], [[FEAT-002]], [[FEAT-005]],
  [[ADR-004]].
