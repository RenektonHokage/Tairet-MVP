import { RequestHandler } from "express";
import { logger } from "../utils/logger";
import { getRequestId } from "./requestId";
import { EventPanelUser } from "./eventPanelAuth";

type EventRole = EventPanelUser["role"];

export function requireEventRole(allowedRoles: EventRole[]): RequestHandler {
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

    if (!req.eventPanelUser) {
      logRoleEvent("warn", "Missing event panel user context before role check", {
        statusCode: 401,
        authorizationStage: "event_panel_user_context",
        rejectionReason: "missing_event_panel_user_context",
        requiredRoles: allowedRoles,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = req.eventPanelUser.role;

    if (!allowedRoles.includes(userRole)) {
      logRoleEvent("warn", "Event role check failed", {
        statusCode: 403,
        authorizationStage: "event_role_check",
        eventId: req.eventPanelUser.eventId,
        actualRole: userRole,
        requiredRoles: allowedRoles,
        rejectionReason: "insufficient_event_permissions",
      });

      return res.status(403).json({
        error: "Forbidden: insufficient permissions",
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}
