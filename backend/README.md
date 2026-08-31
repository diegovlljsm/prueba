# Backend de urbanFlow

API REST sobre **Node 22 + Express + TypeScript** y **PostgreSQL 16 + PostGIS 3.4**.

Sirve exactamente el mismo contrato `/api/*` que consumía el `server.ts` de
Firestore que venía en `frontend/`, así que `frontend/src/services/api.ts`
funciona sin ningún cambio.

## Arrancar

Desde la raíz del repositorio, no desde esta carpeta:

```powershell
copy .env.example .env      # solo la primera vez
docker compose up -d --build
```

Levanta tres contenedores:

| Servicio | Puerto | Qué es |
|---|---|---|
| `db` | 5432 | PostgreSQL 16 con PostGIS 3.4 |
| `api` | 8080 | Esta API, con recarga en caliente sobre `src/` |
| `adminer` | 8081 | Cliente web para mirar las tablas |

Comprobar que está viva:

```powershell
curl http://localhost:8080/api/health
```

Luego, en otra terminal, el frontend:

```powershell
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Vite redirige `/api` al contenedor, así que las peticiones son del mismo
origen y no hay CORS de por medio.

## Migraciones

Los ficheros de `src/migrations/*.sql` se aplican solos al arrancar, en orden
alfabético y una única vez (se registran en la tabla `_migraciones`). Para
añadir un cambio de esquema, crea `002_lo_que_sea.sql` y reinicia el
contenedor: `docker compose restart api`.

Para empezar de cero y perder los datos:

```powershell
docker compose down -v
docker compose up -d --build
```

## Autenticación

La identidad la sigue emitiendo **Firebase Auth desde el navegador** —eso no
cambió—. Lo que cambia es quién verifica el token, según `AUTH_MODE`:

- **`dev`** (por defecto en local): decodifica el JWT **sin comprobar la
  firma**. Existe para poder trabajar hoy, sin la clave de servicio del
  proyecto de Firebase. También acepta un atajo para curl:

  ```
  Authorization: Bearer dev:mi-uid:correo@ejemplo.com
  ```

  El proceso se niega a arrancar con `NODE_ENV=production` en este modo.

- **`firebase`**: verifica de verdad con `firebase-admin`. Requiere bajar la
  clave de servicio desde la consola de Firebase (Configuración del proyecto →
  Cuentas de servicio), dejarla en `backend/secrets/serviceAccountKey.json` y
  poner en `.env`:

  ```
  AUTH_MODE=firebase
  GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/serviceAccountKey.json
  ```

**Roles.** Un correo listado en `ADMIN_EMAILS` se promueve a `admin` la primera
vez que entra, y en cada petición posterior. El rol vive en la tabla `users` y
es la única fuente de autorización del servidor: el `isAdmin` del cliente solo
sirve para mostrar u ocultar pestañas.

## Endpoints

Los diez primeros son los que ya usaba el frontend, con la misma forma de
petición y de respuesta.

| Método | Ruta | Quién |
|---|---|---|
| GET | `/api/health` | público |
| GET | `/api/spots` | público |
| POST | `/api/spots` | identificado |
| DELETE | `/api/spots/:id` | admin |
| GET | `/api/events` | público |
| POST | `/api/events` | admin |
| GET | `/api/spots/:id/videos` | público (solo aprobados) |
| POST | `/api/videos` | identificado |
| GET | `/api/admin/pending-videos` | admin |
| POST | `/api/admin/videos/:id/approve` | admin |
| POST | `/api/admin/videos/:id/reject` | admin |

### Filtros geográficos (añadidos, opcionales)

`GET /api/spots` sin parámetros devuelve todos los spots aprobados, igual que
antes. Los parámetros son aditivos y no rompen al cliente actual:

```
GET /api/spots?bbox=-70.70,-33.46,-70.60,-33.40     lo que cabe en la pantalla
GET /api/spots?near=-70.6621,-33.4312&radius=1500   lo que hay a 1,5 km
```

`bbox` usa `&&` contra el índice GiST; `near` usa `ST_DWithin`. Ninguno de los
dos calcula distancias sobre la tabla entera, que es justo lo que no podía
hacer Firestore. El radio se acota a 50 km en el servidor.

## Estructura

```
src/
  index.ts            arranque, migraciones, cierre limpio
  app.ts              express, CORS, manejador de errores
  config.ts           lectura y validación del entorno
  db.ts               pool de Postgres, espera de arranque, migrador
  auth.ts             requireAuth / requireAdmin, verificación pluggable
  schemas.ts          Zod: cuerpos, parámetros de consulta, :id
  http.ts             asyncHandler
  routes/             spots.ts · events.ts · videos.ts
  migrations/         001_init.sql
```

## Deuda conocida

- Las fotos viajan como data URL en base64 dentro del JSON y se guardan en una
  columna `text`. Funciona para probar; tiene que pasar a almacenamiento de
  objetos (REQ-006). El límite del cuerpo está en 12 MB por eso.
- `spots.status` existe pero por defecto es `aprobado`: el frontend publica
  directo. Activar la cola de revisión de spots es FEAT-003.
- `CATEGORY_IDS` está duplicado aquí y en `frontend/src/constants.shared.ts`.
  Si se añade una categoría, hay que tocar los dos.
