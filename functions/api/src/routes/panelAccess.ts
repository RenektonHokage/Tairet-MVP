import { NextFunction, Request, Router } from "express";
import { ZodError } from "zod";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { accessCheckinTokenParamsSchema } from "../schemas/accessCheckin";
import {
  accessCheckinTokenHash,
  checkInAccessEntryByToken,
  lookupAccessCheckinByToken,
} from "../services/accessCheckin";
import { logger } from "../utils/logger";

export const panelAccessRouter = Router();

function sanitizeCheckinUrlValue(value: string | undefined, token: string): string | undefined {
  if (!value || token.length === 0) return value;

  const encodedToken = encodeURIComponent(token);
  let sanitized = value.split(token).join(":token");
  if (encodedToken !== token) {
    sanitized = sanitized.split(encodedToken).join(":token");
  }

  return sanitized;
}

function sanitizeAccessCheckinRequestUrl(req: Request, _res: unknown, next: NextFunction) {
  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (token.length > 0) {
    req.originalUrl = sanitizeCheckinUrlValue(req.originalUrl, token) ?? req.originalUrl;
    req.url = sanitizeCheckinUrlValue(req.url, token) ?? req.url;
  }

  next();
}

panelAccessRouter.get(
  "/checkin/:token",
  sanitizeAccessCheckinRequestUrl,
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsedParams = accessCheckinTokenParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        const rawToken = typeof req.params.token === "string" ? req.params.token.trim() : "";
        logger.warn("Invalid access check-in token", {
          tokenHash: rawToken.length > 0 ? accessCheckinTokenHash(rawToken) : undefined,
          panelUserId: req.panelUser.userId,
          role: req.panelUser.role,
          errorCode: "invalid_checkin_token",
        });

        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const result = await lookupAccessCheckinByToken({
        token: parsedParams.data.token,
        panelUser: {
          userId: req.panelUser.userId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
        },
      });

      if (!result.ok) {
        logger.warn("Access check-in lookup rejected", { ...result.logContext });
        return res.status(result.statusCode).json({
          error: result.error.message,
          code: result.error.code,
        });
      }

      logger.info("Access check-in lookup successful", {
        ...result.logContext,
        status: result.status,
        checkinStatus: result.entry.checkin_status,
      });

      return res.status(200).json({
        ok: true,
        status: result.status,
        entry: result.entry,
        attendee: result.attendee,
        order: result.order,
        warnings: result.warnings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      next(error);
    }
  }
);

panelAccessRouter.post(
  "/checkin/:token/use",
  sanitizeAccessCheckinRequestUrl,
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsedParams = accessCheckinTokenParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        const rawToken = typeof req.params.token === "string" ? req.params.token.trim() : "";
        logger.warn("Invalid access check-in token use request", {
          tokenHash: rawToken.length > 0 ? accessCheckinTokenHash(rawToken) : undefined,
          panelUserId: req.panelUser.userId,
          role: req.panelUser.role,
          errorCode: "invalid_checkin_token",
        });

        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const result = await checkInAccessEntryByToken({
        token: parsedParams.data.token,
        panelUser: {
          userId: req.panelUser.userId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
        },
      });

      if (!result.ok) {
        const logPayload = { ...result.logContext };
        if (result.statusCode >= 500) {
          logger.error("Access check-in use failed", logPayload);
        } else {
          logger.warn("Access check-in use rejected", logPayload);
        }

        return res.status(result.statusCode).json({
          error: result.error.message,
          code: result.error.code,
        });
      }

      logger.info("Access check-in use completed", {
        ...result.logContext,
        status: result.status,
        checkinStatus: result.entry.checkin_status,
      });

      return res.status(200).json({
        ok: true,
        status: result.status,
        entry: result.entry,
        attendee: result.attendee,
        order: result.order,
        warnings: result.warnings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      next(error);
    }
  }
);
