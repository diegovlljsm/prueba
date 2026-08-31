---
id: FEAT-002
titulo: Mapa público de spots aprobados
estado: propuesto
prioridad: P0
epica: mapa
esfuerzo: L
responsable: por-asignar
depende_de: [FEAT-003]
bloquea: [FEAT-005, FEAT-009]
creado: 2026-08-30
actualizado: 2026-08-30
---

## Problema

El mapa es la app. Es lo primero que se ve al abrir y la razón por la que
alguien la descarga: saber dónde puede entrenar cerca. Si tarda en cargar, si se
traba al arrastrar o si muestra spots que no interesan, no hay segunda
oportunidad.

## Solución propuesta

Mapa a pantalla completa desde el arranque, centrado en la ubicación del usuario
si concedió el permiso y en la ciudad de lanzamiento si no. Muestra únicamente
spots en estado `aprobado`.

Con el zoom alejado se ven agrupaciones con el número de spots; al acercarse se
abren en marcadores individuales. Al tocar un marcador se levanta el detalle
como panel inferior arrastrable, sin salir del mapa.

## Alcance

**Incluye:** el mapa, la consulta por viewport, el agrupamiento por zoom, el
centrado en el usuario, el estado sin permiso de ubicación y el estado sin
conexión.

**No incluye:** el contenido del detalle (FEAT-005), los filtros (FEAT-009), la
búsqueda por texto ni la navegación paso a paso.

## Criterios de aceptación

- [ ] **Dado** un mapa con 10.000 spots cargados en la base de datos,
      **cuando** el usuario pide el viewport visible, **entonces** la respuesta
      llega en menos de 300 ms en el percentil 95.
- [ ] **Dado** un zoom inferior a 14, **cuando** se carga el mapa, **entonces**
      se devuelven agrupaciones y nunca más de 150 marcadores individuales.
- [ ] **Dado** que el usuario arrastra el mapa de forma continua, **cuando**
      se detiene, **entonces** se dispara una sola consulta tras 300 ms de
      inactividad.
- [ ] **Dado** que el permiso de ubicación está denegado, **cuando** se abre la
      app, **entonces** el mapa se centra en la ciudad de lanzamiento y ofrece
      un acceso a los ajustes del sistema, sin bloquear el uso.
- [ ] **Dado** que no hay conexión, **cuando** se abre la app, **entonces** se
      muestran los últimos spots cacheados y un aviso claro de que están
      desactualizados.
- [ ] **Dado** un spot en cualquier estado distinto de `aprobado`, **cuando** se
      consulta el mapa público, **entonces** no aparece bajo ninguna
      circunstancia.

## Notas técnicas

- **API:** `GET /spots?bbox=lng_min,lat_min,lng_max,lat_max&zoom=n`. El servidor
  decide si devuelve agrupaciones o puntos según el zoom; el cliente no elige.
- **Consulta:** `ST_MakeEnvelope` sobre el índice parcial `idx_spots_aprobados`,
  siempre con `LIMIT`. Ver `references/consultas-postgis.sql`, consultas 2 y 3.
- **Tope de servidor:** un viewport mayor que el equivalente a zoom 8 devuelve
  solo agrupaciones, nunca puntos. Alguien va a alejar el mapa hasta ver el
  planeta entero.
- **Teselas:** decisión abierta en ADR-002. El coste variable del mapa depende
  de esa elección más que de ninguna otra pieza de infraestructura.

## Riesgos y preguntas abiertas

- [ ] ¿Ciudad de lanzamiento para el centrado por defecto? → Alfredo.
- [ ] ¿Se puede explorar el mapa sin cuenta? Cambia el volumen de cargas de mapa
      y, con ello, la factura del proveedor de teselas. → Alfredo y Diego.

## Trazabilidad

- Origen: definición inicial del producto, 2026-08-30.
- Relacionados: [[FEAT-003]], [[FEAT-005]], [[FEAT-009]], [[ADR-002]].
