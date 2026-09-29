# Bitácora de urbanFlow

Documento vivo. Todo lo que se decide, se descarta o queda pendiente en
urbanFlow se registra aquí. Si una decisión no está en esta bitácora, no está
tomada.

- **Última actualización:** 2026-09-20
- **Índice de fichas:** [docs/README.md](./README.md)
- **Repositorio:** https://github.com/diegovlljsm/prueba

### Flujo de ramas

| Rama | Para qué | Regla |
|---|---|---|
| `dev` | Trabajo diario. Todo commit va aquí primero | Puede romperse; se arregla en el momento |
| `main` | Estado estable, lo que se despliega | Solo recibe cambios desde `dev`, y solo cuando el entorno local corre entero |

Nada se commitea directamente sobre `main`. Cuando `dev` está sano, se
promueve con un pull request desde `dev` hacia `main` —así queda registrado
qué entró y cuándo— o, mientras seamos dos, con un merge directo:

```bash
git checkout main
git merge --no-ff dev
git push origin main
git checkout dev
```

El `--no-ff` es a propósito: deja un commit de fusión que marca en el
historial dónde estuvo cada estado estable. Con avance rápido esa frontera se
pierde y `main` deja de contar nada.

---

## 1. Qué es urbanFlow

Una app móvil donde la comunidad sube fotos geolocalizadas de spots urbanos para
practicar deporte —bowls, skateparks, zonas de calistenia, spots de parkour,
pistas de BMX—, un equipo interno los revisa y, una vez aprobados, quedan
visibles en un mapa público para que cualquiera sepa dónde entrenar.

**El valor no está en el mapa: está en la curaduría.** Existen mapas
colaborativos de spots, y casi todos degeneran en ruido porque publican sin
filtro. La etapa de aprobación humana es la característica del producto, no un
trámite interno.

**Circuito completo:**

```
Usuario descubre un spot
   → sube foto(s) + ubicación (GPS, EXIF o pin manual)
      → cola de revisión interna
         → moderador aprueba / rechaza con motivo / marca duplicado
            → spot aprobado visible en el mapa público
               → la comunidad lo usa, lo valora y reporta lo que esté mal
```

## 2. Equipo y reparto

| Persona | Rol | Alcance |
|---|---|---|
| Diego | Diseño y frontend | Maqueta, identidad visual, app móvil, experiencia de usuario |
| Alfredo | Backend e infraestructura | API, base de datos, geolocalización, despliegue, backoffice de moderación, publicación en tiendas |

Diego trabaja sobre macOS, lo que resuelve el requisito de máquina para firmar y
subir a App Store.

## 3. Estado actual

**Fase: desarrollo temprano.** El circuito mínimo ya corre en local. Lo que existe:

- [x] Concepto de producto y circuito de moderación definidos
- [x] Sistema de documentación trazable (`docs/` + agente `urbanflow-planner`)
- [x] Skills de `geolocalizacion` y `frontend-urbanflow` en `.claude/skills/`
- [x] Estudio de infraestructura, costos y requisitos de tiendas
      → [propuesta-marcas.html](./propuesta-marcas.html)
- [x] Frontend de Diego entregado en `frontend/` (Vite + React 19 + Google Maps)
- [x] Stack backend confirmado → [ADR-001](./decisiones/ADR-001-backend-express-postgis.md)
- [x] Backend en `backend/` con los 11 endpoints del contrato, verificados
- [x] Entorno local con Docker: Postgres+PostGIS, API y Adminer
- [ ] Clave de Google Maps para que el mapa se dibuje *(bloqueante para ver la app)*
- [ ] `AUTH_MODE=firebase` con clave de servicio real
- [ ] Maqueta original de Diego (Figma) para cerrar los tokens visuales

## 4. Decisiones tomadas

Las decisiones con alternativas relevantes se documentan por extenso en
`docs/decisiones/`. Resumen de lo acordado hasta hoy:

| Fecha | Decisión | Motivo corto |
|---|---|---|
| 2026-08-30 | Toda petición pasa por una ficha en `docs/` antes de codificarse | Trazabilidad; evita el trabajo que nadie pidió |
| 2026-08-30 | PostgreSQL + PostGIS como fuente de verdad geográfica | `ST_DWithin` con índice GiST; el cliente nunca filtra por distancia |
| 2026-08-30 | La aprobación de spots es siempre humana | Es el diferencial del producto y además lo exige la guideline 1.2 de Apple |
| 2026-08-30 | VPS propio (Contabo) frente a nube gestionada | Coste predecible y bajo en fase de validación; migrable después |
| 2026-08-30 | Backend propio en Express + PostGIS, descartando Firestore | Firestore no hace consultas por radio ni por rectángulo, y el mapa las necesita en cada paneo. Ver ADR-001 |
| 2026-08-30 | Se conserva Firebase Auth en el cliente; el backend solo verifica el token | La pantalla de login ya funcionaba; sustituirla no resolvía ningún problema |
| 2026-08-30 | El contrato `/api/*` no se toca | Permite reemplazar toda la capa de datos sin modificar el frontend de Diego |

## 5. Decisiones pendientes

Cada una bloquea trabajo real. Ordenadas por urgencia:

1. **Proveedor de mapa** — el frontend ya usa **Google Maps**
   (`@vis.gl/react-google-maps`), no MapLibre como suponía la skill de frontend.
   Google reestructuró su tarifa en 2026 y sale bastante más caro que Mapbox.
   Hay que decidir pronto si se mantiene: cuanto más código de mapa se escriba,
   más caro es el cambio.
   → Necesita `ADR-002`.
2. **Formato de la app** — lo entregado es una **web app**, no React Native.
   Para publicar en App Store y Play Store hay que decidir entre envolverla
   (Capacitor) o portarla. Afecta a todo lo escrito en la lámina 06 del dossier.
   → Necesita `ADR-004`.
3. **Moderación de spots** — hoy solo se moderan los videos; los spots se
   publican directos. La columna `status` ya existe con valor `aprobado` por
   defecto, así que activarlo es código, no migración.
   → Es `FEAT-003`.
4. **Tipo de cuenta en las tiendas** — individual frente a organización. La
   cuenta de organización en Google Play evita la regla de 12 testers durante
   14 días, y en Apple hace que el vendedor figure como empresa y no como
   persona; a cambio exige número D-U-N-S y verificación, que tarda.
   → Necesita `REQ-002` y decisión de negocio.
5. **Moderación automática previa** — si se filtra contenido con un modelo antes
   de la cola humana, y con qué proveedor.
   → Necesita `ADR-003`.

## 6. Riesgos identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Rechazo en App Store por contenido generado por usuarios | Bloquea el lanzamiento | Implementar reporte, bloqueo, borrado de cuenta y respuesta en 24 h **antes** de la primera revisión, no después |
| Spots duplicados de la misma ubicación | Degrada el mapa, que es el producto | Detección por cercanía (75 m) y decisión humana asistida |
| Spots en propiedad privada o con riesgo físico | Responsabilidad legal | Campo de tipo de acceso obligatorio + descargo de responsabilidad aceptado en el registro |
| Mapa vacío en el lanzamiento | Nadie vuelve a una app sin contenido | Sembrar manualmente 50-100 spots de una sola ciudad antes de abrir |
| Coste variable del mapa si crece rápido | Sorpresa en la factura | Alerta de uso al 70% del tramo gratuito; plan B de teselas propias |

## 7. Preguntas abiertas

- [ ] **Para Alfredo** — generar la clave de Google Maps JavaScript API y
      ponerla en `frontend/.env.local`. Sin ella la app carga pero el mapa se
      sustituye por un aviso, y no se puede probar nada visual.
- [ ] **Para Alfredo** — bajar la clave de servicio de Firebase a
      `backend/secrets/` para poder pasar a `AUTH_MODE=firebase`. Mientras
      tanto, la API no verifica la firma de los tokens.
- [ ] **Para Diego** — enviar el archivo de maqueta original (Figma o export).
      El código ya define el estilo, pero la maqueta es lo que permite cerrar
      los tokens sin hacer ingeniería inversa.
- [ ] **Para Diego** — ¿la maqueta contempla modo claro, o solo uno?
- [ ] **Para Alfredo** — ¿ciudad y deporte con los que se arranca?
- [ ] **Para ambos** — nombre comercial definitivo y dominio a registrar.
- [ ] **Para ambos** — ¿la app tendrá cuentas desde el día uno, o se puede
      explorar el mapa sin registrarse? (Afecta al alcance del MVP y a la
      fricción de entrada.)

## 8. Registro cronológico

Entradas nuevas al final. Formato:
`- **AAAA-MM-DD** — [ID] Qué pasó. Estado. Origen.`

- **2026-08-30** — Arranque del proyecto. Definido el concepto, el circuito de
  moderación y el reparto entre Diego (diseño/frontend) y Alfredo
  (backend/infra).
- **2026-08-30** — Creado el sistema de documentación trazable: agente
  `urbanflow-planner`, carpetas `docs/features`, `docs/requerimientos` y
  `docs/decisiones`, e índice en `docs/README.md`.
- **2026-08-30** — Creadas las skills `geolocalizacion` (PostGIS, permisos,
  privacidad de coordenadas) y `frontend-urbanflow` (Expo, tokens, flujo de
  captura). La segunda queda con valores visuales provisionales a la espera de
  la maqueta de Diego.
- **2026-08-30** — Elaborado el dossier de propuesta para marcas deportivas con
  el desglose de infraestructura, costos de VPS (Contabo y HostGator) y
  requisitos de App Store y Google Play.
- **2026-08-30** — Diego entregó el frontend en `frontend/`: web app con Vite,
  React 19, Tailwind 4, Google Maps y Firebase Auth, más un `server.ts` sobre
  Firestore. Revisado el contrato completo de la API antes de tocar nada.
- **2026-08-30** — [ADR-001] Descartado Firestore como capa de datos: no hace
  consultas geoespaciales y `GET /api/spots` se traía la colección entera.
- **2026-08-30** — Creado `backend/`: Express + TypeScript sobre PostgreSQL 16
  con PostGIS 3.4, sirviendo los 11 endpoints del contrato original sin cambios,
  más filtros `?bbox=` y `?near=&radius=` aditivos.
- **2026-08-30** — Entorno local con Docker Compose: `db` (PostGIS), `api` (con
  recarga en caliente) y `adminer`. Migraciones automáticas al arrancar y
  siembra idempotente de los 3 eventos de ejemplo.
- **2026-08-30** — Verificado de punta a punta con 20 comprobaciones: salud,
  validación, 401/403/404/409, consultas por radio y por rectángulo, flujo
  completo de moderación de video y borrado en cascada. Todas correctas.
- **2026-08-30** — Frontend conectado por el proxy de Vite. Dos cambios en el
  código de Diego: el script `dev` pasa a `vite` (el anterior queda como
  `dev:firebase`) y `vite.config.ts` redirige `/api` al contenedor.
- **2026-08-30** — Repositorio publicado en
  `https://github.com/diegovlljsm/prueba.git` (estaba vacío, no se pisó nada).
  Commit inicial con 63 archivos: frontend de Diego, backend, entorno Docker,
  documentación y herramientas. Verificado antes de subir que no entraran
  `node_modules`, ficheros `.env` reales ni claves de servicio.
- **2026-08-30** — Definido el flujo de ramas: `dev` para el trabajo diario,
  `main` solo para estado estable. Ambas quedan en el mismo commit de partida.
  Añadido `.gitattributes` para normalizar los saltos de línea entre el Windows
  de Alfredo y el macOS de Diego.
- **2026-08-30** — Diagnosticado y corregido el 404 de consola: era
  `GET /favicon.ico`, no había icono. Añadido `favicon.svg` con la marca y
  declarado en `index.html`, que es lo que hace que el navegador deje de
  pedirlo a ciegas.
- **2026-08-30** — Descubierto que `index.css` declaraba Inter y JetBrains Mono
  como fuentes del tema pero nadie las cargaba: la app entera caía a la fuente
  del sistema. Cargadas desde Google Fonts en `index.html`.
- **2026-08-30** — Creadas las páginas 404 con la identidad de urbanFlow:
  `public/404.html` (estática, la sirve el servidor antes de que React
  arranque) y `src/components/NotFound.tsx` (dentro de la app, para rutas
  desconocidas). Título de la pestaña corregido: era "My Google AI Studio App".
- **2026-08-30** — Causa del fallo de acceso con Google identificada por el
  propio Firebase: `auth/unauthorized-domain`. El dominio `localhost` no está
  en Authentication → Settings → Authorized domains del proyecto. Es
  configuración de consola, no código. Pendiente para Alfredo.
- **2026-08-30** — Reforzado `useAuth`: el error ya no se traga con un
  `console.error`, se muestra al usuario con un mensaje accionable; hay reserva
  por redirección cuando el navegador bloquea la ventana emergente (Brave y
  Safari lo hacen por defecto), y se recoge el `getRedirectResult` al volver.
- **2026-08-30** — Diego entregó las maquetas del aplicativo en `docs/img` y
  `frontend/docs_frontend/img`: 22 pantallas. La paleta se extrajo muestreando
  los píxeles con un histograma de color, no a ojo: fondo `#070F18`,
  superficie `#131B24`, acento `#BAF413`. Aplicada redefiniendo las escalas
  `slate` y `emerald` del `@theme` de Tailwind, de modo que toda la app hereda
  la paleta sin reescribir pantalla por pantalla.
- **2026-08-30** — [FEAT-005] Implementadas las features de geolocalización de
  la maqueta: globo sobre el mapa con la descripción de cada spot
  (`PopupSpot`), panel de "Cómo llegar" con los cuatro modos de viaje, resumen
  y tramos paso a paso (`RutaAlSpot` + hook `useRuta` sobre la Directions API),
  y distancia real al usuario en las listas (`lib/geo.ts`, haversine).
- **2026-08-30** — La distancia solo se muestra cuando el GPS respondió de
  verdad: `userLocation` arranca en el centro de Santiago como encuadre por
  defecto del mapa, y enseñar distancias desde ahí sería inventar datos.
- **2026-08-30** — Pendiente para poder ver el mapa: además de la Maps
  JavaScript API, hay que habilitar la **Directions API** en la misma clave de
  Google. Son dos servicios distintos; sin el segundo, "Cómo llegar" responde
  REQUEST_DENIED y el panel lo dice explícitamente.
- **2026-08-30** — [FEAT-009] Implementado el panel de filtros de la maqueta:
  tipo de spot, distancia y solo-con-foto, con contador en vivo ("Mostrar 2
  spots") y aplicación diferida. Filtra a la vez los marcadores del mapa y las
  listas. No se implementaron los filtros de dificultad, afluencia y
  calificación que muestra la maqueta: esos campos no existen en la base, y un
  filtro que no filtra es peor que no ofrecerlo.
- **2026-08-30** — Creada `TarjetaSpot`, la fila de la maqueta con miniatura,
  ubicación y distancia. Sustituye las dos listas duplicadas de escritorio y la
  de móvil. Sin foto propia pinta un marcador en vez de una imagen de stock:
  una foto de otro skatepark haría pasar por real algo que no lo es.
- **2026-08-30** — Descubierto que el proyecto **no tenía `@types/react`
  instalado**. Sin esos tipos, TypeScript no validaba nada de JSX. Al
  instalarlos afloraron tres errores latentes en el código original: `activeTab`
  se ponía a `'add'`, un valor fuera de su propio tipo; y el tooltip del mapa
  leía `clientX` de un evento que puede ser táctil o de teclado, con lo que en
  un dispositivo táctil saltaba a la esquina de la pantalla. Los tres
  corregidos.
- **2026-09-19** — [REQ-013] Planificado el despliegue del entorno de
  demostración: operativa local, acceso desde el celular, HTTPS y réplica en la
  red de Diego. Cinco fases, cada una con su comprobación. Ficha en
  `docs/requerimientos/REQ-013-entorno-demo-red-local.md`.
- **2026-09-19** — Escrita la guía operativa
  `docs/guias/puesta-en-marcha.md`: el paso a paso reproducible para levantar
  urbanFlow en un equipo nuevo, con columnas para Windows y macOS, tabla de
  diagnóstico por síntoma y referencia de comandos. Es el documento que se le
  entrega a Diego. Nueva carpeta `docs/guias/` en el índice.
- **2026-09-19** — Auditado por qué nadie ha visto todavía la app entera: no
  falta código, faltan credenciales de consola. `frontend/.env.local` tiene la
  configuración de Firebase a medias —`AUTH_DOMAIN`, `PROJECT_ID` y
  `STORAGE_BUCKET` de `urbanflow-a0b95`, pero `API_KEY`, `MESSAGING_SENDER_ID`
  y `APP_ID` vacías— y `VITE_GOOGLE_MAPS_API_KEY` está vacía, así que el mapa
  se sustituye por un aviso.
- **2026-09-19** — Identificado el fallo silencioso de
  `firebase-applet-config.json`: al ser la reserva de cada variable ausente, una
  configuración incompleta no produce error, produce una conexión híbrida entre
  el proyecto nuevo y el viejo de AI Studio. Propuesto sustituir esa reserva por
  un fallo explícito en el arranque; mientras exista, `.env.local` se rellena
  entero o no se rellena.
- **2026-09-19** — Documentada la restricción que condiciona todo el acceso
  móvil: los navegadores solo entregan `navigator.geolocation` en contexto
  seguro. `http://localhost` lo es por excepción de la especificación;
  `http://192.168.1.105` no. Por eso ver la app por IP en la red local dibuja
  el mapa pero deja el GPS y el acceso con Google inoperativos.
- **2026-09-19** — Elegido **Tailscale** para resolver ese punto:
  `tailscale serve` da un nombre `*.ts.net` estable con certificado real, sin
  abrir puertos en el router, y ese nombre sí se puede registrar como dominio
  autorizado en Firebase y como referente de la clave de Maps. Ya estaba
  instalado en el equipo de Alfredo, así que no añade herramienta nueva.
  Descartado `tailscale funnel` mientras `AUTH_MODE=dev`: ese modo no verifica
  la firma del token y publicarlo en internet regalaría el rol de administrador.
- **2026-09-19** — Anotada una trampa de Vite 6 para la fase de HTTPS: bloquea
  las peticiones cuyo `Host` no reconoce, de modo que el acceso por el nombre
  `*.ts.net` devuelve "Blocked request" hasta declarar
  `server.allowedHosts: ['.ts.net']` en `vite.config.ts`.
- **2026-09-20** — [REQ-013] Completada la Fase 0. Alfredo hizo los trámites de
  consola que faltaban desde agosto: app web creada en `urbanflow-a0b95`,
  Google habilitado como proveedor de acceso, cuenta de facturación activa,
  **Maps JavaScript API** y **Directions API** habilitadas, y una clave de API
  restringida por sitio web a `http://localhost:5173/*` y limitada a esas dos
  APIs. La ficha pasa a `en-curso`.
- **2026-09-20** — Rellenadas las siete variables de `frontend/.env.local` con
  la configuración real del proyecto. Se dejó fuera `measurementId`
  deliberadamente: es de Google Analytics y `src/firebase.ts` no inicializa
  Analytics, así que solo ocuparía sitio. Verificado que git lo ignora.
- **2026-09-20** — Verificado el arranque de punta a punta: contenedores sanos,
  `/api/health` con PostGIS 3.4, los tres spots y los tres eventos de ejemplo
  sirviéndose, Vite v6.4.3 en `:5173`, el proxy `/api` devolviendo 200 y la
  configuración de Firebase resolviendo a `urbanflow-a0b95`. Confirmado que ya
  **no queda ningún rastro del proyecto viejo** `project-5edc560e` en lo que
  sirve el navegador: la trampa del `firebase-applet-config.json` está
  neutralizada por tener las seis variables rellenas.
- **2026-09-20** — Se usan **dos claves distintas** del mismo proyecto, y
  conviene no confundirlas: la `Browser key (auto created by Firebase)` es la
  de `VITE_FIREBASE_API_KEY`, y la `Clave de API 2`, creada a mano y restringida
  a Maps + Directions, es la de `VITE_GOOGLE_MAPS_API_KEY`. Cada origen nuevo
  —IP de la red local, nombre `*.ts.net`— hay que añadirlo a las restricciones
  de la segunda **y** a los dominios autorizados de Firebase Auth.
- **2026-09-20** — Primer inicio de sesión real con Google, correcto. El listado
  de spots carga con sus distancias. El mapa, en cambio, quedó en negro: era el
  propio contenedor (`.google-map-dark` fuerza `#020617`), no un hueco vacío, de
  modo que el componente se montaba pero no llegaban las teselas.
- **2026-09-20** — Causa del mapa en negro: `ApiTargetBlockedMapError`. No era
  el referente —esa restricción estaba bien guardada— sino la restricción **de
  API** de la clave, que no incluía la Maps JavaScript API. El selector de
  Google ofrece varias APIs de nombre casi idéntico y el error no dice cuál
  falta. Añadido a la tabla de diagnóstico de la guía.
- **2026-09-20** — Anotada deuda técnica con reloj en marcha: la consola avisa
  de que `google.maps.Marker` está obsoleto desde 2024-02-21 en favor de
  `AdvancedMarkerElement`, y `DirectionsService` y `DirectionsRenderer` desde
  2026-02-25 en favor de `routes.Route.computeRoutes`. Nada deja de funcionar
  hoy y Google promete 12 meses de preaviso, pero afecta a `App.tsx` y a
  `useRuta`. Pendiente de ficha propia; no se toca mientras el entorno no esté
  verificado de punta a punta.
- **2026-09-20** — **Fase 0 cerrada: la app corre entera por primera vez.**
  Mapa de Google con el tema oscuro de la maqueta, marcadores de los spots
  sobre Santiago, sesión iniciada con Google y listados con distancias. Tres de
  los siete criterios de REQ-013 quedan verificados.
- **2026-09-20** — Lo que costó una hora fue una confusión de la consola de
  Google, no un fallo del código: la pantalla de la clave tiene **dos bloques
  de restricciones con nombres casi idénticos** —"Restricciones de API" (qué
  APIs puede llamar) y "Restricciones de aplicaciones" (desde dónde se puede
  usar)—. La clave había quedado restringida a `Address Validation API` y
  `BigQuery Connection API`, las dos primeras del desplegable en orden
  alfabético, y los intentos de arreglo fueron a parar al bloque equivocado.
- **2026-09-20** — Método que resolvió el diagnóstico, por si vuelve a pasar:
  Google distingue `ApiNotActivatedMapError` (la API no está habilitada en el
  proyecto) de `ApiTargetBlockedMapError` (sí lo está, pero la clave no puede
  llamarla). Ver el segundo descartó de un plumazo toda la rama de "habilitar
  la API" y dejó el problema acotado a la lista de la clave. Además, una
  llamada a la Directions API desde el servidor devolvió "API keys with referer
  restrictions cannot be used with this API", lo que confirmó que la
  restricción por sitio web seguía en pie y que el bloqueo era de otra cosa.
- **2026-09-20** — Registrado el aviso pendiente: la clave quedó
  temporalmente en "No restringir clave" para aislar la causa. Hay que volver a
  restringirla a **Maps JavaScript API** y **Directions API**; viaja en el
  bundle del navegador y el proyecto tiene tarjeta asociada.
- **2026-09-20** — [REQ-013] **Fase 3 cerrada: la app se ve desde el celular.**
  Vite escuchando en `0.0.0.0` con `--host`, regla de firewall para el puerto
  5173 en perfil privado, y el origen de la red local añadido a
  `CORS_ORIGINS`. Verificado desde un iPhone en Safari contra
  `http://192.168.1.105:5173`, entrando como invitado. Cuatro de los siete
  criterios de la ficha quedan cumplidos.
- **2026-09-20** — Confirmados en el celular los dos límites que ya estaban
  previstos: el acceso con Google avisa de dominio no autorizado —Firebase no
  admite direcciones IP como dominio— y la ubicación real no se entrega, porque
  HTTP no es contexto seguro. Ambos se resuelven de una vez en la Fase 4.
- **2026-09-20** — El aviso de dominio no autorizado apareció **en pantalla y
  con texto accionable**, no en la consola. Es el refuerzo de `useAuth` que se
  hizo el 30 de agosto funcionando como se diseñó: el error dejó de tragarse
  con un `console.error`.
- **2026-09-20** — Reescrita por completo
  `docs/guias/puesta-en-marcha.md` a nivel junior, a petición de Alfredo, para
  poder repetir el proceso con Diego. Añadidos: explicación de la arquitectura
  en cuatro piezas, cinco conceptos mínimos en secciones plegables
  (contenedor, puerto, variable de entorno, clave de API, contexto seguro), el
  porqué de cada comando, una sección de trabajo diario con el flujo de ramas
  y el ciclo de commits, y una tabla de diagnóstico con las catorce trampas
  reales encontradas —entre ellas los dos bloques de restricciones de Google,
  la diferencia entre `ApiNotActivatedMapError` y `ApiTargetBlockedMapError`, y
  que PowerShell y CMD no comparten comandos—.

## 9. Análisis de `espotealo` (2026-09-29)

Diego entregó una refactorización completa en `espotealo/`, hecha con Claude.
Levantada en local y analizada. Es una app bastante más madura que la que
teníamos en `frontend/`.

**Lo que trae**

| | `frontend/` (lo que había) | `espotealo/` (lo nuevo) |
|---|---|---|
| Líneas de frontend | 2.256 | 9.655 |
| Layouts | uno solo | móvil y escritorio separados a propósito |
| Tema | oscuro | claro |
| Endpoints | 12 | 41 |
| Claves de mapa | ninguna | Google Maps y OpenRouteService, funcionando |
| Contenido | 5 spots de prueba | 10+ spots reales con foto y eventos chilenos |
| Rutas | Google Directions | OpenRouteService |

Pantallas que no teníamos: comunidad con publicaciones y comentarios, feed de
actividad, notificaciones, favoritos, desafíos, edición de perfil, asistencia a
eventos, reseñas y fotos tanto de spots como de eventos, onboarding.

**Hallazgos que importan**

1. **No persiste nada.** Sin credenciales de Firebase Admin, `server.ts` cae a
   un array en memoria. Los diez spots reaparecen al reiniciar porque están
   escritos en el código, pero todo lo que cree un usuario se pierde.
2. **OpenRouteService en vez de Google Directions.** Decisión deliberada y
   mejor que la mía: Directions exige billing habilitado, ORS es gratis y sin
   tarjeta. La clave ya está puesta y funciona.
3. **Un solo proceso.** `npm run dev` levanta API y Vite juntos en el 3000,
   con Express haciendo de middleware de Vite.
4. **Incompatibilidad de formato en `category`.** espotealo guarda `"skate"`
   como cadena suelta; nuestro backend espera un array JSON serializado
   (`'["skate"]'`). Hay que unificar antes de conectar nada.
5. **Campos nuevos en Spot** que nuestra tabla no tiene: `open_hours`,
   `spot_type`, `features[]`, `difficulty`, `rating`, `review_count`.
6. Mucho está marcado como MOCK en el propio código: perfil, desafíos,
   favoritos, edición de perfil y los conmutadores de configuración.

**Lo que nuestro backend tiene y el suyo no**: persistencia real, PostGIS con
índice espacial, migraciones, moderación con auditoría y todo el entorno en
Docker.

- **2026-09-29** — [ADR-005] `espotealo/` pasa a ser el frontend del proyecto y
  se elimina `frontend/` (recuperable con `git checkout 41bd314 -- frontend`).
  La capa de datos será Firestore, no nuestro PostgreSQL: decisión de Alfredo
  priorizando tener persistencia hoy sobre las consultas geoespaciales. Queda
  registrado en el ADR qué se pierde y qué señales deberían reabrirlo.
- **2026-09-29** — La configuración de Firebase de espotealo deja de estar
  escrita en el código: sale del entorno y solo cae al JSON de AI Studio si no
  se define. Añadida una línea de diagnóstico al arrancar que dice proyecto,
  base y si hay credencial — antes no había forma de saber contra qué corría.
- **2026-09-29** — El acceso con Google en espotealo fallaba en silencio por la
  misma causa de siempre (`auth/unauthorized-domain`) y el mismo motivo:
  `handleGoogleSignIn` se tragaba el error con un `console.error`. Ahora se
  muestra en pantalla con instrucciones, hay reserva por redirección y se
  recoge el resultado al volver.
