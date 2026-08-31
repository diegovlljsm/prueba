import { Router } from "express";
import { requireAdmin, requireAuth } from "../auth.js";
import { pool } from "../db.js";
import { asyncHandler } from "../http.js";
import { validateBody, validateIdParam, videoCreateSchema } from "../schemas.js";
import type { z } from "zod";

export const videosRouter = Router();

const COLUMNAS_VIDEO = `
  id, spot_id, video_url, user_name, status, spot_name, created_by, created_at
`;

/** GET /api/spots/:id/videos — solo los aprobados son públicos. */
videosRouter.get(
  "/spots/:id/videos",
  validateIdParam,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_VIDEO}
       FROM videos
       WHERE spot_id = $1 AND status = 'approved'
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  })
);

/**
 * GET /api/admin/pending-videos — la cola de moderación.
 * `spot_name` viene desnormalizado desde la subida, así que la lista no
 * necesita una consulta por fila.
 */
videosRouter.get(
  "/admin/pending-videos",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_VIDEO}
       FROM videos
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );
    res.json(rows);
  })
);

/** POST /api/videos — entra siempre como 'pending'; nadie se autoaprueba. */
videosRouter.post(
  "/videos",
  requireAuth,
  validateBody(videoCreateSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof videoCreateSchema>;

    const spot = await pool.query<{ name: string }>("SELECT name FROM spots WHERE id = $1", [
      b.spot_id,
    ]);
    if (!spot.rowCount) {
      return res.status(404).json({ error: "Spot no encontrado" });
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO videos (spot_id, video_url, user_name, status, spot_name, created_by)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING id`,
      [
        b.spot_id,
        b.video_url,
        b.user_name?.trim() || req.authUser!.email || "Anónimo",
        spot.rows[0]!.name,
        req.authUser!.uid,
      ]
    );

    res.status(201).json({ id: rows[0]!.id });
  })
);

/** Aprobar y rechazar comparten todo menos el estado destino. */
function rutaDeDecision(accion: "approve" | "reject", estado: "approved" | "rejected") {
  videosRouter.post(
    `/admin/videos/:id/${accion}`,
    requireAdmin,
    validateIdParam,
    asyncHandler(async (req, res) => {
      const { rowCount } = await pool.query(
        "UPDATE videos SET status = $1 WHERE id = $2 AND status = 'pending'",
        [estado, req.params.id]
      );

      // 0 filas significa que el video no existe o que otro moderador ya lo
      // resolvió. Devolver 409 evita que dos personas crean haber decidido.
      if (!rowCount) {
        return res.status(409).json({ error: "El video no existe o ya fue moderado" });
      }
      res.json({ success: true });
    })
  );
}

rutaDeDecision("approve", "approved");
rutaDeDecision("reject", "rejected");
