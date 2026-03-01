import { RequestHandler } from "express";
import { logger } from "../utils/logger";
import { getRequestId } from "./requestId";

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
    const requestId = getRequestId(req);
    const method = req.method;
    const path = req.originalUrl || req.path;
    const logRoleEvent = (
      level: "warn" | "error",
      message: string,
      meta?: Record<string, unknown>
    ) => {
      logger[level](message, {
        requestId,
        method,
        path,
        ...meta,
      });
    };

    // panelAuth ya debería haber seteado req.panelUser
    if (!req.panelUser) {
      logRoleEvent("warn", "Missing panel user context before role check", {
        statusCode: 401,
        authorizationStage: "panel_user_context",
        rejectionReason: "missing_panel_user_context",
        requiredRoles: allowedRoles,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = req.panelUser.role;

    if (!allowedRoles.includes(userRole)) {
      logRoleEvent("warn", "Role check failed", {
        statusCode: 403,
        authorizationStage: "role_check",
        localId: req.panelUser.localId,
        actualRole: userRole,
        requiredRoles: allowedRoles,
        rejectionReason: "insufficient_permissions",
      });

      return res.status(403).json({
        error: "Forbidden: insufficient permissions",
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

