import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 no captura los rechazos de un handler async: sin esto, un error
 * en una consulta deja la petición colgada hasta que expira, en lugar de
 * devolver un 500.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
