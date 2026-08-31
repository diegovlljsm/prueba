import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { requireAdmin, requireAuth, adminDb } from "./serverAuth";
import { FieldValue } from "firebase-admin/firestore";
import { validateBody, validateIdParam, spotCreateSchema, eventCreateSchema, videoCreateSchema } from "./serverSchemas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spotsCol = adminDb.collection("spots");
const eventsCol = adminDb.collection("events");
const videosCol = adminDb.collection("videos");

// Seed initial events once, if the collection is empty. Firestore has no
// "CREATE TABLE IF NOT EXISTS" step - collections just come into existence
// the first time a document is written to them.
async function seedEventsIfEmpty() {
  const snapshot = await eventsCol.limit(1).get();
  if (!snapshot.empty) return;

  const seedEvents = [
    {
      title: "Urban Jam 2026",
      description: "Competencia de skate y BMX abierta a todo público. Premios en efectivo y música en vivo.",
      date: "2026-04-15T10:00:00Z",
      location_name: "Parque de los Reyes",
      lat: -33.4312,
      lng: -70.6621,
      category: "jam",
    },
    {
      title: "Taller de Parkour Básico",
      description: "Aprende los fundamentos del parkour con instructores certificados. Trae ropa cómoda y agua.",
      date: "2026-03-25T16:00:00Z",
      location_name: "Plaza de la Ciudadanía",
      lat: -33.4440,
      lng: -70.6536,
      category: "workshop",
    },
    {
      title: "Best Trick Contest",
      description: "El mejor truco en la baranda de 8 escalones se lleva el pozo. Inscripción gratuita.",
      date: "2026-05-02T14:00:00Z",
      location_name: "Escaleras del Museo",
      lat: -33.4350,
      lng: -70.6400,
      category: "contest",
    },
  ];

  const batch = adminDb.batch();
  for (const event of seedEvents) {
    batch.set(eventsCol.doc(), { ...event, createdAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  console.log(`Seeded ${seedEvents.length} events into Firestore.`);
}

function docWithId<T extends FirebaseFirestore.DocumentData>(
  doc: FirebaseFirestore.QueryDocumentSnapshot<T> | FirebaseFirestore.DocumentSnapshot<T>
) {
  return { id: doc.id, ...doc.data() };
}

async function startServer() {
  await seedEventsIfEmpty();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // --- Spots ---------------------------------------------------------

  app.get("/api/spots", async (req, res) => {
    try {
      const snapshot = await spotsCol.get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      console.error("Failed to fetch spots:", err);
      res.status(500).json({ error: "Failed to fetch spots" });
    }
  });

  // Any signed-in user can propose a spot. validateBody enforces the
  // shape/types/ranges of every field (see serverSchemas.ts) before this
  // handler ever runs. requireAuth stamps createdBy from the verified
  // token - the client can no longer claim to be someone else.
  app.post("/api/spots", requireAuth, validateBody(spotCreateSchema), async (req, res) => {
    try {
      const {
        name, description, lat, lng, category, marker_color,
        show_label, image_url, location_name, floor_quality, obstacles,
      } = req.body;

      const docRef = await spotsCol.add({
        name,
        description,
        lat,
        lng,
        category,
        marker_color,
        show_label,
        image_url: image_url ?? null,
        location_name: location_name ?? null,
        floor_quality: floor_quality ?? null,
        obstacles: obstacles ?? null,
        createdBy: req.authUser!.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ id: docRef.id });
    } catch (err) {
      console.error("Failed to create spot:", err);
      res.status(500).json({ error: "Failed to create spot" });
    }
  });

  // Deleting a spot is an admin action (matches the original app's intent:
  // only admins moderate the map). Also cascades to that spot's videos,
  // since Firestore has no foreign keys to do this automatically.
  app.delete("/api/spots/:id", requireAdmin, validateIdParam, async (req, res) => {
    try {
      const spotId = req.params.id;
      const orphanVideos = await videosCol.where("spot_id", "==", spotId).get();

      const batch = adminDb.batch();
      orphanVideos.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(spotsCol.doc(spotId));
      await batch.commit();

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete spot:", err);
      res.status(500).json({ error: "Failed to delete spot" });
    }
  });

  // --- Events ----------------------------------------------------------

  app.get("/api/events", async (req, res) => {
    try {
      const snapshot = await eventsCol.orderBy("date", "asc").get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      console.error("Failed to fetch events:", err);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Events are curated/official content, not user-generated - and nothing
  // in the client currently calls this. Admin-only.
  app.post("/api/events", requireAdmin, validateBody(eventCreateSchema), async (req, res) => {
    try {
      const { title, description, date, location_name, lat, lng, category } = req.body;

      const docRef = await eventsCol.add({
        title,
        description,
        date,
        location_name: location_name ?? null,
        lat,
        lng,
        category: category ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ id: docRef.id });
    } catch (err) {
      console.error("Failed to create event:", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // --- Videos ------------------------------------------------------------

  app.get("/api/spots/:id/videos", validateIdParam, async (req, res) => {
    try {
      const snapshot = await videosCol
        .where("spot_id", "==", req.params.id)
        .where("status", "==", "approved")
        .get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      console.error("Failed to fetch spot videos:", err);
      res.status(500).json({ error: "Failed to fetch spot videos" });
    }
  });

  app.get("/api/admin/pending-videos", requireAdmin, async (req, res) => {
    try {
      const snapshot = await videosCol.where("status", "==", "pending").get();
      // spot_name is denormalized onto the video at upload time (see
      // POST /api/videos below), so no per-video lookup is needed here.
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      console.error("Failed to fetch pending videos:", err);
      res.status(500).json({ error: "Failed to fetch pending videos" });
    }
  });

  app.post("/api/videos", requireAuth, validateBody(videoCreateSchema), async (req, res) => {
    try {
      const { spot_id, video_url, user_name } = req.body;

      const spotSnap = await spotsCol.doc(spot_id).get();
      if (!spotSnap.exists) {
        return res.status(404).json({ error: "Spot not found" });
      }

      const docRef = await videosCol.add({
        spot_id,
        video_url,
        user_name: user_name ?? req.authUser!.email ?? "Anónimo",
        status: "pending",
        spot_name: spotSnap.data()?.name ?? null,
        createdBy: req.authUser!.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ id: docRef.id });
    } catch (err) {
      console.error("Failed to upload video:", err);
      res.status(500).json({ error: "Failed to upload video" });
    }
  });

  app.post("/api/admin/videos/:id/approve", requireAdmin, validateIdParam, async (req, res) => {
    try {
      await videosCol.doc(req.params.id).update({ status: "approved" });
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to approve video:", err);
      res.status(500).json({ error: "Failed to approve video" });
    }
  });

  app.post("/api/admin/videos/:id/reject", requireAdmin, validateIdParam, async (req, res) => {
    try {
      await videosCol.doc(req.params.id).update({ status: "rejected" });
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to reject video:", err);
      res.status(500).json({ error: "Failed to reject video" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
