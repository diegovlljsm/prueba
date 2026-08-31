import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { pool } from "./db.js";
import { asyncHandler } from "./http.js";
import { eventsRouter } from "./routes/events.js";
import { spotsRouter } from "./routes/spots.js";
import { videosRouter } from "./routes/videos.js";

export function crearApp() {
  const app = express();

  app.disable("x-powered-by");

  // En desarrollo el frontend se sirve desde Vite (5173) y esta API desde otro
  // puerto, así que hacen falta cabeceras CORS. Con el proxy de Vite activado
  // las peticiones son del mismo origen y esto no llega a usarse, pero permite
  // atacar la API directamente desde el navegador o desde Postman.
  app.use(
    cors({
      origin: config.origenesPermitidos,
      credentials: true,
    })
  );

  // El límite alto es temporal: hoy las fotos viajan como data URL en base64
  // dentro del JSON. Cuando pasen a almacenamiento de objetos (REQ-006) esto
  // debería bajar a unos pocos cientos de kilobytes.
  app.use(express.json({ limit: "12mb" }));

  app.use((req, _res, next) => {
    if (req.path !== "/api/health") {
      console.log(`[http] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  /** Comprobación de vida, incluida la conexión real a Postgres y PostGIS. */
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query<{ postgis: string; ahora: Date }>(
        "SELECT PostGIS_Version() AS postgis, now() AS ahora"
      );
      res.json({
        ok: true,
        entorno: config.entorno,
        modoAuth: config.modoAuth,
        postgis: rows[0]?.postgis ?? null,
        hora: rows[0]?.ahora ?? null,
      });
    })
  );

  app.use("/api", spotsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", videosRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  // Manejador de errores. Va el último y con los cuatro parámetros: Express
  // distingue un manejador de errores por su aridad, y con tres se registra
  // como middleware normal y nunca se ejecuta.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`[error] ${req.method} ${req.originalUrl}:`, mensaje);

    if (res.headersSent) return;

    res.status(500).json({
      error: "Error interno del servidor",
      // El detalle solo se expone fuera de producción: un mensaje de Postgres
      // puede revelar nombres de columnas y estructura de la base.
      ...(config.entorno === "production" ? {} : { detail: mensaje }),
    });
  });

  return app;
}
