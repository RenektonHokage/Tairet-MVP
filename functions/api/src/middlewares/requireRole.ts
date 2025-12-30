import { RequestHandler } from "express";
import { logger } from "../utils/logger";

/**
 * Middleware que verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse DESPUÉS de panelAuth (requiere req.panelUser).
 *
 * @param allowedRoles - Array de roles permitidos (ej: ["owner", "staff"])
 * @returns RequestHandler que valida el rol
 *
 * @example
 * // Solo owners pueden acceder
 * router.get("/metrics", panelAuth, requireRole(["owner"]), handler);
 *
 * // Owners y staff pueden acceder
 * router.patch("/orders/:id/use", panelAuth, requireRole(["owner", "staff"]), handler);
 */
export function requireRole(allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    // panelAuth ya debería haber seteado req.panelUser
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = req.panelUser.role;

    if (!allowedRoles.includes(userRole)) {
      const requestId =
        (Array.isArray(req.headers["x-request-id"])
          ? req.headers["x-request-id"][0]
          : req.headers["x-request-id"]) || "unknown";

      logger.warn("Role check failed", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        localId: req.panelUser.localId,
        userRole,
        requiredRoles: allowedRoles,
      });

      return res.status(403).json({
        error: "Forbidden: insufficient permissions",
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

