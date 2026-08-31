-- 001_init.sql — esquema inicial de urbanFlow
--
-- Los nombres de columna replican los campos que ya usa el frontend de Diego
-- (name, marker_color, show_label…) para que la respuesta de la API sea
-- idéntica a la que devolvía la versión con Firestore y el cliente no cambie.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- users — espejo local de la identidad de Firebase Auth.
-- La contraseña nunca pasa por aquí: la gestiona Firebase. Guardamos el uid
-- para poder atribuir spots y videos, y el rol para autorizar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  uid          text PRIMARY KEY,
  email        text,
  display_name text,
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- spots
--
-- La ubicación se guarda como geography(Point,4326), no como dos columnas
-- numéricas: es lo que permite que "dame los spots que caben en la pantalla"
-- use el índice GiST en lugar de recorrer la tabla entera.
--
-- `category` conserva el string JSON tal cual lo manda el formulario del
-- frontend (p. ej. '["skate","bmx"]') para no romper el contrato. `categories`
-- es la versión desnormalizada del mismo dato, que sí se puede indexar y
-- filtrar. Se rellenan siempre a la vez desde la API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  location      geography(Point, 4326) NOT NULL,
  category      text NOT NULL,
  categories    text[] NOT NULL DEFAULT '{}',
  marker_color  text NOT NULL DEFAULT '#10b981',
  show_label    boolean NOT NULL DEFAULT true,
  image_url     text,
  location_name text,
  floor_quality text,
  obstacles     text,
  -- Hoy el frontend publica los spots directamente, así que el valor por
  -- defecto es 'aprobado' y el comportamiento no cambia. La columna existe
  -- desde el principio para que activar la cola de revisión (FEAT-003) sea
  -- un cambio de código, no una migración con datos ya en producción.
  status        text NOT NULL DEFAULT 'aprobado'
                CHECK (status IN ('en_revision', 'aprobado', 'rechazado')),
  created_by    text REFERENCES users(uid) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT spots_location_valida CHECK (
    ST_X(location::geometry) BETWEEN -180 AND 180
    AND ST_Y(location::geometry) BETWEEN -90 AND 90
    -- Isla Null: (0,0) casi siempre significa que el GPS devolvió basura.
    AND NOT (ST_X(location::geometry) = 0 AND ST_Y(location::geometry) = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_spots_location   ON spots USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_spots_aprobados  ON spots USING GIST (location) WHERE status = 'aprobado';
CREATE INDEX IF NOT EXISTS idx_spots_categories ON spots USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_spots_created_by ON spots (created_by);

-- ---------------------------------------------------------------------------
-- events — contenido curado por el equipo, no generado por usuarios.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  date          timestamptz NOT NULL,
  location      geography(Point, 4326) NOT NULL,
  location_name text,
  category      text CHECK (category IS NULL OR category IN ('jam', 'contest', 'workshop')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date     ON events (date);
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST (location);

-- ---------------------------------------------------------------------------
-- videos — el contenido que sí pasa por moderación en la versión actual.
--
-- `spot_name` está desnormalizado a propósito: la pantalla de moderación
-- lista videos pendientes y necesita el nombre del spot sin una consulta por
-- fila. Se copia en el momento de subir, igual que hacía la versión Firestore.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id    uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  video_url  text NOT NULL,
  user_name  text NOT NULL,
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'rejected')),
  spot_name  text,
  created_by text REFERENCES users(uid) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- La consulta más frecuente del detalle de un spot: sus videos aprobados.
CREATE INDEX IF NOT EXISTS idx_videos_spot_status ON videos (spot_id, status);
-- La cola de moderación.
CREATE INDEX IF NOT EXISTS idx_videos_pendientes  ON videos (created_at) WHERE status = 'pending';
