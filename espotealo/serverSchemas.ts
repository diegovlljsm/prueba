// serverSchemas.ts
// Zod schemas for every request body the API accepts, plus a small
// Express middleware to apply them. Centralizing validation here means
// the route handlers in server.ts can trust req.body's shape completely -
// no more manually checking `typeof lat !== "number"` inline.

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { CATEGORY_IDS } from "./src/constants.shared";

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "marker_color must be a hex color like #10b981");

// The client actually sends `category` as a JSON-stringified array of
// category ids (see AddSpotForm.tsx: `JSON.stringify(selectedCategories)`),
// not a single plain string. We validate the raw string's *shape* here so
// a malformed or spoofed value can't sneak into Firestore.
const spotCategoryField = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (val) => {
      try {
        const parsed = JSON.parse(val);
        return (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((c) => typeof c === "string" && CATEGORY_IDS.includes(c as any))
        );
      } catch {
        return false;
      }
    },
    { message: `category must be a JSON array containing one or more of: ${CATEGORY_IDS.join(", ")}` }
  );

// image_url can be either a normal http(s) link OR a base64 data: URL
// (when a user uploads a file directly instead of pasting a link - see
// AddSpotForm's FileReader.readAsDataURL usage). We cap the length rather
// than requiring a strict URL shape so both cases pass.
const imageUrlField = z
  .string()
  .max(8_000_000, "image is too large")
  .refine((val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"), {
    message: "image_url must be an http(s) link or an image data URL",
  })
  .optional()
  .nullable();

export const spotCreateSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  description: z.string().trim().max(1000).optional().default(""),
  lat: latitude,
  lng: longitude,
  category: spotCategoryField,
  marker_color: hexColor.optional().default("#10b981"),
  show_label: z.boolean().optional().default(true),
  image_url: imageUrlField,
  location_name: z.string().trim().max(200).optional().nullable(),
  floor_quality: z.string().trim().max(100).optional().nullable(),
  obstacles: z.string().trim().max(300).optional().nullable(),
  open_hours: z.string().trim().max(200).optional().nullable(),
  spot_type: z.enum(["street", "park", "bowl", "diy"]).optional().nullable(),
  features: z.array(z.string().max(50)).max(20).optional().nullable(),
  difficulty: z.enum(["principiante", "intermedio", "avanzado"]).optional().nullable(),
});

export const eventCreateSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  // Matches the seed data format, e.g. "2026-04-15T10:00:00Z"
  date: z.string().datetime({ message: "date must be an ISO 8601 datetime, e.g. 2026-04-15T10:00:00Z" }),
  location_name: z.string().trim().max(200).optional().nullable(),
  lat: latitude,
  lng: longitude,
  category: z.enum(["jam", "contest", "workshop"]).optional().nullable(),
  image_url: imageUrlField,
});

export const videoCreateSchema = z.object({
  spot_id: z.string().min(1, "spot_id is required"),
  video_url: z
    .string()
    .url("video_url must be a valid URL")
    .max(2000),
  user_name: z.string().trim().max(100).optional(),
});

// Reuses the same http(s)-or-data-url shape as spot image_url, but photos
// are always required (there's no "no photo" case for an upload).
export const photoCreateSchema = z.object({
  spot_id: z.string().min(1, "spot_id is required"),
  photo_url: z
    .string()
    .max(8_000_000, "image is too large")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"), {
      message: "photo_url must be an http(s) link or an image data URL",
    }),
  user_name: z.string().trim().max(100).optional(),
});

export const reviewCreateSchema = z.object({
  spot_id: z.string().min(1, "spot_id is required"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
  user_name: z.string().trim().max(100).optional(),
  user_avatar: z.string().trim().max(500).optional().nullable(),
});

export const eventPhotoCreateSchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  photo_url: z
    .string()
    .max(8_000_000, "image is too large")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"), {
      message: "photo_url must be an http(s) link or an image data URL",
    }),
  user_name: z.string().trim().max(100).optional(),
});

// Same http(s)-or-data-url shape as spot/photo image fields, plus an
// allowance for a preset relative path (avatars under /public/avatars,
// banners under /public/banners - see AVATAR_OPTIONS/BANNER_OPTIONS in
// constants.tsx) - those are relative paths, not full URLs, so they'd
// otherwise fail the http(s)/data: check.
function presetOrRemoteImageField(presetPrefix: string) {
  return z
    .string()
    .max(8_000_000, "image is too large")
    .refine(
      (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/") || val.startsWith(presetPrefix),
      { message: `must be an http(s) link, an image data URL, or a preset path under ${presetPrefix}` }
    )
    .optional()
    .nullable();
}

const photoURLField = presetOrRemoteImageField("/avatars/");
const bannerURLField = presetOrRemoteImageField("/banners/");

// Just the handle, not a real OAuth connection (no Instagram app/callback
// registered) - strips a leading @ if the user typed one, then validates
// against Instagram's own username charset so the profile link (built as
// instagram.com/<handle> in the UI) always points somewhere valid.
const instagramField = z
  .string()
  .trim()
  .max(31, "instagram username is too long")
  .transform((val) => val.replace(/^@+/, ""))
  .refine((val) => val === "" || /^[a-zA-Z0-9._]{1,30}$/.test(val), {
    message: "instagram must contain only letters, numbers, periods or underscores (max 30 characters)",
  })
  .optional()
  .nullable();

// All fields optional since a profile update can touch just one of them
// (e.g. only the avatar, or only the bio) - see EditProfileForm.tsx.
export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  city: z.string().trim().max(60).optional().nullable(),
  discipline: z.enum(["skate", "bmx", "parkour", "other"]).optional().nullable(),
  bio: z.string().trim().max(140).optional().nullable(),
  photoURL: photoURLField,
  bannerURL: bannerURLField,
  instagram: instagramField,
});

// GPS check-in for the "visita spots en persona" challenge - lat/lng is
// the browser's live geolocation reading at the moment the user taps
// "Marcar visita" (see handleVisitSpot in App.tsx), which the server then
// checks against the spot's own coordinates before recording anything.
export const visitCreateSchema = z.object({
  lat: latitude,
  lng: longitude,
});

// Publicación del feed de Comunidad. La imagen es obligatoria (el feed es
// visual, una tarjeta sin foto no tiene sentido) y reutiliza el mismo campo
// http(s)-o-data-url que las fotos de spots. Los hashtags se guardan ya
// normalizados: sin '#', en minúsculas y sin repetidos (ver postCreateSchema
// abajo), para que agrupar por tag sea una comparación directa.
export const postCreateSchema = z.object({
  image_url: z
    .string()
    .max(8_000_000, "image is too large")
    .refine((val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:image/"), {
      message: "image_url must be an http(s) link or an image data URL",
    }),
  caption: z.string().trim().max(500).optional().default(""),
  spot_id: z.string().max(200).optional().nullable(),
  tags: z
    .array(z.string().trim().max(40))
    .max(10)
    .optional()
    .default([])
    .transform((tags) => {
      const clean = tags
        .map((t) => t.replace(/^#+/, "").toLowerCase())
        .filter((t) => /^[a-z0-9áéíóúñü_]{1,40}$/i.test(t));
      return Array.from(new Set(clean));
    }),
});

export const postCommentCreateSchema = z.object({
  text: z.string().trim().min(1, "el comentario no puede estar vacío").max(500),
});

export const eventReviewCreateSchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
  user_name: z.string().trim().max(100).optional(),
  user_avatar: z.string().trim().max(500).optional().nullable(),
});

/**
 * Guards :id route params. Firestore document ids are non-empty strings
 * without '/' - this rejects obviously malformed values (empty, huge,
 * containing a path separator) before we ever build a query with them.
 */
export function validateIdParam(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  if (!id || id.length > 200 || id.includes("/")) {
    return res.status(400).json({ error: "Invalid id parameter" });
  }
  next();
}

/**
 * Validates req.body against `schema`. On success, replaces req.body with
 * the parsed (and defaulted/trimmed) data so downstream handlers get
 * clean input. On failure, responds 400 with a readable list of issues
 * and never reaches the route handler or the database.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}
