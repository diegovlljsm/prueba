---
name: geolocalizacion
description: Diseñar e implementar la geolocalización de urbanFlow — modelo de datos PostGIS, consultas por radio y por bounding box, clustering de spots en el mapa, deduplicación por cercanía, captura de coordenadas en el cliente móvil, EXIF GPS, permisos de ubicación en iOS/Android y privacidad de coordenadas. Úsala al crear o modificar cualquier endpoint, migración, consulta o pantalla que maneje latitud/longitud, mapas, radios de búsqueda, "spots cerca de mí" o proximidad.
---

# Geolocalización en urbanFlow

Regla base del proyecto: **la verdad geográfica vive en PostgreSQL con PostGIS**.
El cliente nunca calcula distancias para filtrar; solo pinta lo que el backend
devuelve. Cualquier cálculo de proximidad en JavaScript sobre el array completo
de spots es un bug de rendimiento esperando a escalar.

## 1. Tipo de dato: `geography`, no `geometry`, no dos columnas float

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE spots
  ADD COLUMN ubicacion geography(Point, 4326) NOT NULL;

CREATE INDEX idx_spots_ubicacion ON spots USING GIST (ubicacion);
```

Por qué `geography(Point, 4326)` y no las alternativas:

- **Dos columnas `lat`/`lng` con Haversine en SQL**: no usa índice espacial. Un
  `WHERE haversine(...) < 5000` hace *full scan* siempre. Inaceptable.
- **`geometry(Point, 4326)`**: mide en grados, no en metros. `ST_DWithin` con
  geometry y SRID 4326 recibe grados; el error de convertir "5 km ≈ 0.045°"
  crece con la latitud y en Santiago ya se nota. `geography` mide en **metros**
  sobre el esferoide y no tiene ese problema.
- El coste de `geography` (algo más lento) es irrelevante a la escala de
  urbanFlow y desaparece frente a un índice GiST bien usado.

Guarda siempre en WGS84 (SRID 4326), que es lo que emiten el GPS del teléfono,
el EXIF de la foto y las APIs de mapas. Ninguna proyección local.

## 2. Las tres consultas que necesita la app

**Nunca** escribas `ST_Distance(...) < x` en el `WHERE`: no aprovecha el índice.
Usa `ST_DWithin`, que sí lo hace.

Referencia completa con las consultas parametrizadas, el clustering y la
deduplicación: `references/consultas-postgis.sql`. En resumen:

1. **Spots cerca de mí** (radio en metros) → `ST_DWithin` + `ORDER BY` por
   distancia, con `LIMIT`. La distancia se calcula solo sobre las filas ya
   filtradas por el índice.
2. **Spots en el viewport** (lo que el mapa está mostrando) → `ST_MakeEnvelope`
   con las cuatro esquinas. Es la consulta que más se ejecuta: cada paneo del
   mapa la dispara. Debe ir siempre acotada con `LIMIT` y `estado = 'aprobado'`.
3. **Clustering por zoom** → agrupa por celda de rejilla cuando el zoom es bajo;
   devuelve puntos individuales solo desde zoom 14. Sin esto, el mapa de una
   ciudad con 5.000 spots colapsa el hilo de UI del teléfono.

## 3. Deduplicación: el problema real de un producto con UGC

Diez usuarios subirán el mismo bowl. Antes de aceptar un spot nuevo, busca
candidatos en un radio de **75 metros** con el mismo `deporte`. Si hay alguno,
no rechaces automáticamente: marca el spot como `posible_duplicado` y muéstrale
al moderador ambos lado a lado. La decisión es humana; el sistema solo la
prepara.

75 m es un compromiso deliberado: el GPS de un teléfono en zona urbana con
edificios altos tiene un error típico de 10-30 m, y dos bowls distintos casi
nunca están a menos de 75 m. Ajusta el umbral por tipo de deporte si aparece
evidencia (una zona de calistenia puede tener dos parques legítimos cerca).

## 4. Captura en el cliente móvil

Tres fuentes de coordenadas, en este orden de preferencia:

1. **Ubicación del dispositivo en el momento de la captura** — la mejor, porque
   confirma que la persona estuvo ahí. Pide precisión alta y **exige** un
   `accuracy` mejor que 50 m antes de aceptar; si no, muestra "buscando señal"
   en lugar de guardar una coordenada mala en silencio.
2. **EXIF GPS de la foto** — sirve cuando suben una foto de la galería. Extrae
   `GPSLatitude`/`GPSLongitude` y **conviértelos**: vienen en grados/minutos/
   segundos con referencia N/S/E/W, no en decimal. Un signo mal aplicado manda
   el spot al hemisferio opuesto.
3. **Ajuste manual arrastrando el pin** — siempre disponible como corrección, y
   obligatorio si las dos anteriores fallan.

Guarda de cuál de las tres vino (`origen_coordenada`) y el `precision_metros`.
El moderador necesita esa señal para decidir, y a ti te sirve para depurar.

## 5. Permisos: pedirlos mal es la causa número uno de rechazo

- **iOS** — `NSLocationWhenInUseUsageDescription` es obligatorio en `Info.plist`
  y su texto se muestra literalmente al usuario. Escríbelo en el idioma del
  usuario y explicando el beneficio concreto ("para ubicar el spot que estás
  fotografiando y mostrarte los que tienes cerca"), no el mecanismo. Un texto
  genérico se rechaza por guideline 5.1.1.
- **No pidas `Always`.** urbanFlow no necesita ubicación en segundo plano. Pedir
  `NSLocationAlwaysAndWhenInUseUsageDescription` sin justificarlo es rechazo casi
  seguro y además asusta al usuario.
- **Android** — `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION`. Desde Android
  12 el usuario puede conceder solo la aproximada: la app debe seguir
  funcionando con ella (mapa sí, subida de spot con ajuste manual del pin).
- **Pide el permiso en contexto**, cuando el usuario pulsa "subir spot" o "ver
  cerca de mí", nunca en el arranque. La tasa de aceptación cambia radicalmente
  y el rechazo en frío es irreversible sin ir a Ajustes.
- Maneja siempre los tres estados: concedido, denegado, y **denegado
  permanentemente** (este último necesita un enlace a los Ajustes del sistema).

## 6. Privacidad de coordenadas

- **Publica la coordenada exacta del spot** — es su razón de ser, es un lugar
  público. Pero **elimina el resto del EXIF de la foto** antes de servirla:
  modelo de teléfono, número de serie y fecha exacta no aportan nada y sí
  filtran datos de quien subió.
- **Nunca publiques la ubicación del usuario.** La posición del dispositivo se
  usa para consultar y se descarta; no se guarda en la base de datos ni se
  registra en logs. Si alguna vez hay que guardarla para analítica, se agrega
  redondeada a rejilla de ~1 km y sin identificador de usuario.
- Un spot en propiedad privada o en un colegio no debería publicarse aunque sea
  visible desde la calle: es una regla de moderación, no técnica, pero el
  formulario debe preguntarlo (`acceso: publico | privado | requiere_permiso`).

## 7. Errores a vigilar en revisión de código

- Orden invertido de coordenadas. PostGIS usa `ST_MakePoint(lng, lat)`, GeoJSON
  usa `[lng, lat]`, casi todas las APIs de teléfono devuelven `{lat, lng}` y los
  humanos escriben "lat, lng". Es el bug más frecuente del dominio y es
  silencioso: el punto simplemente aparece en otro continente. Nombra las
  variables `lng`/`lat` explícitamente, nunca `x`/`y` ni `coords[0]`.
- Validación de rango ausente: latitud ∈ [-90, 90], longitud ∈ [-180, 180], y
  rechaza el `(0, 0)` (isla Null) porque casi siempre significa "el GPS falló".
- `ST_Distance` en el `WHERE` en vez de `ST_DWithin`.
- Consulta de viewport sin `LIMIT`: un usuario con zoom alejado pide el planeta.
- Radios de búsqueda que llegan desde el cliente sin tope: acota en el servidor
  (máximo 50.000 m) o alguien pedirá el mundo entero.
