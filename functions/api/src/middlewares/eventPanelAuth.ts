import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { getRequestId } from "./requestId";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EventPanelUser {
  eventId: string;
  authUserId: string;
  role: "owner" | "staff";
  displayName: string | null;
}

export interface EventPanelEvent {
  id: string;
  slug: string;
  title: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      eventPanelUser?: EventPanelUser;
      eventPanelEvent?: EventPanelEvent;
    }
  }
}

function isEventPanelRole(value: string): value is "owner" | "staff" {
  return value === "owner" || value === "staff";
}

export async function eventPanelAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = getRequestId(req);
  const method = req.method;
  const path = req.originalUrl || req.path;
  const logAuthEvent = (
    level: "info" | "warn" | "error",
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

  try {
    if (req.method === "OPTIONS") return next();

    const eventId = typeof req.params.eventId === "string" ? req.params.eventId.trim() : "";

    if (!UUID_PATTERN.test(eventId)) {
      logAuthEvent("warn", "Invalid event id for event panel auth", {
        statusCode: 400,
        authStage: "event_id",
        rejectionReason: "invalid_event_id",
      });
      return res.status(400).json({ error: "Invalid eventId" });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logAuthEvent("warn", "Missing or invalid Authorization header", {
        statusCode: 401,
        authStage: "authorization_header",
        rejectionReason: "missing_or_invalid_authorization_header",
      });
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const accessToken = authHeader.substring(7);

    if (!accessToken) {
      logAuthEvent("warn", "Missing access token", {
        statusCode: 401,
        authStage: "access_token",
        rejectionReason: "missing_access_token",
      });
      return res.status(401).json({ error: "Missing access token" });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      logAuthEvent("warn", "Invalid or expired token", {
        statusCode: 401,
        authStage: "supabase_auth",
        rejectionReason: "invalid_or_expired_token",
        authError: authError?.message,
      });
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, slug, title, status")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      logAuthEvent("error", "Error fetching event for event panel auth", {
        statusCode: 500,
        authStage: "event_lookup",
        eventId,
        error: eventError.message,
      });
      return res.status(500).json({ error: "Failed to verify event access" });
    }

    if (!event) {
      logAuthEvent("warn", "Event not found for event panel auth", {
        statusCode: 404,
        authStage: "event_lookup",
        eventId,
        rejectionReason: "event_not_found",
      });
      return res.status(404).json({ error: "Event not found" });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("event_panel_users")
      .select("event_id, auth_user_id, role, display_name")
      .eq("event_id", eventId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      logAuthEvent("error", "Error fetching event panel membership", {
        statusCode: 500,
        authStage: "event_membership_lookup",
        eventId,
        authUserId: user.id,
        error: membershipError.message,
      });
      return res.status(500).json({ error: "Failed to verify event access" });
    }

    if (!membership || !isEventPanelRole(membership.role)) {
      logAuthEvent("warn", "Event panel membership not found", {
        statusCode: 403,
        authStage: "event_membership_lookup",
        eventId,
        authUserId: user.id,
        rejectionReason: "event_membership_not_found",
      });
      return res.status(403).json({ error: "User not authorized for event access" });
    }

    req.eventPanelEvent = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      status: event.status,
    };

    req.eventPanelUser = {
      eventId,
      authUserId: user.id,
      role: membership.role,
      displayName: membership.display_name ?? null,
    };

    logAuthEvent("info", "Event panel authentication successful", {
      authStage: "success",
      authUserId: user.id,
      eventId,
      role: membership.role,
    });

    next();
  } catch (error) {
    logAuthEvent("error", "Error in eventPanelAuth middleware", {
      statusCode: 500,
      authStage: "unexpected_error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
