import { Router } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";

type ActivityType =
  | "order_created"
  | "order_paid"
  | "order_used"
  | "reservation_created"
  | "reservation_updated"
  | "whatsapp_click"
  | "promo_view"
  | "profile_view";

interface ActivityItem {
  type: ActivityType;
  label: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const querySchema = z.object({
  localId: z.string().uuid().optional(),
});

export const activityRouter = Router();

// GET /activity - Requiere autenticación del panel
activityRouter.get("/", panelAuth, async (req, res) => {
  if (!req.panelUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Usar localId del usuario autenticado, ignorar cualquier localId del query
  const localId = req.panelUser.localId;

  try {
    const [ordersResult, reservationsResult, paymentEventsResult, whatsappResult, promoEventsResult, promosResult, profileViewsResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id, status, quantity, total_amount, created_at, used_at")
          .eq("local_id", localId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("reservations")
          .select("id, name, guests, status, created_at, updated_at")
          .eq("local_id", localId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("payment_events")
          .select(
            "order_id, status, created_at, orders!inner(local_id)"
          )
          .eq("orders.local_id", localId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("whatsapp_clicks")
          .select("id, metadata, created_at")
          .eq("local_id", localId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("events_public")
          .select("metadata, created_at")
          .eq("local_id", localId)
          .eq("type", "promo_open")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("promos")
          .select("id, title")
          .eq("local_id", localId),
        supabase
          .from("profile_views")
          .select("id, created_at")
          .eq("local_id", localId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

    const errors = [
      { name: "orders", error: ordersResult.error },
      { name: "reservations", error: reservationsResult.error },
      { name: "payment_events", error: paymentEventsResult.error },
      { name: "whatsapp_clicks", error: whatsappResult.error },
      { name: "events_public", error: promoEventsResult.error },
      { name: "promos", error: promosResult.error },
      { name: "profile_views", error: profileViewsResult.error },
    ].filter((entry) => entry.error != null);

    if (errors.some((entry) => entry.name === "orders" || entry.name === "reservations" || entry.name === "payment_events")) {
      const first = errors[0];
      logger.error("Error fetching activity data", {
        localId,
        source: first.name,
        error: first.error?.message,
      });
      return res.status(500).json({ error: first.error?.message ?? "Failed to load activity" });
    }

    // Log non-critical errors but continue
    for (const entry of errors) {
      if (entry.name !== "orders" && entry.name !== "reservations" && entry.name !== "payment_events") {
        logger.warn("Non critical error fetching activity data", {
          localId,
          source: entry.name,
          error: entry.error?.message,
        });
      }
    }

    const items: ActivityItem[] = [];

    const orders = ordersResult.data ?? [];
    const reservations = reservationsResult.data ?? [];
    const paymentEvents = paymentEventsResult.data ?? [];
    const whatsappClicks = whatsappResult.data ?? [];
    const promoEvents = promoEventsResult.data ?? [];
    const promos = promosResult.data ?? [];
    const profileViews = profileViewsResult.data ?? [];

    const promoTitleMap = new Map<string, string>();
    for (const promo of promos) {
      promoTitleMap.set(promo.id, promo.title ?? "Promo");
    }

    const orderMap = new Map<string, (typeof orders)[number]>();
    for (const order of orders) {
      orderMap.set(order.id, order);
    }

    for (const order of orders) {
      if (order.created_at) {
        items.push({
          type: "order_created",
          label: `Orden creada (PYG ${Number(order.total_amount ?? 0).toLocaleString("es-PY")})`,
          timestamp: new Date(order.created_at).toISOString(),
          meta: {
            order_id: order.id,
            status: order.status,
            amount: Number(order.total_amount ?? 0),
          },
        });
      }

      if (order.used_at) {
        items.push({
          type: "order_used",
          label: "Orden usada",
          timestamp: new Date(order.used_at).toISOString(),
          meta: {
            order_id: order.id,
            status: order.status,
          },
        });
      }
    }

    for (const payment of paymentEvents) {
      const order = payment.order_id ? orderMap.get(payment.order_id) : null;
      if (!payment.created_at) {
        continue;
      }

      if (order) {
        items.push({
          type: "order_paid",
          label: `Orden pagada (PYG ${Number(order.total_amount ?? 0).toLocaleString("es-PY")})`,
          timestamp: new Date(payment.created_at).toISOString(),
          meta: {
            order_id: payment.order_id,
            amount: Number(order.total_amount ?? 0),
            status: order.status,
          },
        });
      }
    }

    for (const reservation of reservations) {
      if (reservation.created_at) {
        items.push({
          type: "reservation_created",
          label: `Reserva creada: ${reservation.name ?? "Cliente"} (${reservation.guests ?? "-"} personas)`,
          timestamp: new Date(reservation.created_at).toISOString(),
          meta: {
            reservation_id: reservation.id,
            status: reservation.status,
            guests: reservation.guests,
          },
        });
      }

      if (
        reservation.updated_at &&
        reservation.created_at &&
        new Date(reservation.updated_at).getTime() > new Date(reservation.created_at).getTime()
      ) {
        items.push({
          type: "reservation_updated",
          label: `Reserva actualizada: ${reservation.status}`,
          timestamp: new Date(reservation.updated_at).toISOString(),
          meta: {
            reservation_id: reservation.id,
            status: reservation.status,
          },
        });
      }
    }

    for (const click of whatsappClicks) {
      if (!click.created_at) {
        continue;
      }
      const metadata = (click.metadata ?? {}) as Record<string, unknown>;
      items.push({
        type: "whatsapp_click",
        label: "Click a WhatsApp",
        timestamp: new Date(click.created_at).toISOString(),
        meta: {
          source: typeof metadata.source === "string" ? metadata.source : undefined,
        },
      });
    }

    for (const event of promoEvents) {
      if (!event.created_at) {
        continue;
      }
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      const promoId = typeof metadata.promo_id === "string" ? metadata.promo_id : undefined;
      if (!promoId) {
        continue;
      }
      const title = promoTitleMap.get(promoId) ?? "Promo";
      items.push({
        type: "promo_view",
        label: `Promo vista: ${title}`,
        timestamp: new Date(event.created_at).toISOString(),
        meta: {
          promo_id: promoId,
        },
      });
    }

    for (const view of profileViews) {
      if (!view.created_at) {
        continue;
      }
      items.push({
        type: "profile_view",
        label: "Visita al perfil",
        timestamp: new Date(view.created_at).toISOString(),
      });
    }

    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.status(200).json({
      local_id: localId,
      items: items.slice(0, 5),
    });
  } catch (error) {
    logger.error("Unexpected error building activity timeline", { error, localId });
    return res.status(500).json({ error: "Unexpected error" });
  }
});
