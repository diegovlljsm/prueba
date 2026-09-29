// serverAuth.ts
// Server-only Firebase Admin setup + middleware for verifying real admin
// permissions. This file must NEVER be imported from anything under src/,
// since it uses the Admin SDK (privileged, service-account credentials)
// which should never end up in the client bundle.

import { initializeApp, applicationDefault, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response, NextFunction } from "express";
import firebaseConfig from "./firebase-applet-config.json";

// --- Admin SDK initialization -------------------------------------------
//
// In Cloud Run (and most GCP environments) `applicationDefault()` picks up
// the attached service account automatically - no key file needed.
//
// For local development, either:
//   1) run `gcloud auth application-default login`, or
//   2) download a service account key and set
//      GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
//
// El proyecto y la base salen del entorno y solo caen al JSON de AI Studio si
// no se han definido. Así se apunta a otro proyecto sin tocar código.
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

// Firestore admite bases con nombre. El proyecto de AI Studio usa una
// (`ai-studio-…`); un proyecto normal usa la `(default)`, y entonces esto va
// vacío. Pasar un id inexistente hace que toda consulta falle en silencio y se
// caiga al fallback en memoria, que es difícil de diagnosticar.
// `||` y no `??`: una variable declarada pero vacía llega como cadena vacía.
const databaseId =
  process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "";

if (getApps().length === 0) {
  // applicationDefault() lee GOOGLE_APPLICATION_CREDENTIALS si está definida, y
  // si no busca las credenciales del entorno (gcloud, o la cuenta de servicio
  // adjunta en Cloud Run). Sin ninguna de las dos, el servidor arranca igual y
  // server.ts cae a su almacén en memoria.
  initializeApp({ credential: applicationDefault(), projectId });
}

console.log(
  `[firebase-admin] proyecto: ${projectId}` +
    (databaseId ? ` · base: ${databaseId}` : " · base: (default)") +
    (process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? ` · credencial: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
      : " · sin GOOGLE_APPLICATION_CREDENTIALS")
);

const adminAuth = getAuth();
export const adminDb = getFirestore(databaseId || undefined);

// Augment Express's Request type so downstream handlers get typed access
// to the verified user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: {
        uid: string;
        email: string | null;
      };
    }
  }
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Identidad compartida de desarrollo: sin credenciales de Firebase Admin en
// local, verifyIdToken siempre falla, así que sin esto no se podría probar
// ningún flujo de escritura. En producción NO se usa: ahí un token ausente o
// inválido es un 401, porque de lo contrario cualquiera podría escribir en la
// API haciéndose pasar por este mismo usuario.
const DEV_USER = { uid: "local-skater", email: "skater@urbanflow.local" };

/**
 * Verifies the Firebase ID token sent in the Authorization header
 * ("Authorization: Bearer <idToken>"). Attaches { uid, email } to
 * req.authUser on success. Does NOT check role - just proves who the
 * caller is. Use `requireAdmin` for role-gated routes.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme === "Bearer" && token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        req.authUser = { uid: decoded.uid, email: decoded.email ?? null };
        return next();
      } catch (err) {
        console.warn("Token verification failed:", (err as Error).message);
      }
    }

    if (IS_PRODUCTION) {
      return res.status(401).json({ error: "Debes iniciar sesión para hacer esto" });
    }
    req.authUser = DEV_USER;
    next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    if (IS_PRODUCTION) {
      return res.status(401).json({ error: "Debes iniciar sesión para hacer esto" });
    }
    req.authUser = DEV_USER;
    next();
  }
}

/**
 * Igual que requireAuth pero nunca rechaza: si hay un token válido deja
 * req.authUser, y si no, sigue sin usuario. Para lecturas que son públicas
 * pero se personalizan cuando sí hay sesión - el feed de Comunidad, por
 * ejemplo, que un invitado debe poder ver aunque sin "me gusta" propios.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme === "Bearer" && token) {
      const decoded = await adminAuth.verifyIdToken(token);
      req.authUser = { uid: decoded.uid, email: decoded.email ?? null };
    } else if (!IS_PRODUCTION) {
      req.authUser = DEV_USER;
    }
  } catch {
    if (!IS_PRODUCTION) req.authUser = DEV_USER;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    try {
      const uid = req.authUser!.uid;
      const userDoc = await adminDb.collection("users").doc(uid).get();

      if (!userDoc.exists || userDoc.data()?.role !== "admin") {
        // In local development, if users collection isn't reachable, allow admin operations
        if (!IS_PRODUCTION) {
          return next();
        }
        return res.status(403).json({ error: "Admin privileges required" });
      }

      next();
    } catch (err) {
      if (!IS_PRODUCTION) {
        return next();
      }
      console.error("Admin check failed:", err);
      return res.status(500).json({ error: "Could not verify admin status" });
    }
  });
}
