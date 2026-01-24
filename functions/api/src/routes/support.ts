import { Router } from "express";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const supportRouter = Router();

/**
 * GET /status
 * Devuelve estado del sistema para diagnóstico (owner + staff)
 */
supportRouter.get(
  "/status",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const localId = req.panelUser.localId;

      // Buscar local para obtener tipo y slug
      const { data: local, error: localError } = await supabase
        .from("locals")
        .select("id, slug, type, name")
        .eq("id", localId)
        .single();

      if (localError) {
        logger.error("Error fetching local for support status", {
          error: localError.message,
          localId,
        });
        return res.status(500).json({ error: "Error fetching local info" });
      }

      return res.status(200).json({
        ok: true,
        now: new Date().toISOString(),
        tenant: {
          local_id: local.id,
          local_type: local.type,
          local_slug: local.slug,
          local_name: local.name,
        },
        email: {
          enabled: process.env.EMAIL_ENABLED === "true",
        },
        rateLimit: {
          panelEnabled: process.env.RATE_LIMIT_PANEL === "true",
          trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || "1", 10),
        },
      });
    } catch (error) {
      logger.error("Unexpected error in support status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);

/**
 * GET /access
 * Lista usuarios del panel para el local (owner-only)
 * NO loguea emails en errores
 */
supportRouter.get(
  "/access",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const localId = req.panelUser.localId;

      // Obtener usuarios del panel para este local
      const { data: users, error: usersError } = await supabase
        .from("panel_users")
        .select("email, role, created_at")
        .eq("local_id", localId)
        .order("role", { ascending: true })
        .order("created_at", { ascending: true });

      if (usersError) {
        // NO loguear emails - solo mensaje genérico
        logger.error("Error fetching panel users for access list", {
          localId,
          errorCode: usersError.code,
        });
        return res.status(500).json({ error: "Error fetching access list" });
      }

      return res.status(200).json({
        items: users ?? [],
      });
    } catch (error) {
      logger.error("Unexpected error in support access", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);
