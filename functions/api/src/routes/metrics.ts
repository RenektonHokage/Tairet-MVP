import { Router } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import {
  getBucketMode,
  dateToBucket,
  generateEmptyBuckets,
  initBucketMap,
} from "../lib/dateBuckets";

export const metricsRouter = Router();

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeSeries: z.enum(["0", "1"]).optional(),
});

// GET /metrics/summary - Requiere autenticación del panel y rol owner o staff
metricsRouter.get("/summary", panelAuth, requireRole(["owner", "staff"]), async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = querySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    // Usar localId del usuario autenticado (no del query)
    const localId = req.panelUser.localId;
    const { from, to, includeSeries } = parseResult.data;
    const wantSeries = includeSeries === "1";

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

    // Query de reservations: incluir guests para avg_party_size (campo ignorado en response legacy)
    const { data: reservationsData, error: reservationsError } = await supabase
      .from("reservations")
      .select("status, created_at, guests")
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (reservationsError) {
      logger.error("Error fetching reservations for metrics", {
        error: reservationsError.message,
        localId,
        fromIso,
        toIso,
      });
      return res.status(500).json({ error: reservationsError.message });
    }

    const {
      data: ordersData,
      error: ordersError,
    } = await supabase
      .from("orders")
      .select("id, status, quantity, total_amount, used_at, created_at, items")
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

    // Total de eventos promo_open en la ventana
    const promoOpenCount = promoEvents?.length ?? 0;

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

    // =========================================================================
    // KPIs legacy (sin cambios para compatibilidad)
    // =========================================================================
    let ordersTotal = ordersData?.length ?? 0;
    let ticketsSold = 0;
    let ticketsUsedLegacy = 0; // Legacy: cuenta órdenes con used_at (no qty)
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
          ticketsUsedLegacy += 1;
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

    // =========================================================================
    // Response base (kpis legacy - siempre presente)
    // =========================================================================
    const baseResponse = {
      local_id: localId,
      range: {
        from: fromIso,
        to: toIso,
      },
      kpis: {
        whatsapp_clicks: whatsappCount ?? 0,
        profile_views: profileViewsError ? 0 : profileViewsCount ?? 0,
        promo_open_count: promoOpenCount,
        reservations_total: reservationsStats.total,
        reservations_en_revision: reservationsStats.en_revision,
        reservations_confirmed: reservationsStats.confirmed,
        reservations_cancelled: reservationsStats.cancelled,
        orders_total: ordersTotal,
        tickets_sold: ticketsSold,
        tickets_used: ticketsUsedLegacy,
        revenue_paid: revenuePaid,
        top_promo: topPromo,
      },
    };

    // Si no se solicitan series, devolver response legacy (idéntico al actual)
    if (!wantSeries) {
      return res.status(200).json(baseResponse);
    }

    // =========================================================================
    // Series temporales + kpis_range (semántica A)
    // Solo cuando includeSeries=1
    // =========================================================================
    const bucketMode = getBucketMode(fromDate, toDate);
    const emptyBuckets = generateEmptyBuckets(fromDate, toDate, bucketMode);

    // ----- Semántica A para kpis_range -----
    // Vendidas (sold): SUM(quantity) de orders con created_at en rango y status=paid
    // Ya calculado en ticketsSold (correcto)

    // Usadas (used): SUM(quantity) de orders con used_at en rango y status=paid
    // Necesitamos query adicional para órdenes cuyo used_at está en el rango
    const { data: usedOrdersData, error: usedOrdersError } = await supabase
      .from("orders")
      .select("quantity, used_at")
      .eq("local_id", localId)
      .eq("status", "paid")
      .not("used_at", "is", null)
      .gte("used_at", fromIso)
      .lte("used_at", toIso);

    if (usedOrdersError) {
      logger.error("Error fetching used orders for series", {
        error: usedOrdersError.message,
        localId,
      });
    }

    let ticketsUsedSemanticA = 0;
    for (const order of usedOrdersData ?? []) {
      const qty = Number(order.quantity ?? 0);
      if (!Number.isNaN(qty)) {
        ticketsUsedSemanticA += qty;
      }
    }

    // ----- avg_party_size_confirmed para kpis_range -----
    // Calcular AVG(guests) de reservas confirmadas en el rango
    // Usa reservationsData que ya incluye guests cuando wantSeries=true
    let avgPartySizeConfirmed: number | null = null;
    const confirmedReservations = (reservationsData ?? []).filter(
      (r) =>
        r.status === "confirmed" &&
        r.guests != null &&
        typeof r.guests === "number" &&
        !Number.isNaN(r.guests)
    );
    if (confirmedReservations.length > 0) {
      const totalGuests = confirmedReservations.reduce(
        (sum, r) => sum + (r.guests as number),
        0
      );
      avgPartySizeConfirmed = totalGuests / confirmedReservations.length;
    }

    // ----- Series: profile_views -----
    const { data: profileViewsSeriesData, error: pvSeriesError } = await supabase
      .from("profile_views")
      .select("created_at")
      .eq("local_id", localId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (pvSeriesError) {
      logger.error("Error fetching profile_views for series", {
        error: pvSeriesError.message,
        localId,
      });
    }

    const profileViewsBuckets = initBucketMap(emptyBuckets, () => 0);
    for (const pv of profileViewsSeriesData ?? []) {
      const bucket = dateToBucket(new Date(pv.created_at), bucketMode);
      profileViewsBuckets.set(bucket, (profileViewsBuckets.get(bucket) ?? 0) + 1);
    }

    // ----- Series: reservations_by_status -----
    const reservationsBuckets = initBucketMap(emptyBuckets, () => ({
      confirmed: 0,
      pending: 0,
      cancelled: 0,
    }));
    for (const r of reservationsData ?? []) {
      const bucket = dateToBucket(new Date(r.created_at), bucketMode);
      const entry = reservationsBuckets.get(bucket);
      if (entry) {
        switch (r.status) {
          case "confirmed":
            entry.confirmed += 1;
            break;
          case "en_revision":
            entry.pending += 1;
            break;
          case "cancelled":
            entry.cancelled += 1;
            break;
        }
      }
    }

    // ----- Series: orders_sold_used (semántica A) -----
    // Sold: agrupar ordersData (created_at en rango, status=paid) por bucket
    const ordersSoldBuckets = initBucketMap(emptyBuckets, () => 0);
    for (const order of ordersData ?? []) {
      if (order.status !== "paid") continue;
      const qty = Number(order.quantity ?? 0);
      if (Number.isNaN(qty)) continue;
      const bucket = dateToBucket(new Date(order.created_at), bucketMode);
      ordersSoldBuckets.set(bucket, (ordersSoldBuckets.get(bucket) ?? 0) + qty);
    }

    // Used: agrupar usedOrdersData (used_at en rango, status=paid) por bucket
    const ordersUsedBuckets = initBucketMap(emptyBuckets, () => 0);
    for (const order of usedOrdersData ?? []) {
      const qty = Number(order.quantity ?? 0);
      if (Number.isNaN(qty)) continue;
      const bucket = dateToBucket(new Date(order.used_at!), bucketMode);
      ordersUsedBuckets.set(bucket, (ordersUsedBuckets.get(bucket) ?? 0) + qty);
    }

    // Merge sold + used into single array
    const ordersSoldUsedSeries = emptyBuckets.map((bucket) => ({
      bucket,
      sold: ordersSoldBuckets.get(bucket) ?? 0,
      used: ordersUsedBuckets.get(bucket) ?? 0,
    }));

    // ----- Series: tickets_sold_by_type (por tipo de entrada) -----
    const ticketsSoldByTypeBuckets = initBucketMap(
      emptyBuckets,
      () => new Map<string, number>()
    );
    const ticketTypesMetaMap = new Map<string, string>();
    const ticketTypesTotals = new Map<string, number>();

    for (const order of ordersData ?? []) {
      if (order.status !== "paid") continue;
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length === 0) continue;
      const bucket = dateToBucket(new Date(order.created_at), bucketMode);
      const bucketMap = ticketsSoldByTypeBuckets.get(bucket);
      if (!bucketMap) continue;

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item.kind !== "ticket") continue;
        const qty = Number(item.qty ?? 0);
        if (Number.isNaN(qty) || qty === 0) continue;

        const key = item.ticket_type_id ?? item.name ?? "unknown";
        const name = item.name ?? "Entrada";

        bucketMap.set(key, (bucketMap.get(key) ?? 0) + qty);
        ticketTypesTotals.set(key, (ticketTypesTotals.get(key) ?? 0) + qty);
        if (!ticketTypesMetaMap.has(key)) {
          ticketTypesMetaMap.set(key, name);
        }
      }
    }

    const ticketsSoldByTypeSeries = emptyBuckets.map((bucket) => {
      const bucketMap = ticketsSoldByTypeBuckets.get(bucket);
      const values: Record<string, number> = {};
      if (bucketMap) {
        for (const [key, value] of bucketMap.entries()) {
          if (value !== 0) values[key] = value;
        }
      }
      return { bucket, values };
    });

    const ticketTypesMeta = Array.from(ticketTypesTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => ({
        key,
        name: ticketTypesMetaMap.get(key) ?? "Entrada",
      }));

    // ----- Series: revenue_paid (ingresos pagados por bucket) -----
    // Misma definición que kpis.revenue_paid: SUM(total_amount) de orders status=paid
    const revenuePaidBuckets = initBucketMap(emptyBuckets, () => 0);
    for (const order of ordersData ?? []) {
      if (order.status !== "paid") continue;
      const amount = Number(order.total_amount ?? 0);
      if (Number.isNaN(amount)) continue;
      const bucket = dateToBucket(new Date(order.created_at), bucketMode);
      revenuePaidBuckets.set(bucket, (revenuePaidBuckets.get(bucket) ?? 0) + amount);
    }

    const revenuePaidSeries = emptyBuckets.map((bucket) => ({
      bucket,
      value: revenuePaidBuckets.get(bucket) ?? 0,
    }));

    // =========================================================================
    // Response con series y kpis_range (semántica A)
    // =========================================================================
    return res.status(200).json({
      ...baseResponse,
      kpis_range: {
        tickets_sold: ticketsSold, // SUM(qty) de orders creadas en rango, status=paid
        tickets_used: ticketsUsedSemanticA, // SUM(qty) de orders con used_at en rango, status=paid
        avg_party_size_confirmed: avgPartySizeConfirmed, // AVG(guests) de reservas confirmadas, null si no hay
        revenue_paid: revenuePaid, // SUM(total_amount) de orders status=paid en rango
      },
      series: {
        bucket_mode: bucketMode, // "day" | "week"
        profile_views: emptyBuckets.map((bucket) => ({
          bucket,
          value: profileViewsBuckets.get(bucket) ?? 0,
        })),
        reservations_by_status: emptyBuckets.map((bucket) => ({
          bucket,
          ...(reservationsBuckets.get(bucket) ?? { confirmed: 0, pending: 0, cancelled: 0 }),
        })),
        orders_sold_used: ordersSoldUsedSeries,
        tickets_sold_by_type: ticketsSoldByTypeSeries,
        ticket_types_meta: ticketTypesMeta,
        revenue_paid: revenuePaidSeries,
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

// ============================================================================
// GET /metrics/club/breakdown - Métricas desglosadas por tipo (solo clubs)
// ============================================================================

const windowSchema = z.object({
  window: z.enum(["7d", "30d", "90d"]).optional().default("30d"),
});

interface TicketBreakdownItem {
  ticket_type_id: string | null;
  name: string;
  sold_qty: number;
  used_orders: number;
  revenue: number;
}

interface TableInterestItem {
  table_type_id: string | null;
  name: string;
  price: number | null;
  interest_count: number;
}

metricsRouter.get(
  "/club/breakdown",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const localId = req.panelUser.localId;

      // Parse window parameter
      const parseResult = windowSchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.flatten() });
      }
      const { window } = parseResult.data;

      // Calcular windowStart
      const now = new Date();
      const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[window] ?? 30;
      const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const windowStartIso = windowStart.toISOString();

      // Verificar que el local sea club
      const { data: localData, error: localError } = await supabase
        .from("locals")
        .select("type")
        .eq("id", localId)
        .single();

      if (localError) {
        logger.error("Error fetching local type for breakdown", {
          error: localError.message,
          localId,
        });
        return res.status(500).json({ error: "Error fetching local" });
      }

      if (localData?.type !== "club") {
        return res.status(403).json({
          error: "Breakdown solo disponible para discotecas (clubs)",
        });
      }

      // ================================================================
      // 1. Tickets vendidos + ingresos (por tipo) - desde orders.items
      // ================================================================
      const { data: soldOrders, error: soldError } = await supabase
        .from("orders")
        .select("id, status, created_at, items")
        .eq("local_id", localId)
        .eq("status", "paid")
        .gte("created_at", windowStartIso);

      if (soldError) {
        logger.error("Error fetching sold orders for breakdown", {
          error: soldError.message,
          localId,
        });
        return res.status(500).json({ error: "Error fetching orders" });
      }

      // Agregar por tipo en Node
      const ticketsSoldMap = new Map<
        string,
        { ticket_type_id: string | null; name: string; sold_qty: number; revenue: number }
      >();

      for (const order of soldOrders ?? []) {
        const items = order.items as Array<{
          kind?: string;
          ticket_type_id?: string;
          name?: string;
          price?: number;
          qty?: number;
        }> | null;

        if (!items || !Array.isArray(items)) continue;

        for (const item of items) {
          if (item.kind !== "ticket") continue;

          const key = item.ticket_type_id ?? item.name ?? "unknown";
          const existing = ticketsSoldMap.get(key);
          const qty = Number(item.qty ?? 0);
          const price = Number(item.price ?? 0);
          const revenue = price * qty;

          if (existing) {
            existing.sold_qty += qty;
            existing.revenue += revenue;
          } else {
            ticketsSoldMap.set(key, {
              ticket_type_id: item.ticket_type_id ?? null,
              name: item.name ?? "Entrada",
              sold_qty: qty,
              revenue,
            });
          }
        }
      }

      // ================================================================
      // 2. Tickets usados (ORDENES escaneadas) - por tipo
      // ================================================================
      const { data: usedOrders, error: usedError } = await supabase
        .from("orders")
        .select("id, used_at, items")
        .eq("local_id", localId)
        .not("used_at", "is", null)
        .gte("used_at", windowStartIso);

      if (usedError) {
        logger.error("Error fetching used orders for breakdown", {
          error: usedError.message,
          localId,
        });
        return res.status(500).json({ error: "Error fetching used orders" });
      }

      // Contar ordenes usadas por tipo (no qty)
      const ticketsUsedMap = new Map<string, number>();

      for (const order of usedOrders ?? []) {
        const items = order.items as Array<{
          kind?: string;
          ticket_type_id?: string;
          name?: string;
        }> | null;

        if (!items || !Array.isArray(items)) continue;

        // Buscar primer ticket item para determinar tipo
        const ticketItem = items.find((i) => i.kind === "ticket");
        if (!ticketItem) continue;

        const key = ticketItem.ticket_type_id ?? ticketItem.name ?? "unknown";
        ticketsUsedMap.set(key, (ticketsUsedMap.get(key) ?? 0) + 1);
      }

      // Merge sold + used
      const ticketsTop: TicketBreakdownItem[] = [];
      for (const [key, soldData] of ticketsSoldMap) {
        ticketsTop.push({
          ticket_type_id: soldData.ticket_type_id,
          name: soldData.name,
          sold_qty: soldData.sold_qty,
          used_orders: ticketsUsedMap.get(key) ?? 0,
          revenue: soldData.revenue,
        });
      }

      // Ordenar por sold_qty desc
      ticketsTop.sort((a, b) => b.sold_qty - a.sold_qty);

      // ================================================================
      // 3. Interés en mesas (WhatsApp clicks con metadata)
      // ================================================================
      const { data: whatsappData, error: whatsappError } = await supabase
        .from("whatsapp_clicks")
        .select("created_at, metadata")
        .eq("local_id", localId)
        .gte("created_at", windowStartIso);

      if (whatsappError) {
        logger.error("Error fetching whatsapp clicks for breakdown", {
          error: whatsappError.message,
          localId,
        });
        // No fallar, solo devolver array vacío para mesas
      }

      // Agregar interés por mesa
      const tablesInterestMap = new Map<
        string,
        { table_type_id: string | null; name: string; price: number | null; count: number }
      >();

      for (const click of whatsappData ?? []) {
        const metadata = click.metadata as {
          table_type_id?: string;
          table_name?: string;
          table_price?: number;
        } | null;

        // Solo contar si tiene metadata de mesa
        if (!metadata?.table_type_id && !metadata?.table_name) continue;

        const key = metadata.table_type_id ?? metadata.table_name ?? "unknown";
        const existing = tablesInterestMap.get(key);

        if (existing) {
          existing.count += 1;
        } else {
          tablesInterestMap.set(key, {
            table_type_id: metadata.table_type_id ?? null,
            name: metadata.table_name ?? "Mesa",
            price: metadata.table_price ?? null,
            count: 1,
          });
        }
      }

      const tablesInterestTop: TableInterestItem[] = [];
      for (const [, data] of tablesInterestMap) {
        tablesInterestTop.push({
          table_type_id: data.table_type_id,
          name: data.name,
          price: data.price,
          interest_count: data.count,
        });
      }

      // Ordenar por interest_count desc
      tablesInterestTop.sort((a, b) => b.interest_count - a.interest_count);

      return res.status(200).json({
        window,
        tickets_top: ticketsTop,
        tables_interest_top: tablesInterestTop,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.flatten() });
      }

      logger.error("Unexpected error in club breakdown", { error });
      return res.status(500).json({ error: "Unexpected error" });
    }
  }
);
