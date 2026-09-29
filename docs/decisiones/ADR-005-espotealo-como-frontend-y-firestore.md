---
id: ADR-005
titulo: espotealo pasa a ser el frontend, y Firestore la capa de datos
estado: aceptado
fecha: 2026-09-29
decide: Alfredo
revierte: ADR-001 (parcialmente)
---

## Contexto

Diego entregó `espotealo/`, una refactorización completa de la aplicación hecha
con Claude. Comparada con el `frontend/` que teníamos:

| | `frontend/` | `espotealo/` |
|---|---|---|
| Frontend | 2.256 líneas | 9.655 |
| Layouts | uno | móvil y escritorio, separados a propósito |
| Endpoints | 12 | 41 |
| Claves de mapa | ninguna | Google Maps y OpenRouteService, funcionando |
| Contenido | 5 spots de prueba | 10+ spots reales con foto y eventos chilenos |

Trae pantallas que no teníamos: comunidad con publicaciones y comentarios, feed
de actividad, notificaciones, favoritos, desafíos, edición de perfil,
asistencia a eventos, y reseñas y fotos tanto de spots como de eventos.

El enfoque del proyecto es el diseño, y el diseño lo hace Diego. Mantener dos
frontends en el repositorio garantiza que tarde o temprano alguien edite el
equivocado.

## Decisión

1. **`espotealo/` es el frontend del proyecto.** `frontend/` se elimina; queda
   en el historial de git, recuperable con `git checkout 41bd314 -- frontend`.
2. **La capa de datos es Firestore**, la que ya usa `server.ts` de espotealo,
   alimentada con una clave de cuenta de servicio para que persista.
3. La configuración de Firebase deja de estar escrita en el código: sale de
   variables de entorno y solo cae al JSON de AI Studio si no se definen.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Migrar por fases a nuestro PostgreSQL + PostGIS | Era la recomendación técnica, pero implica portar 41 endpoints. Se priorizó tener persistencia hoy y no frenar el trabajo de diseño |
| Portar los 41 endpoints de golpe | Varios días sin nada visible y con riesgo de romper pantallas que ya funcionan |
| Quedarnos con `frontend/` | El diseño es el foco del proyecto y espotealo lo supera con creces |

## Consecuencias

**A favor**

- Persistencia real en cuanto se coloque la clave de servicio: es un fichero,
  no una migración.
- Las 41 rutas y todas las pantallas siguen funcionando sin tocarlas.
- El mapa por fin se ve: las claves de Maps y OpenRouteService venían dentro.
- Rutas con OpenRouteService en lugar de Google Directions. Mejor decisión que
  la del ADR-002: ORS es gratis y sin tarjeta, Directions exige billing.

**En contra — y hay que asumirlo con los ojos abiertos**

- **Se pierden las consultas geoespaciales.** Firestore no sabe responder "los
  spots que caben en la pantalla" ni "los que hay a 3 km". `GET /api/spots` se
  trae la colección entera y el cliente filtra. Con decenas de spots no se
  nota; con miles, el mapa deja de responder y además se paga por documento
  leído en cada paneo.
- Esto **revierte el ADR-001**, cuyo motivo central era precisamente ese. La
  decisión sigue siendo válida como análisis; lo que cambió es la prioridad.
- `backend/` y `docker-compose.yml` quedan sin uso. No se borran: son la base
  de la migración cuando el volumen obligue a volver.
- El día que haya que migrar, habrá datos de usuarios reales de por medio, que
  es el escenario caro. Conviene fijar de antemano el umbral que dispara la
  migración.

## Señales para revisar esta decisión

Cualquiera de estas debería reabrir el debate:

- Más de ~500 spots aprobados en una ciudad.
- El primer paneo del mapa que tarde más de un segundo.
- La primera factura de Firestore que sorprenda.

## Trazabilidad

- Origen: entrega de `espotealo/` por Diego, 2026-09-29.
- Relacionados: [[ADR-001]], [[ADR-002]], [[FEAT-002]].
