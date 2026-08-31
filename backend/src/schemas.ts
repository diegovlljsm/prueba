import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

// Espejo de frontend/src/constants.shared.ts. Si allí se añade una categoría,
// hay que añadirla aquí: son dos paquetes distintos y no comparten import.
export const CATEGORY_IDS = ["skate", "bmx", "parkour", "other"] as const;

const latitud = z.number().min(-90).max(90);
const longitud = z.number().min(-180).max(180);
const colorHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "marker_color debe ser un color hex como #10b981");

/**
 * El formulario manda `category` como un array JSON serializado
 * (AddSpotForm hace `JSON.stringify(selectedCategories)`), no como un string
 * suelto. Validamos la forma del string para que no entre nada inventado, y
 * exponemos el array ya parseado para poder guardarlo también en la columna
 * indexable `categories`.
 */
const campoCategoria = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (valor) => {
      try {
        const parseado = JSON.parse(valor);
        return (
          Array.isArray(parseado) &&
          parseado.length > 0 &&
          parseado.every(
            (c) => typeof c === "string" && (CATEGORY_IDS as readonly string[]).includes(c)
          )
        );
      } catch {
        return false;
      }
    },
    {
      message: `category debe ser un array JSON con una o más de: ${CATEGORY_IDS.join(", ")}`,
    }
  );

/** Devuelve el array de categorías a partir del string validado. */
export function parsearCategorias(category: string): string[] {
  return JSON.parse(category) as string[];
}

/**
 * image_url admite tanto un enlace http(s) como un data URL en base64: el
 * formulario permite pegar una URL o subir un fichero con FileReader.
 *
 * Guardar imágenes en base64 dentro de Postgres funciona para probar, pero no
 * es a donde esto tiene que llegar: las fotos van a almacenamiento de objetos
 * (REQ-006). Hasta entonces el tope de 8 MB evita que una foto de 12 MP tumbe
 * la petición.
 */
const campoImagen = z
  .string()
  .max(8_000_000, "la imagen es demasiado grande")
  .refine(
    (v) => v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:image/"),
    { message: "image_url debe ser un enlace http(s) o un data URL de imagen" }
  )
  .optional()
  .nullable();

export const spotCreateSchema = z.object({
  name: z.string().trim().min(1, "name es obligatorio").max(100),
  description: z.string().trim().max(1000).optional().default(""),
  lat: latitud,
  lng: longitud,
  category: campoCategoria,
  marker_color: colorHex.optional().default("#10b981"),
  show_label: z.boolean().optional().default(true),
  image_url: campoImagen,
  location_name: z.string().trim().max(200).optional().nullable(),
  floor_quality: z.string().trim().max(100).optional().nullable(),
  obstacles: z.string().trim().max(300).optional().nullable(),
});

export const eventCreateSchema = z.object({
  title: z.string().trim().min(1, "title es obligatorio").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  date: z
    .string()
    .datetime({ message: "date debe ser ISO 8601, por ejemplo 2026-04-15T10:00:00Z" }),
  location_name: z.string().trim().max(200).optional().nullable(),
  lat: latitud,
  lng: longitud,
  category: z.enum(["jam", "contest", "workshop"]).optional().nullable(),
});

export const videoCreateSchema = z.object({
  spot_id: z.string().uuid("spot_id debe ser un uuid"),
  video_url: z.string().url("video_url debe ser una URL válida").max(2000),
  user_name: z.string().trim().max(100).optional(),
});

/** Filtros opcionales de GET /api/spots. Sin ninguno, devuelve todos. */
export const spotsQuerySchema = z.object({
  /** "minLng,minLat,maxLng,maxLat" — el rectángulo visible del mapa. */
  bbox: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const partes = v.split(",").map(Number);
      if (partes.length !== 4 || partes.some((n) => !Number.isFinite(n))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bbox debe ser minLng,minLat,maxLng,maxLat",
        });
        return z.NEVER;
      }
      return partes as [number, number, number, number];
    }),
  /** "lng,lat" — el centro para una búsqueda por radio. */
  near: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const partes = v.split(",").map(Number);
      if (partes.length !== 2 || partes.some((n) => !Number.isFinite(n))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "near debe ser lng,lat" });
        return z.NEVER;
      }
      return partes as [number, number];
    }),
  /** Radio en metros. El servidor lo acota a 50 km para que nadie pida el mundo. */
  radius: z.coerce.number().positive().max(50_000).optional().default(5_000),
  limit: z.coerce.number().int().positive().max(1_000).optional().default(1_000),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rechaza un :id que no sea uuid antes de que llegue a la consulta. Sin esto,
 * Postgres lanza un error de tipo y la API devolvería 500 donde corresponde
 * un 400.
 */
export function validateIdParam(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: "El parámetro id debe ser un uuid" });
  }
  next();
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      return res.status(400).json({
        error: "Cuerpo de la petición inválido",
        details: resultado.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      });
    }
    req.body = resultado.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req.query);
    if (!resultado.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: resultado.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      });
    }
    // req.query es de solo lectura en Express 5; en 4 se puede reasignar.
    // Guardamos el resultado aparte para no depender de eso.
    res.locals.query = resultado.data;
    next();
  };
}
