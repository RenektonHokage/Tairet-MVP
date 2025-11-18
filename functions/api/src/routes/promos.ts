import { Router } from "express";
import { ZodError } from "zod";
import { promoUpsertSchema } from "../schemas/promos";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";

export const promosRouter = Router();

// GET /locals/:id/promos - Requiere autenticación del panel
promosRouter.get("/:id/promos", panelAuth, async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "local id is required" });
    }

    // Validar que el localId del path coincida con el del usuario autenticado
    if (id !== req.panelUser.localId) {
      return res.status(403).json({ error: "Forbidden: You can only access your own local's promos" });
    }

    const { data: promos, error: promosError } = await supabase
      .from("promos")
      .select(
        "id, local_id, title, description, image_url, start_date, end_date, created_at, updated_at"
      )
      .eq("local_id", id)
      .order("created_at", { ascending: false });

    if (promosError) {
      logger.error("Error fetching promos", {
        error: promosError.message,
        localId: id,
      });
      return res.status(500).json({ error: promosError.message });
    }

    let viewCounts: Record<string, number> = {};

    if (promos && promos.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("events_public")
        .select("metadata")
        .eq("type", "promo_open")
        .eq("local_id", id);

      if (eventsError) {
        logger.error("Error fetching promo view events", {
          error: eventsError.message,
          localId: id,
        });
        return res.status(500).json({ error: eventsError.message });
      }

      for (const event of events ?? []) {
        const promoId = event.metadata?.promo_id;
        if (promoId) {
          viewCounts[promoId] = (viewCounts[promoId] ?? 0) + 1;
        }
      }
    }

    const response = (promos ?? []).map((promo) => ({
      ...promo,
      view_count: viewCounts[promo.id] ?? 0,
    }));

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Unexpected error fetching promos", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

// POST /locals/:id/promos - Requiere autenticación del panel
promosRouter.post("/:id/promos", panelAuth, async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "local id is required" });
    }

    // Validar que el localId del path coincida con el del usuario autenticado
    if (id !== req.panelUser.localId) {
      return res.status(403).json({ error: "Forbidden: You can only create promos for your own local" });
    }

    const validated = promoUpsertSchema.parse(req.body);

    const payload = {
      local_id: id,
      title: validated.title,
      description: validated.description ?? null,
      image_url: validated.image_url,
      start_date: validated.start_date ?? null,
      end_date: validated.end_date ?? null,
    };

    const { data, error } = await supabase
      .from("promos")
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error("Error creating promo", { error: error.message, localId: id });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error creating promo", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

