import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { pool } from "./db.js";

export interface UsuarioAutenticado {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "user" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: UsuarioAutenticado;
    }
  }
}

interface IdentidadToken {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// --- Verificación del token -------------------------------------------------

/**
 * Decodifica la carga útil de un JWT **sin comprobar la firma**.
 * Solo se usa en AUTH_MODE=dev. Sirve para trabajar en local con los tokens
 * reales que emite Firebase Auth en el navegador sin necesitar la clave de
 * servicio del proyecto, que hoy no tenemos.
 */
function decodificarSinVerificar(token: string): IdentidadToken {
  const partes = token.split(".");
  if (partes.length !== 3 || !partes[1]) {
    throw new Error("El token no tiene forma de JWT");
  }

  const carga = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as {
    sub?: string;
    user_id?: string;
    email?: string;
    name?: string;
  };

  const uid = carga.sub ?? carga.user_id;
  if (!uid) throw new Error("El token no trae sub ni user_id");

  return { uid, email: carga.email ?? null, displayName: carga.name ?? null };
}

/**
 * Atajo para probar la API con curl sin pasar por el navegador:
 *   Authorization: Bearer dev:mi-uid:correo@ejemplo.com
 * Solo funciona en AUTH_MODE=dev.
 */
function identidadDeAtajo(token: string): IdentidadToken | null {
  if (!token.startsWith("dev:")) return null;
  const [, uid, email] = token.split(":");
  if (!uid) throw new Error("Formato esperado: dev:<uid>[:<email>]");
  return { uid, email: email ?? null, displayName: null };
}

let verificadorFirebase: ((token: string) => Promise<IdentidadToken>) | null = null;

/**
 * firebase-admin se carga solo si hace falta: es una dependencia pesada y en
 * modo dev no se usa.
 */
async function verificarConFirebase(token: string): Promise<IdentidadToken> {
  if (!verificadorFirebase) {
    const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");

    if (getApps().length === 0) {
      initializeApp({
        credential: applicationDefault(),
        ...(config.proyectoFirebase ? { projectId: config.proyectoFirebase } : {}),
      });
    }

    const auth = getAuth();
    verificadorFirebase = async (t) => {
      const decodificado = await auth.verifyIdToken(t);
      return {
        uid: decodificado.uid,
        email: decodificado.email ?? null,
        displayName: decodificado.name ?? null,
      };
    };
  }
  return verificadorFirebase(token);
}

async function identidadDesdeToken(token: string): Promise<IdentidadToken> {
  if (config.modoAuth === "firebase") {
    return verificarConFirebase(token);
  }
  return identidadDeAtajo(token) ?? decodificarSinVerificar(token);
}

// --- Sincronización con la tabla users --------------------------------------

/**
 * Crea el usuario si es su primera petición y devuelve su rol.
 *
 * El rol es la única fuente de autorización del servidor: el `isAdmin` del
 * cliente sirve para mostrar u ocultar pestañas, nunca para autorizar.
 * Un correo listado en ADMIN_EMAILS se promueve a admin, y esa promoción es
 * idempotente, de modo que añadir un correo a la variable y reiniciar basta.
 */
async function sincronizarUsuario(identidad: IdentidadToken): Promise<UsuarioAutenticado> {
  const esAdminPorConfig =
    identidad.email !== null && config.correosAdmin.includes(identidad.email.toLowerCase());

  const { rows } = await pool.query<{ role: "user" | "admin" }>(
    `
    INSERT INTO users (uid, email, display_name, role)
    VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN 'admin' ELSE 'user' END)
    ON CONFLICT (uid) DO UPDATE SET
      email        = COALESCE(EXCLUDED.email, users.email),
      display_name = COALESCE(EXCLUDED.display_name, users.display_name),
      role         = CASE WHEN $4::boolean THEN 'admin' ELSE users.role END,
      last_seen_at = now()
    RETURNING role
    `,
    [identidad.uid, identidad.email, identidad.displayName, esAdminPorConfig]
  );

  return {
    uid: identidad.uid,
    email: identidad.email,
    displayName: identidad.displayName,
    role: rows[0]?.role ?? "user",
  };
}

// --- Middlewares ------------------------------------------------------------

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cabecera = req.headers.authorization ?? "";
  const [esquema, token] = cabecera.split(" ");

  if (esquema !== "Bearer" || !token) {
    return res.status(401).json({ error: "Falta la cabecera Authorization: Bearer <token>" });
  }

  try {
    const identidad = await identidadDesdeToken(token);
    req.authUser = await sincronizarUsuario(identidad);
    next();
  } catch (err) {
    console.error("[auth] token rechazado:", err instanceof Error ? err.message : err);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ error: "Se requieren privilegios de administrador" });
    }
    next();
  });
}

export function avisarModoAuth(): void {
  if (config.modoAuth === "dev") {
    console.warn(
      [
        "",
        "  ┌──────────────────────────────────────────────────────────────┐",
        "  │  AUTH_MODE=dev — NO se verifica la firma de los tokens.      │",
        "  │  Cualquiera puede hacerse pasar por cualquier usuario.       │",
        "  │  Solo para desarrollo local. Antes de exponer esta API,      │",
        "  │  cambia a AUTH_MODE=firebase.                                │",
        "  └──────────────────────────────────────────────────────────────┘",
        "",
      ].join("\n")
    );
  }
  if (config.correosAdmin.length > 0) {
    console.log(`[auth] administradores por configuración: ${config.correosAdmin.join(", ")}`);
  } else {
    console.warn(
      "[auth] ADMIN_EMAILS está vacío: nadie podrá usar las rutas /api/admin/*."
    );
  }
}
