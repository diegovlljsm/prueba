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
if (getApps().length === 0) {
  initializeApp({
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? applicationDefault()
      : applicationDefault(), // same call; kept explicit for clarity/future branching
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();
export const adminDb = getFirestore(firebaseConfig.firestoreDatabaseId || undefined);

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

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    req.authUser = { uid: decoded.uid, email: decoded.email ?? null };
    next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Gate for admin-only routes. Must run AFTER requireAuth (or call it
 * internally, as done here) so req.authUser is populated, then confirms
 * the caller's Firestore user document has role === 'admin'.
 *
 * This is the server-side source of truth - the client's `isAdmin` state
 * is only ever used for UI, never trusted for authorization.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    try {
      const uid = req.authUser!.uid;
      const userDoc = await adminDb.collection("users").doc(uid).get();

      if (!userDoc.exists || userDoc.data()?.role !== "admin") {
        return res.status(403).json({ error: "Admin privileges required" });
      }

      next();
    } catch (err) {
      console.error("Admin check failed:", err);
      return res.status(500).json({ error: "Could not verify admin status" });
    }
  });
}
