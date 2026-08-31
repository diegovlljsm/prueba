import { Router } from "express";
import { requireAdmin, requireAuth } from "../auth.js";
import { pool } from "../db.js";
import { asyncHandler } from "../http.js";
import {
  parsearCategorias,
  spotCreateSchema,
  spotsQuerySchema,
  validateBody,
  validateIdParam,
  validateQuery,
} from "../schemas.js";
import type { z } from "zod";

export const spotsRouter = Router();

// Las columnas que el frontend espera, con la geografía descompuesta en los
// mismos lat/lng que devolvía la versión con Firestore.
const COLUMNAS_SPOT = `
  id,
  name,
  description,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng,
  category,
  marker_color,
  show_label,
  image_url,
  location_name,
  floor_quality,
  obstacles,
  status,
  created_by,
  created_at
`;

/**
 * GET /api/spots
 *
 * Sin parámetros devuelve todos los spots aprobados, que es lo que hace hoy
 * el cliente. Los filtros geográficos son añadidos y opcionales, para que el
 * mapa pueda dejar de traerse la ciudad entera en cuanto haga falta:
 *
 *   ?bbox=minLng,minLat,maxLng,maxLat   lo que cabe en la pantalla
 *   ?near=lng,lat&radius=3000           lo que hay a N metros a la redonda
 */
spotsRouter.get(
  "/spots",
  validateQuery(spotsQuerySchema),
  asyncHandler(async (_req, res) => {
    const { bbox, near, radius, limit } = res.locals.query as z.infer<typeof spotsQuerySchema>;

    const condiciones = ["status = 'aprobado'"];
    const valores: unknown[] = [];
    let orden = "created_at DESC";

    if (bbox) {
      valores.push(bbox[0], bbox[1], bbox[2], bbox[3]);
      // && usa el índice GiST: compara el rectángulo contra la caja del punto.
      condiciones.push(
        `location && ST_MakeEnvelope($${valores.length - 3}, $${valores.length - 2}, $${
          valores.length - 1
        }, $${valores.length}, 4326)::geography`
      );
    }

    if (near) {
      valores.push(near[0], near[1], radius);
      const iLng = valores.length - 2;
      const iLat = valores.length - 1;
      const iRadio = valores.length;
      // ST_DWithin sí aprovecha el índice; ST_Distance en el WHERE no lo haría.
      condiciones.push(
        `ST_DWithin(location, ST_MakePoint($${iLng}, $${iLat})::geography, $${iRadio})`
      );
      orden = `location <-> ST_MakePoint($${iLng}, $${iLat})::geography`;
    }

    valores.push(limit);

    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_SPOT}
       FROM spots
       WHERE ${condiciones.join(" AND ")}
       ORDER BY ${orden}
       LIMIT $${valores.length}`,
      valores
    );

    res.json(rows);
  })
);

/**
 * POST /api/spots
 *
 * Cualquier usuario identificado puede proponer un spot. `created_by` sale del
 * token verificado, nunca del cuerpo: el cliente no puede atribuirle un spot
 * a otra persona.
 */
spotsRouter.post(
  "/spots",
  requireAuth,
  validateBody(spotCreateSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof spotCreateSchema>;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO spots (
         name, description, location, category, categories, marker_color,
         show_label, image_url, location_name, floor_quality, obstacles, created_by
       ) VALUES (
         $1, $2, ST_MakePoint($3, $4)::geography, $5, $6, $7,
         $8, $9, $10, $11, $12, $13
       )
       RETURNING id`,
      [
        b.name,
        b.description,
        b.lng,
        b.lat,
        b.category,
        parsearCategorias(b.category),
        b.marker_color,
        b.show_label,
        b.image_url ?? null,
        b.location_name ?? null,
        b.floor_quality ?? null,
        b.obstacles ?? null,
        req.authUser!.uid,
      ]
    );

    res.status(201).json({ id: rows[0]!.id });
  })
);

/**
 * DELETE /api/spots/:id
 *
 * Moderar el mapa es acción de administrador. Los videos del spot caen con él
 * por la clave foránea ON DELETE CASCADE, sin borrado manual como hacía la
 * versión con Firestore.
 */
spotsRouter.delete(
  "/spots/:id",
  requireAdmin,
  validateIdParam,
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM spots WHERE id = $1", [req.params.id]);

    if (!rowCount) {
      return res.status(404).json({ error: "Spot no encontrado" });
    }
    res.json({ success: true });
  })
);
