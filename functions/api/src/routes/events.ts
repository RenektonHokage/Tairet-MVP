import { Router } from "express";
import { z, ZodError } from "zod";
import { whatsappClickSchema } from "../schemas/whatsapp";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const eventsRouter = Router();

const promoOpenSchema = z.object({
  promo_id: z.string().uuid(),
  local_id: z.string().uuid(),
  source: z.string().optional(),
});

const profileViewSchema = z.object({
  local_id: z.string().uuid(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  source: z.string().optional(),
});

// POST /events/whatsapp_click
eventsRouter.post("/whatsapp_click", async (req, res, next) => {
  try {
    const validated = whatsappClickSchema.parse(req.body);

    const metadata = validated.source ? { source: validated.source } : null;

    const { error } = await supabase.from("whatsapp_clicks").insert({
      local_id: validated.local_id,
      phone: validated.phone ?? null,
      metadata,
    });

    if (error) {
      logger.error("Error recording WhatsApp click", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error in whatsapp_click event", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

// GET /events/whatsapp_clicks/count
eventsRouter.get("/whatsapp_clicks/count", async (req, res) => {
  const { localId } = req.query;

  if (!localId || typeof localId !== "string") {
    return res.status(400).json({ error: "localId is required" });
  }

  const { count, error } = await supabase
    .from("whatsapp_clicks")
    .select("id", { count: "exact", head: true })
    .eq("local_id", localId);

  if (error) {
    logger.error("Error counting WhatsApp clicks", {
      error: error.message,
      localId,
    });
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ local_id: localId, count: count ?? 0 });
});

// POST /events/promo_open
eventsRouter.post("/promo_open", async (req, res) => {
  try {
    const validated = promoOpenSchema.parse(req.body);

    const metadata: Record<string, string> = { promo_id: validated.promo_id };
    if (validated.source) {
      metadata.source = validated.source;
    }

    const { error } = await supabase.from("events_public").insert({
      type: "promo_open",
      local_id: validated.local_id,
      metadata,
    });

    if (error) {
      logger.error("Error recording promo open event", {
        error: error.message,
        promoId: validated.promo_id,
        localId: validated.local_id,
      });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error recording promo open", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

// POST /events/profile_view
eventsRouter.post("/profile_view", async (req, res) => {
  try {
    const validated = profileViewSchema.parse(req.body);

    const { error } = await supabase.from("profile_views").insert({
      local_id: validated.local_id,
      ip_address: validated.ip_address ?? null,
      user_agent: validated.user_agent ?? null,
      source: validated.source ?? null,
    });

    if (error) {
      logger.error("Error recording profile view", {
        error: error.message,
        localId: validated.local_id,
      });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error recording profile view", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});
 
