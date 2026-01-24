import { Router } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { panelAuth } from "../middlewares/panelAuth";
import {
  calendarMonthQuerySchema,
  calendarDayQuerySchema,
  updateCalendarDaySchema,
} from "../schemas/calendar";

export const calendarRouter = Router();

// GET /panel/calendar/month?month=YYYY-MM
calendarRouter.get("/month", panelAuth, async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = calendarMonthQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    const localId = req.panelUser.localId;
    const { month } = parseResult.data;

    // Parsear mes y obtener primer y último día
    const [year, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0); // Último día del mes

    const firstDayStr = firstDay.toISOString().split("T")[0];
    const lastDayStr = lastDay.toISOString().split("T")[0];

    // Obtener operaciones diarias del mes
    const { data: dailyOps, error: opsError } = await supabase
      .from("local_daily_ops")
      .select("day, is_open, note")
      .eq("local_id", localId)
      .gte("day", firstDayStr)
      .lte("day", lastDayStr);

    if (opsError) {
      logger.error("Error fetching daily ops", {
        error: opsError.message,
        localId,
        month,
      });
      return res.status(500).json({ error: opsError.message });
    }

    // Obtener reservas del mes
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("date, status")
      .eq("local_id", localId)
      .gte("date", `${firstDayStr}T00:00:00Z`)
      .lte("date", `${lastDayStr}T23:59:59Z`);

    if (reservationsError) {
      logger.error("Error fetching reservations for calendar", {
        error: reservationsError.message,
        localId,
        month,
      });
      return res.status(500).json({ error: reservationsError.message });
    }

    // Obtener órdenes pagadas del mes
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("created_at")
      .eq("local_id", localId)
      .eq("status", "paid")
      .gte("created_at", `${firstDayStr}T00:00:00Z`)
      .lte("created_at", `${lastDayStr}T23:59:59Z`);

    if (ordersError) {
      logger.error("Error fetching orders for calendar", {
        error: ordersError.message,
        localId,
        month,
      });
      return res.status(500).json({ error: ordersError.message });
    }

    // Obtener eventos de promos abiertas del mes
    const { data: promoEvents, error: promoEventsError } = await supabase
      .from("events_public")
      .select("created_at")
      .eq("local_id", localId)
      .eq("type", "promo_open")
      .gte("created_at", `${firstDayStr}T00:00:00Z`)
      .lte("created_at", `${lastDayStr}T23:59:59Z`);

    if (promoEventsError) {
      logger.warn("Error fetching promo events for calendar", {
        error: promoEventsError.message,
        localId,
        month,
      });
    }

    // Crear mapa de operaciones diarias
    const opsMap = new Map<string, { is_open: boolean; note: string | null }>();
    for (const op of dailyOps ?? []) {
      opsMap.set(op.day, { is_open: op.is_open, note: op.note });
    }

    // Agrupar por día
    const dayMap = new Map<
      string,
      {
        reservations_total: number;
        reservations_en_revision: number;
        reservations_confirmed: number;
        reservations_cancelled: number;
        orders_paid: number;
        promo_opens: number;
        is_open: boolean;
        note: string | null;
      }
    >();

    // Inicializar todos los días del mes
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, monthNum - 1, day);
      const dayStr = date.toISOString().split("T")[0];
      const op = opsMap.get(dayStr);
      dayMap.set(dayStr, {
        reservations_total: 0,
        reservations_en_revision: 0,
        reservations_confirmed: 0,
        reservations_cancelled: 0,
        orders_paid: 0,
        promo_opens: 0,
        is_open: op?.is_open ?? true, // Default: abierto
        note: op?.note ?? null,
      });
    }

    // Contar reservas por día
    for (const reservation of reservations ?? []) {
      if (!reservation.date) continue;
      const dayStr = reservation.date.split("T")[0];
      const dayData = dayMap.get(dayStr);
      if (dayData) {
        dayData.reservations_total += 1;
        switch (reservation.status) {
          case "en_revision":
            dayData.reservations_en_revision += 1;
            break;
          case "confirmed":
            dayData.reservations_confirmed += 1;
            break;
          case "cancelled":
            dayData.reservations_cancelled += 1;
            break;
        }
      }
    }

    // Contar órdenes pagadas por día
    for (const order of orders ?? []) {
      if (!order.created_at) continue;
      const dayStr = order.created_at.split("T")[0];
      const dayData = dayMap.get(dayStr);
      if (dayData) {
        dayData.orders_paid += 1;
      }
    }

    // Contar promos abiertas por día
    for (const event of promoEvents ?? []) {
      if (!event.created_at) continue;
      const dayStr = event.created_at.split("T")[0];
      const dayData = dayMap.get(dayStr);
      if (dayData) {
        dayData.promo_opens += 1;
      }
    }

    // Convertir a array
    const days = Array.from(dayMap.entries()).map(([day, data]) => ({
      day,
      ...data,
    }));

    return res.status(200).json({
      local_id: localId,
      month,
      days,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error fetching calendar month", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

// GET /panel/calendar/day?day=YYYY-MM-DD
calendarRouter.get("/day", panelAuth, async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = calendarDayQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    const localId = req.panelUser.localId;
    const { day } = parseResult.data;

    // Robust date range filtering: gte dayStart, lt nextDayStart
    const dayStart = `${day}T00:00:00Z`;
    const [yearStr, monthStr, dayStr] = day.split("-");
    const nextDate = new Date(
      Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr) + 1)
    );
    const nextDayStart = nextDate.toISOString().split("T")[0] + "T00:00:00Z";

    // Obtener tipo de local para determinar qué datos devolver
    const { data: localData, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", localId)
      .single();

    if (localError) {
      logger.error("Error fetching local type for calendar", {
        error: localError.message,
        localId,
      });
      return res.status(500).json({ error: localError.message });
    }

    const localType = localData?.type as "bar" | "club";

    // Obtener operación del día (incluye club_manual_tables)
    const { data: dailyOp, error: opsError } = await supabase
      .from("local_daily_ops")
      .select("is_open, note, club_manual_tables")
      .eq("local_id", localId)
      .eq("day", day)
      .single();

    if (opsError && opsError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.error("Error fetching daily op", {
        error: opsError.message,
        localId,
        day,
      });
      return res.status(500).json({ error: opsError.message });
    }

    // Para BARES: Obtener reservas del día (preview)
    let reservations: Array<{
      id: string;
      name: string;
      last_name?: string;
      guests: number;
      date: string;
      status: string;
      notes?: string;
      table_note?: string | null;
      created_at: string;
    }> = [];
    let reservationsTotal = 0;

    if (localType === "bar") {
      // Count total reservations for the day
      const { count: resCount, error: countError } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("local_id", localId)
        .gte("date", dayStart)
        .lt("date", nextDayStart);

      if (countError) {
        logger.error("Error counting reservations for day", {
          error: countError.message,
          localId,
          day,
        });
      } else {
        reservationsTotal = resCount ?? 0;
      }

      // Get preview (first 5 reservations)
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select(
          "id, name, last_name, guests, date, status, notes, table_note, created_at"
        )
        .eq("local_id", localId)
        .gte("date", dayStart)
        .lt("date", nextDayStart)
        .order("date", { ascending: true })
        .limit(5);

      if (reservationsError) {
        logger.error("Error fetching reservations for day", {
          error: reservationsError.message,
          localId,
          day,
        });
        return res.status(500).json({ error: reservationsError.message });
      }

      reservations = reservationsData ?? [];
    }

    // Para CLUBS: Contar órdenes checkeadas (con used_at != null)
    let checkinsCount = 0;

    if (localType === "club") {
      const { count: checkinCount, error: checkinError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("local_id", localId)
        .eq("status", "paid")
        .not("used_at", "is", null)
        .gte("used_at", dayStart)
        .lt("used_at", nextDayStart);

      if (checkinError) {
        logger.error("Error counting check-ins for day", {
          error: checkinError.message,
          localId,
          day,
        });
      } else {
        checkinsCount = checkinCount ?? 0;
      }
    }

    // Obtener órdenes pagadas del día (para resumen general, ambos tipos)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, quantity, total_amount, created_at")
      .eq("local_id", localId)
      .eq("status", "paid")
      .gte("created_at", dayStart)
      .lt("created_at", nextDayStart);

    if (ordersError) {
      logger.error("Error fetching orders for day", {
        error: ordersError.message,
        localId,
        day,
      });
      return res.status(500).json({ error: ordersError.message });
    }

    // Calcular resumen de órdenes
    const ordersCount = orders?.length ?? 0;
    const ordersTotal =
      orders?.reduce((sum, o) => {
        return sum + Number(o.total_amount ?? 0);
      }, 0) ?? 0;

    return res.status(200).json({
      local_id: localId,
      local_type: localType,
      day,
      operation: {
        is_open: dailyOp?.is_open ?? true,
        note: dailyOp?.note ?? null,
        club_manual_tables: dailyOp?.club_manual_tables ?? 0,
      },
      // Bar-specific data
      reservations,
      reservations_total: reservationsTotal,
      // Club-specific data
      checkins_count: checkinsCount,
      // General summary (both)
      orders_summary: {
        count: ordersCount,
        total: ordersTotal,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error fetching calendar day", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

// PATCH /panel/calendar/day
calendarRouter.patch("/day", panelAuth, async (req, res) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = updateCalendarDaySchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    const localId = req.panelUser.localId;
    const { day, is_open, note, club_manual_tables } = parseResult.data;

    // Obtener tipo de local para validar club_manual_tables
    const { data: localData, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", localId)
      .single();

    if (localError) {
      logger.error("Error fetching local type for calendar update", {
        error: localError.message,
        localId,
      });
      return res.status(500).json({ error: localError.message });
    }

    const localType = localData?.type as "bar" | "club";

    // Upsert en local_daily_ops
    const updatePayload: {
      local_id: string;
      day: string;
      is_open?: boolean;
      note?: string | null;
      club_manual_tables?: number;
      updated_at: string;
    } = {
      local_id: localId,
      day,
      updated_at: new Date().toISOString(),
    };

    if (is_open !== undefined) {
      updatePayload.is_open = is_open;
    }

    if (note !== undefined) {
      updatePayload.note = note;
    }

    // Solo aceptar club_manual_tables para clubs
    if (club_manual_tables !== undefined && localType === "club") {
      updatePayload.club_manual_tables = club_manual_tables;
    }

    const { data: updated, error: updateError } = await supabase
      .from("local_daily_ops")
      .upsert(updatePayload, {
        onConflict: "local_id,day",
      })
      .select("day, is_open, note, club_manual_tables")
      .single();

    if (updateError) {
      logger.error("Error updating daily op", {
        error: updateError.message,
        localId,
        day,
      });
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      local_id: localId,
      local_type: localType,
      day: updated.day,
      is_open: updated.is_open,
      note: updated.note,
      club_manual_tables: updated.club_manual_tables ?? 0,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }

    logger.error("Unexpected error updating calendar day", { error });
    return res.status(500).json({ error: "Unexpected error" });
  }
});

