import { Router } from "express";
import { requireAdmin } from "../auth.js";
import { pool } from "../db.js";
import { asyncHandler } from "../http.js";
import { eventCreateSchema, validateBody } from "../schemas.js";
import type { z } from "zod";

export const eventsRouter = Router();

const COLUMNAS_EVENTO = `
  id,
  title,
  description,
  date,
  location_name,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng,
  category,
  created_at
`;

/** GET /api/events — agenda pública, del más próximo al más lejano. */
eventsRouter.get(
  "/events",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_EVENTO} FROM events ORDER BY date ASC LIMIT 500`
    );
    res.json(rows);
  })
);

/**
 * POST /api/events — contenido curado, no generado por usuarios.
 * Hoy ningún punto del cliente llama aquí; existe para el backoffice.
 */
eventsRouter.post(
  "/events",
  requireAdmin,
  validateBody(eventCreateSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof eventCreateSchema>;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO events (title, description, date, location, location_name, category)
       VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7)
       RETURNING id`,
      [b.title, b.description, b.date, b.lng, b.lat, b.location_name ?? null, b.category ?? null]
    );

    res.status(201).json({ id: rows[0]!.id });
  })
);

/**
 * Siembra los tres eventos de ejemplo si la tabla está vacía, igual que hacía
 * la versión con Firestore. Es idempotente: en el segundo arranque no hace
 * nada. Se desactiva con SEED_EVENTS=false.
 */
export async function sembrarEventosSiVacio(): Promise<void> {
  const { rows } = await pool.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM events");
  if ((rows[0]?.total ?? 0) > 0) return;

  const eventos = [
    {
      title: "Urban Jam 2026",
      description:
        "Competencia de skate y BMX abierta a todo público. Premios en efectivo y música en vivo.",
      date: "2026-04-15T10:00:00Z",
      location_name: "Parque de los Reyes",
      lat: -33.4312,
      lng: -70.6621,
      category: "jam",
    },
    {
      title: "Taller de Parkour Básico",
      description:
        "Aprende los fundamentos del parkour con instructores certificados. Trae ropa cómoda y agua.",
      date: "2026-03-25T16:00:00Z",
      location_name: "Plaza de la Ciudadanía",
      lat: -33.444,
      lng: -70.6536,
      category: "workshop",
    },
    {
      title: "Best Trick Contest",
      description: "El mejor truco en la baranda de 8 escalones se lleva el pozo. Inscripción gratuita.",
      date: "2026-05-02T14:00:00Z",
      location_name: "Escaleras del Museo",
      lat: -33.435,
      lng: -70.64,
      category: "contest",
    },
  ];

  for (const e of eventos) {
    await pool.query(
      `INSERT INTO events (title, description, date, location, location_name, category)
       VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7)`,
      [e.title, e.description, e.date, e.lng, e.lat, e.location_name, e.category]
    );
  }

  console.log(`[seed] ${eventos.length} eventos de ejemplo insertados`);
}
