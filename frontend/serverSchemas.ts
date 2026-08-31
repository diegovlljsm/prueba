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
});

export const videoCreateSchema = z.object({
  spot_id: z.string().min(1, "spot_id is required"),
  video_url: z
    .string()
    .url("video_url must be a valid URL")
    .max(2000),
  user_name: z.string().trim().max(100).optional(),
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
