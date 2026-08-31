import { Router } from "express";
import { requireAuth } from "../auth.js";
import { asyncHandler } from "../http.js";

export const usuariosRouter = Router();

/**
 * GET /api/me — quién es el que llama, según el token que trae.
 *
 * Existe para que el cliente sepa su rol sin inventárselo. Antes el `isAdmin`
 * del frontend salía de un documento en Firestore, que ya no es la fuente de
 * verdad: el rol vive en la tabla `users` de Postgres y es lo que el servidor
 * comprueba en cada ruta de administración.
 *
 * Sigue siendo información de interfaz: sirve para mostrar u ocultar la pestaña
 * de moderación, nunca para autorizar. La autorización la hace `requireAdmin`
 * en el servidor, en cada petición.
 */
usuariosRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    // requireAuth ya sincronizó el usuario con la base y resolvió su rol.
    res.json(req.authUser);
  })
);
