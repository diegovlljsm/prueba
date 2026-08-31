---
id: ADR-001
titulo: Express + PostgreSQL/PostGIS para el backend, conservando el contrato del frontend
estado: aceptado
fecha: 2026-08-30
decide: Alfredo
---

## Contexto

Diego entregó el frontend generado en Google AI Studio: una aplicación web con
Vite + React 19 + Tailwind 4, mapa con `@vis.gl/react-google-maps`, Firebase
Auth para la identidad y un `server.ts` de Express que guardaba todo en
Firestore.

Ese `server.ts` tiene tres problemas para lo que necesitamos:

1. **Firestore no hace consultas geoespaciales.** `GET /api/spots` ejecuta
   `spotsCol.get()`: se trae todos los spots de la colección y filtra en el
   cliente. Con quinientos spots ya es lento y con cinco mil es inviable, y es
   exactamente la consulta que más se ejecuta en la app.
2. **No se levanta en local con Docker.** Solo existe el emulador, y aun así
   haría falta un proyecto de Firebase y una clave de servicio para trabajar.
3. **Contradice ADR pendiente y la skill `geolocalizacion`**, que dan por hecho
   PostGIS.

## Decisión

Se construye un backend propio en `backend/`, con **Express + TypeScript sobre
PostgreSQL 16 + PostGIS 3.4**, que expone **exactamente el mismo contrato
`/api/*`** que el `server.ts` de Firestore.

Tres decisiones dentro de la decisión:

- **Express, no NestJS ni Fastify.** El contrato ya estaba escrito en Express y
  copiarlo tal cual elimina toda una clase de errores de traducción. Once
  endpoints no justifican la ceremonia de NestJS, y el margen de rendimiento de
  Fastify es irrelevante frente a la latencia de la base y de las imágenes.
- **Se conserva Firebase Auth en el cliente.** La pantalla de login ya funciona
  y sustituirla no aporta nada hoy. El backend solo verifica el token.
- **La verificación del token es intercambiable** (`AUTH_MODE`): en local
  decodifica sin comprobar la firma, para poder trabajar sin la clave de
  servicio del proyecto; en cualquier despliegue verifica con `firebase-admin`.
  El proceso se niega a arrancar en modo dev con `NODE_ENV=production`.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Quedarse en Firestore | Sin consultas por radio ni por rectángulo, el mapa no escala. Y ata el proyecto a la facturación por lectura de documento, que crece con cada paneo del mapa |
| Firestore para datos + PostGIS solo para geo | Dos fuentes de verdad que hay que mantener sincronizadas. Toda la complejidad de las dos opciones y las ventajas de ninguna |
| Reescribir también la autenticación | Trabajo que no resuelve ningún problema actual, y rompería la pantalla que Diego ya dio por terminada |
| NestJS | Estructura que ayuda en equipos grandes; aquí solo añadiría capas sobre once endpoints ya escritos |

## Consecuencias

**A favor**

- El frontend no cambió: `src/services/api.ts` sigue igual. Solo se tocaron el
  script `dev` y el proxy de `vite.config.ts`.
- Las consultas por rectángulo y por radio ya existen y usan índice GiST.
- Todo el entorno se levanta con un `docker compose up`, sin cuentas externas.

**En contra**

- Hay que operar una base de datos: copias de seguridad, actualizaciones y
  espacio en disco pasan a ser responsabilidad nuestra (REQ-005, REQ-007).
- `CATEGORY_IDS` queda duplicado entre frontend y backend, porque son dos
  paquetes sin código compartido.
- El `server.ts` de Firestore queda en `frontend/` sin uso. Se conserva de
  momento como referencia del contrato original; hay que borrarlo cuando el
  nuevo backend esté asentado.

## Trazabilidad

- Origen: entrega del frontend de Diego, 2026-08-30.
- Relacionados: [[FEAT-001]], [[FEAT-002]], [[REQ-005]], skill `geolocalizacion`.
