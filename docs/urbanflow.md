# Bitácora de urbanFlow

Documento vivo. Todo lo que se decide, se descarta o queda pendiente en
urbanFlow se registra aquí. Si una decisión no está en esta bitácora, no está
tomada.

- **Última actualización:** 2026-08-30
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
