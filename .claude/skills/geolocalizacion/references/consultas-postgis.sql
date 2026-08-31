-- =============================================================================
-- urbanFlow — consultas geoespaciales de referencia (PostgreSQL 16 + PostGIS 3.4)
-- Todas asumen: spots.ubicacion geography(Point,4326) con índice GiST.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Esquema mínimo
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE estado_spot   AS ENUM ('borrador','en_revision','aprobado','rechazado','archivado');
CREATE TYPE origen_coord  AS ENUM ('gps_dispositivo','exif_foto','pin_manual');
CREATE TYPE tipo_acceso   AS ENUM ('publico','privado','requiere_permiso');

CREATE TABLE spots (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre             text NOT NULL,
  descripcion        text,
  ubicacion          geography(Point, 4326) NOT NULL,
  precision_metros   numeric(6,1),
  origen_coordenada  origen_coord NOT NULL,
  acceso             tipo_acceso NOT NULL DEFAULT 'publico',
  estado             estado_spot NOT NULL DEFAULT 'en_revision',
  autor_id           uuid NOT NULL REFERENCES usuarios(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  aprobado_en        timestamptz,
  aprobado_por       uuid REFERENCES usuarios(id),
  CONSTRAINT chk_precision CHECK (precision_metros IS NULL OR precision_metros <= 100)
);

-- Un spot puede servir para varios deportes (un bowl: skate + BMX + patines).
CREATE TABLE spot_deportes (
  spot_id  uuid REFERENCES spots(id) ON DELETE CASCADE,
  deporte  text NOT NULL,
  PRIMARY KEY (spot_id, deporte)
);

-- Índice espacial. Sin esto nada de lo de abajo escala.
CREATE INDEX idx_spots_ubicacion ON spots USING GIST (ubicacion);

-- Índice parcial: el 99% de las lecturas públicas filtran por aprobado.
CREATE INDEX idx_spots_aprobados ON spots USING GIST (ubicacion)
  WHERE estado = 'aprobado';

-- -----------------------------------------------------------------------------
-- 1. "Spots cerca de mí" — radio en metros
--    $1 = lng del usuario, $2 = lat del usuario, $3 = radio en metros (tope 50000)
-- -----------------------------------------------------------------------------
SELECT
  s.id,
  s.nombre,
  ST_Y(s.ubicacion::geometry) AS lat,
  ST_X(s.ubicacion::geometry) AS lng,
  ROUND(ST_Distance(s.ubicacion, ST_MakePoint($1, $2)::geography)::numeric, 0) AS distancia_m
FROM spots s
WHERE s.estado = 'aprobado'
  -- ST_DWithin usa el índice GiST; ST_Distance en el WHERE NO lo usaría.
  AND ST_DWithin(s.ubicacion, ST_MakePoint($1, $2)::geography, LEAST($3, 50000))
ORDER BY s.ubicacion <-> ST_MakePoint($1, $2)::geography   -- KNN, también indexado
LIMIT 100;

-- -----------------------------------------------------------------------------
-- 2. Spots en el viewport del mapa
--    $1..$4 = lng_min, lat_min, lng_max, lat_max (esquinas del mapa visible)
--    Esta consulta se dispara en cada paneo: mantenla barata y siempre acotada.
-- -----------------------------------------------------------------------------
SELECT
  s.id,
  s.nombre,
  ST_Y(s.ubicacion::geometry) AS lat,
  ST_X(s.ubicacion::geometry) AS lng
FROM spots s
WHERE s.estado = 'aprobado'
  AND s.ubicacion && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
LIMIT 500;

-- -----------------------------------------------------------------------------
-- 3. Clustering por zoom — para zoom < 14 devolver grupos, no puntos
--    $5 = tamaño de celda en grados (deriva del zoom: 360 / 2^zoom * factor)
--    Devuelve el centroide de cada grupo y cuántos spots contiene.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                        AS cantidad,
  ST_Y(ST_Centroid(ST_Collect(g.pt)))             AS lat,
  ST_X(ST_Centroid(ST_Collect(g.pt)))             AS lng,
  -- Si el grupo tiene un solo spot, devolvemos su id para poder abrirlo directo.
  CASE WHEN COUNT(*) = 1 THEN MIN(g.id::text) END AS spot_id
FROM (
  SELECT s.id, s.ubicacion::geometry AS pt
  FROM spots s
  WHERE s.estado = 'aprobado'
    AND s.ubicacion && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
) g
GROUP BY
  FLOOR(ST_X(g.pt) / $5),
  FLOOR(ST_Y(g.pt) / $5);

-- -----------------------------------------------------------------------------
-- 4. Deduplicación al crear un spot
--    Busca spots aprobados del mismo deporte a menos de 75 m.
--    Si devuelve filas, el spot entra como 'en_revision' con marca de duplicado
--    y el moderador decide. Nunca se rechaza automáticamente.
-- -----------------------------------------------------------------------------
SELECT
  s.id,
  s.nombre,
  ROUND(ST_Distance(s.ubicacion, ST_MakePoint($1, $2)::geography)::numeric, 1) AS distancia_m
FROM spots s
JOIN spot_deportes d ON d.spot_id = s.id
WHERE s.estado IN ('aprobado','en_revision')
  AND d.deporte = $3
  AND ST_DWithin(s.ubicacion, ST_MakePoint($1, $2)::geography, 75)
ORDER BY distancia_m
LIMIT 5;

-- -----------------------------------------------------------------------------
-- 5. Validación de entrada — aplícala ANTES del INSERT, en la capa de API
--    y también aquí como red de seguridad.
-- -----------------------------------------------------------------------------
ALTER TABLE spots ADD CONSTRAINT chk_coordenada_valida CHECK (
  ST_X(ubicacion::geometry) BETWEEN -180 AND 180
  AND ST_Y(ubicacion::geometry) BETWEEN -90 AND 90
  -- Isla Null: (0,0) casi siempre significa "el GPS devolvió basura".
  AND NOT (ST_X(ubicacion::geometry) = 0 AND ST_Y(ubicacion::geometry) = 0)
);

-- -----------------------------------------------------------------------------
-- 6. Verificar que el índice se está usando de verdad
--    Debe aparecer "Index Scan using idx_spots_aprobados". Si dice "Seq Scan",
--    la consulta está mal escrita (típicamente ST_Distance en el WHERE).
-- -----------------------------------------------------------------------------
-- EXPLAIN ANALYZE <consulta 1>;
