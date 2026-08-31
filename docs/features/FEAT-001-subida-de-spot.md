---
id: FEAT-001
titulo: Subida de spot con foto y ubicación
estado: propuesto
prioridad: P0
epica: captura
esfuerzo: L
responsable: por-asignar
depende_de: [FEAT-004]
bloquea: [FEAT-003, FEAT-006, FEAT-008]
creado: 2026-08-30
actualizado: 2026-08-30
---

## Problema

Hoy no existe forma de que un spot llegue al sistema. Sin entrada de contenido
no hay mapa, no hay cola de moderación y no hay producto. Es la primera pieza
que debe funcionar de punta a punta.

La dificultad no es el formulario: es que la persona está de pie en la calle,
con una mano, con datos móviles irregulares y sin paciencia. Cada segundo de
espera y cada campo de más se pagan en spots que nunca se envían.

## Solución propuesta

Un flujo de cuatro pasos con progreso visible, borrador guardado en cada paso y
envío en segundo plano:

1. **Foto** — de cámara o galería. Entre una y cinco. Se comprimen en el
   dispositivo antes de subir.
2. **Ubicación** — el pin llega ya colocado desde el GPS o desde el EXIF de la
   foto, y se puede arrastrar para corregir. La precisión se muestra de forma
   honesta.
3. **Datos** — nombre, uno o varios deportes, tipo de acceso y descripción
   opcional.
4. **Envío** — sube en segundo plano con reintento; el usuario recupera el mapa
   de inmediato y recibe aviso cuando termina.

El spot entra en estado `en_revision`. No aparece en el mapa público hasta que
un moderador lo apruebe (FEAT-003).

## Alcance

**Incluye:** el flujo de cuatro pasos, la compresión en dispositivo, la captura
de coordenada por las tres vías, el borrador persistido, la subida reintentable,
y el endpoint de creación con validación.

**No incluye:** la edición de un spot ya enviado (ficha aparte), la detección de
duplicados (FEAT-008), la moderación automática de imágenes (ADR-003), ni la
notificación push del resultado (FEAT-011).

## Criterios de aceptación

- [ ] **Dado** que el usuario concedió el permiso de ubicación, **cuando** entra
      al paso 2, **entonces** el pin aparece ya en su posición actual y se
      muestra la precisión en metros.
- [ ] **Dado** que la precisión del GPS es peor que 50 m, **cuando** el usuario
      llega al paso 2, **entonces** se muestra "buscando señal" y se le ofrece
      colocar el pin a mano, en lugar de guardar una coordenada mala en
      silencio.
- [ ] **Dado** que el usuario denegó el permiso de ubicación, **cuando** entra
      al paso 2, **entonces** puede completar la subida colocando el pin a mano.
- [ ] **Dado** que la foto de galería tiene EXIF GPS, **cuando** se selecciona,
      **entonces** el pin se coloca en esa coordenada y `origen_coordenada`
      queda como `exif_foto`.
- [ ] **Dado** que el usuario cierra la app en el paso 3, **cuando** la vuelve a
      abrir, **entonces** recupera el borrador con las fotos ya seleccionadas.
- [ ] **Dado** que se pierde la conexión durante el envío, **cuando** se
      recupera, **entonces** la subida se reanuda sola sin intervención.
- [ ] **Dado** un envío correcto, **cuando** termina, **entonces** el spot queda
      en `en_revision` y **no** es visible en el mapa público.
- [ ] **Dado** un lote de cinco fotos de 12 MP con datos móviles, **cuando** se
      envía, **entonces** la subida completa tarda menos de 30 s.

## Notas técnicas

- **API:** `POST /spots` (multipart o URLs prefirmadas hacia el almacenamiento
  de objetos). Las prefirmadas son preferibles: la imagen no atraviesa la API.
- **Datos:** tabla `spots` con `ubicacion geography(Point,4326)`,
  `precision_metros`, `origen_coordenada` y `acceso`. Ver la skill
  `geolocalizacion` y `references/consultas-postgis.sql`.
- **Validación:** latitud ∈ [-90,90], longitud ∈ [-180,180], rechazo de (0,0),
  y `precision_metros` ≤ 100 en servidor, no solo en cliente.
- **Imágenes:** se elimina todo el EXIF salvo la coordenada, que ya se extrajo a
  la base de datos. El modelo de teléfono y el número de serie no se publican.
- **Cliente:** ver la skill `frontend-urbanflow`, sección 5.

## Riesgos y preguntas abiertas

- [ ] ¿Se exige cuenta para subir, o se permite subir y luego reclamar el spot?
      → Alfredo y Diego. Afecta a la dependencia con FEAT-004.
- [ ] ¿Cuál es el catálogo cerrado de deportes del lanzamiento? → Diego.
- [ ] Coste de almacenamiento si el ritmo de subida se dispara. → REQ-006.

## Trazabilidad

- Origen: definición inicial del producto, 2026-08-30.
- Relacionados: [[FEAT-003]], [[FEAT-006]], [[FEAT-008]], [[REQ-006]],
  [[REQ-011]].
