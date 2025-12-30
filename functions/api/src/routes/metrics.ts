import { Router } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";

export const metricsRouter = Router();

const querySchema = z.object({
  localId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// GET /metrics/summary - Requiere autenticación del panel y rol owner
metricsRouter.get("/summary", panelAuth, requireRole(["owner"]), async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = querySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    // Usar localId del usuario autenticado, ignorar cualquier localId del query
    const localId = req.panelUser.localId;
    const { from, to } = parseResult.data;

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    if (fromDate > toDate) {
      return res
        .status(400)
        .json({ error: '"from" must be earlier than or equal to "to"' });
    }

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    const { count: whatsappCount, error: whatsappError } = await supabase
      .from("whatsapp_clicks")
      .select("id", { count: "exact", head: true })
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (whatsappError) {
      logger.error("Error fetching whatsapp clicks", {
        error: whatsappError.message,
        localId,
      });
      return res.status(500).json({ error: whatsappError.message });
    }

    const { data: reservationsData, error: reservationsError } = await supabase
      .from("reservations")
      .select("status")
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (reservationsError) {
      logger.error("Error fetching reservations for metrics", {
        error: reservationsError.message,
        localId,
      });
      return res.status(500).json({ error: reservationsError.message });
    }

    const {
      data: ordersData,
      error: ordersError,
    } = await supabase
      .from("orders")
      .select("id, status, quantity, total_amount, used_at")
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (ordersError) {
      logger.error("Error fetching orders for metrics", {
        error: ordersError.message,
        localId,
      });
      return res.status(500).json({ error: ordersError.message });
    }

    const { data: promosData, error: promosError } = await supabase
      .from("promos")
      .select("id, title")
      .eq("local_id", localId);

    if (promosError) {
      logger.error("Error fetching promos for metrics", {
        error: promosError.message,
        localId,
      });
    }

    const { data: promoEvents, error: promoEventsError } = await supabase
      .from("events_public")
      .select("metadata")
      .eq("type", "promo_open")
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (promoEventsError) {
      logger.error("Error fetching promo events", {
        error: promoEventsError.message,
        localId,
      });
    }

    const {
      count: profileViewsCount,
      error: profileViewsError,
    } = await supabase
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (profileViewsError) {
      logger.error("Error fetching profile views", {
        error: profileViewsError.message,
        localId,
      });
    }

    const reservationsStats = {
      total: reservationsData?.length ?? 0,
      en_revision: 0,
      confirmed: 0,
      cancelled: 0,
    };

    for (const reservation of reservationsData ?? []) {
      switch (reservation.status) {
        case "en_revision":
          reservationsStats.en_revision += 1;
          break;
        case "confirmed":
          reservationsStats.confirmed += 1;
          break;
        case "cancelled":
          reservationsStats.cancelled += 1;
          break;
        default:
          break;
      }
    }

    let ordersTotal = ordersData?.length ?? 0;
    let ticketsSold = 0;
    let ticketsUsed = 0;
    let revenuePaid = 0;

    for (const order of ordersData ?? []) {
      const isPaid = order.status === "paid";
      const quantityValue = Number(order.quantity ?? 0);

      if (Number.isNaN(quantityValue)) {
        logger.warn("Order quantity is NaN", { orderId: order.id });
        continue;
      }

      if (isPaid) {
        ticketsSold += quantityValue;
        const amount = Number(order.total_amount ?? 0);
        if (!Number.isNaN(amount)) {
          revenuePaid += amount;
        }
        if (order.used_at) {
          ticketsUsed += 1;
        }
      }
    }

    const promoViewCounts: Record<string, number> = {};

    for (const event of promoEvents ?? []) {
      const promoId = event.metadata?.promo_id;
      if (promoId) {
        promoViewCounts[promoId] = (promoViewCounts[promoId] ?? 0) + 1;
      }
    }

    let topPromo: { id: string; title: string; view_count: number } | null = null;
    for (const promo of promosData ?? []) {
      const count = promoViewCounts[promo.id] ?? 0;
      if (!topPromo || count > topPromo.view_count) {
        topPromo = {
          id: promo.id,
          title: promo.title,
          view_count: count,
        };
      }
    }

    return res.status(200).json({
      local_id: localId,
      range: {
        from: fromIso,
        to: toIso,
      },
      kpis: {
        whatsapp_clicks: whatsappCount ?? 0,
        profile_views: profileViewsError ? 0 : profileViewsCount ?? 0,
        reservations_total: reservationsStats.total,
        reservations_en_revision: reservationsStats.en_revision,
        reservations_confirmed: reservationsStats.confirmed,
        reservations_cancelled: reservationsStats.cancelled,
        orders_total: ordersTotal,
        tickets_sold: ticketsSold,
        tickets_used: ticketsUsed,
        revenue_paid: revenuePaid,
        top_promo: topPromo,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error building metrics summary", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

