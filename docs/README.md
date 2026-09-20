# Índice de documentación de urbanFlow

Toda petición de ejecución empieza aquí. Si algo no tiene ficha, no se
implementa; si se implementa algo, su ficha se actualiza el mismo día.

- **Bitácora del proyecto:** [urbanflow.md](./urbanflow.md)
- **Puesta en marcha (guía operativa):** [guias/puesta-en-marcha.md](./guias/puesta-en-marcha.md)
- **Dossier para marcas e infraestructura:** [propuesta-marcas.html](./propuesta-marcas.html)
- **Cómo se crean las fichas:** las genera el agente `urbanflow-planner`
  (`.claude/agents/urbanflow-planner.md`). Invócalo con el agente en lugar de
  escribir fichas a mano, para que el formato y el índice no se desincronicen.

## Convenciones

| Prefijo | Significado | Carpeta |
|---|---|---|
| `FEAT` | Capacidad de producto de cara al usuario o al moderador | `features/` |
| `REQ` | Requerimiento técnico, de infraestructura, legal o de tiendas | `requerimientos/` |
| `ADR` | Decisión de arquitectura con alternativas descartadas | `decisiones/` |
| — | Guías operativas: cómo ejecutar algo paso a paso | `guias/` |

**Estados:** `propuesto` → `aprobado` → `en-curso` → `hecho`.
Fuera del carril: `bloqueado`, `cancelado`.
**Prioridades:** `P0` crítico para lanzar · `P1` alto · `P2` medio · `P3` backlog.

Los IDs no se reciclan nunca, ni siquiera si la ficha se cancela.

## Features

| ID | Título | Épica | Prioridad | Estado | Ficha |
|---|---|---|---|---|---|
| FEAT-001 | Subida de spot con foto y ubicación | captura | P0 | propuesto | [ver](./features/FEAT-001-subida-de-spot.md) |
| FEAT-002 | Mapa público de spots aprobados | mapa | P0 | propuesto | [ver](./features/FEAT-002-mapa-publico.md) |
| FEAT-003 | Cola de revisión y aprobación interna | moderacion | P0 | propuesto | [ver](./features/FEAT-003-cola-de-revision.md) |
| FEAT-004 | Registro, inicio de sesión y borrado de cuenta | cuenta | P0 | propuesto | ficha pendiente |
| FEAT-005 | Detalle del spot y cómo llegar | mapa | P0 | propuesto | ficha pendiente |
| FEAT-006 | "Mis spots" con estado de moderación | captura | P0 | propuesto | ficha pendiente |
| FEAT-007 | Reporte de contenido y bloqueo de usuario | moderacion | P0 | propuesto | ficha pendiente |
| FEAT-008 | Detección de spots duplicados por cercanía | moderacion | P1 | propuesto | ficha pendiente |
| FEAT-009 | Filtros por deporte y por tipo de acceso | mapa | P1 | propuesto | ficha pendiente |
| FEAT-010 | Backoffice web de moderación | backoffice | P0 | propuesto | ficha pendiente |
| FEAT-011 | Notificaciones push del resultado de la revisión | cuenta | P1 | propuesto | ficha pendiente |
| FEAT-012 | Valoraciones y estado del spot reportado por la comunidad | mapa | P2 | propuesto | ficha pendiente |
| FEAT-013 | Spots destacados o patrocinados por marca | marca | P3 | propuesto | ficha pendiente |

## Requerimientos

| ID | Título | Épica | Prioridad | Estado | Ficha |
|---|---|---|---|---|---|
| REQ-001 | Cumplimiento de contenido generado por usuarios (Apple 1.2) | legal | P0 | propuesto | [ver](./requerimientos/REQ-001-cumplimiento-ugc.md) |
| REQ-002 | Cuentas de desarrollador en App Store y Google Play | legal | P0 | propuesto | ficha pendiente |
| REQ-003 | Política de privacidad y términos publicados | legal | P0 | propuesto | ficha pendiente |
| REQ-004 | Licencia de uso de las fotos subidas por usuarios | legal | P0 | propuesto | ficha pendiente |
| REQ-005 | Aprovisionamiento del VPS y despliegue con Docker | infra | P0 | propuesto | ficha pendiente |
| REQ-006 | Almacenamiento de imágenes y CDN | infra | P0 | propuesto | ficha pendiente |
| REQ-007 | Copias de seguridad y plan de restauración | infra | P0 | propuesto | ficha pendiente |
| REQ-008 | Observabilidad: errores, disponibilidad y métricas | infra | P1 | propuesto | ficha pendiente |
| REQ-009 | Integración continua y publicación con EAS | infra | P1 | propuesto | ficha pendiente |
| REQ-010 | Límites de tasa y protección contra abuso | infra | P1 | propuesto | ficha pendiente |
| REQ-011 | Consentimiento y tratamiento de datos personales | legal | P0 | propuesto | ficha pendiente |
| REQ-012 | Descargo de responsabilidad por uso de los spots | legal | P1 | propuesto | ficha pendiente |
| REQ-013 | Entorno de demostración en red local y réplica para el socio | infra | P0 | en-curso | [ver](./requerimientos/REQ-013-entorno-demo-red-local.md) |

## Decisiones de arquitectura

| ID | Título | Estado | Ficha |
|---|---|---|---|
| ADR-001 | Backend en Express + PostgreSQL/PostGIS, conservando el contrato | aceptado | [ver](./decisiones/ADR-001-backend-express-postgis.md) |
| ADR-002 | Proveedor de mapa: seguir en Google Maps o migrar a Mapbox | pendiente | ficha pendiente |
| ADR-003 | Moderación automática previa a la cola humana | pendiente | ficha pendiente |
| ADR-004 | Formato de la app: envolver la web o portar a React Native | pendiente | ficha pendiente |
