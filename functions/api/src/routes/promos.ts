import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import { promoUpsertSchema, promoUpdateSchema, promoReorderSchema } from "../schemas/promos";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";

export const promosRouter = Router();

/**
 * Helper: Validate multi-tenant access.
 * Returns false and sends 403 if user tries to access another local's data.
 */
function validateTenant(req: Request, res: Response): boolean {
  const { id } = req.params;
  if (!req.panelUser) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (id !== req.panelUser.localId) {
    res.status(403).json({ error: "Forbidden: can only access own local's promos" });
    return false;
  }
  return true;
}

// ----------------------------------------------------------------------------
// GET /locals/:id/promos
// Lista promos del local. Owner y staff pueden ver.
// Query params:
//   - include_inactive: "0" para solo activas (default: "1" = todas)
// ----------------------------------------------------------------------------
promosRouter.get(
  "/:id/promos",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res) => {
    try {
      if (!validateTenant(req, res)) return;

      const { id } = req.params;
      const includeInactive = req.query.include_inactive !== "0";

      let query = supabase
        .from("promos")
        .select(
          "id, local_id, title, description, image_url, start_date, end_date, is_active, sort_order, created_at, updated_at"
        )
        .eq("local_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data: promos, error: promosError } = await query;

      if (promosError) {
        logger.error("Error fetching promos", {
          error: promosError.message,
          localId: id,
        });
        return res.status(500).json({ error: promosError.message });
      }

      // Calculate view counts from events
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
          // Don't fail the request, just log
        } else {
          for (const event of events ?? []) {
            const promoId = event.metadata?.promo_id;
            if (promoId) {
              viewCounts[promoId] = (viewCounts[promoId] ?? 0) + 1;
            }
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
  }
);

// ----------------------------------------------------------------------------
// POST /locals/:id/promos
// Crear promo. Solo owner.
// ----------------------------------------------------------------------------
promosRouter.post(
  "/:id/promos",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!validateTenant(req, res)) return;

      const { id } = req.params;
      const validated = promoUpsertSchema.parse(req.body);

      // Calculate next sort_order
      const { data: maxOrder } = await supabase
        .from("promos")
        .select("sort_order")
        .eq("local_id", id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

      const payload = {
        local_id: id,
        title: validated.title,
        description: validated.description ?? null,
        image_url: validated.image_url,
        start_date: validated.start_date ?? null,
        end_date: validated.end_date ?? null,
        is_active: true,
        sort_order: nextOrder,
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
  }
);

// ----------------------------------------------------------------------------
// PATCH /locals/:id/promos/:promoId
// Actualizar promo. Solo owner.
// ----------------------------------------------------------------------------
promosRouter.patch(
  "/:id/promos/:promoId",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!validateTenant(req, res)) return;

      const { id, promoId } = req.params;

      // Verify promo belongs to local (multi-tenant check)
      const { data: existing, error: fetchError } = await supabase
        .from("promos")
        .select("id, local_id")
        .eq("id", promoId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Promo not found" });
      }

      if (existing.local_id !== id) {
        return res.status(404).json({ error: "Promo not found" });
      }

      const validated = promoUpdateSchema.parse(req.body);

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (validated.title !== undefined) updateData.title = validated.title;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.image_url !== undefined) updateData.image_url = validated.image_url;
      if (validated.start_date !== undefined) updateData.start_date = validated.start_date;
      if (validated.end_date !== undefined) updateData.end_date = validated.end_date;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;
      if (validated.sort_order !== undefined) updateData.sort_order = validated.sort_order;

      const { data, error } = await supabase
        .from("promos")
        .update(updateData)
        .eq("id", promoId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating promo", { error: error.message, promoId });
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      logger.error("Unexpected error updating promo", { error });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);

// ----------------------------------------------------------------------------
// DELETE /locals/:id/promos/:promoId
// Eliminar promo. Solo owner.
// ----------------------------------------------------------------------------
promosRouter.delete(
  "/:id/promos/:promoId",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!validateTenant(req, res)) return;

      const { id, promoId } = req.params;

      // Delete only if belongs to local (multi-tenant)
      const { data, error } = await supabase
        .from("promos")
        .delete()
        .eq("id", promoId)
        .eq("local_id", id)
        .select("id")
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Promo not found" });
        }
        logger.error("Error deleting promo", { error: error.message, promoId });
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: "Promo not found" });
      }

      return res.status(204).send();
    } catch (error) {
      logger.error("Unexpected error deleting promo", { error });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);

// ----------------------------------------------------------------------------
// POST /locals/:id/promos/reorder
// Reordenar promos atomicamente. Solo owner.
// Recibe { orderedIds: string[] } y actualiza sort_order en batch.
// ----------------------------------------------------------------------------
promosRouter.post(
  "/:id/promos/reorder",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!validateTenant(req, res)) return;

      const { id } = req.params;
      const validated = promoReorderSchema.parse(req.body);
      const { orderedIds } = validated;

      // Verify all promos belong to local
      const { data: promos, error: fetchError } = await supabase
        .from("promos")
        .select("id")
        .eq("local_id", id)
        .in("id", orderedIds);

      if (fetchError) {
        logger.error("Error fetching promos for reorder", { error: fetchError.message });
        return res.status(500).json({ error: fetchError.message });
      }

      if (!promos || promos.length !== orderedIds.length) {
        return res.status(400).json({ error: "Invalid promo IDs: some don't belong to this local" });
      }

      // Update sort_order in batch
      const updates = orderedIds.map((promoId, index) =>
        supabase
          .from("promos")
          .update({ sort_order: index, updated_at: new Date().toISOString() })
          .eq("id", promoId)
      );

      await Promise.all(updates);

      return res.status(200).json({ success: true, order: orderedIds });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      logger.error("Unexpected error reordering promos", { error });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);
