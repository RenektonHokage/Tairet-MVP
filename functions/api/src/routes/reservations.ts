import { Router } from "express";
import { createReservationSchema } from "../schemas/reservations";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendReservationReceivedEmail } from "../services/emails";
import { panelAuth } from "../middlewares/panelAuth";
import {
  applyDailyOverride,
  computeOperationalDate,
  getTodayHoursDisplay,
  isOpenOnOperationalDate,
  validateOpeningHoursV1,
} from "../services/openingHours";

export const reservationsRouter = Router();

// POST /reservations
reservationsRouter.post("/", async (req, res, next) => {
  try {
    const parsedBody = createReservationSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const hasDateIssue = parsedBody.error.issues.some((issue) => issue.path[0] === "date");
      if (hasDateIssue) {
        return res.status(400).json({
          error: "Fecha de reserva inválida",
          code: "INVALID_RESERVATION_DATE",
        });
      }
      return next(parsedBody.error);
    }

    const validated = parsedBody.data;

    const reservationDate = new Date(validated.date);
    if (Number.isNaN(reservationDate.getTime())) {
      return res.status(400).json({
        error: "Fecha de reserva inválida",
        code: "INVALID_RESERVATION_DATE",
      });
    }

    const operationalDate = computeOperationalDate(reservationDate);

    const { data: localData, error: localError } = await supabase
      .from("locals")
      .select("id, name, opening_hours")
      .eq("id", validated.local_id)
      .maybeSingle();

    if (localError) {
      logger.error("Error fetching local for reservation validation", {
        error: localError.message,
        localId: validated.local_id,
      });
      return res.status(500).json({ error: "Error validando disponibilidad del local" });
    }

    if (!localData) {
      return res.status(404).json({
        error: "Local no encontrado",
        code: "LOCAL_NOT_FOUND",
      });
    }

    const { data: dailyOverrideRow, error: dailyOverrideError } = await supabase
      .from("local_daily_ops")
      .select("is_open")
      .eq("local_id", validated.local_id)
      .eq("day", operationalDate)
      .maybeSingle();

    if (dailyOverrideError) {
      logger.warn("Error fetching local_daily_ops for reservation validation", {
        error: dailyOverrideError.message,
        localId: validated.local_id,
        operationalDate,
      });
    }

    const dailyIsOpen = typeof dailyOverrideRow?.is_open === "boolean" ? dailyOverrideRow.is_open : undefined;

    let openingHours = null;
    if (localData.opening_hours && typeof localData.opening_hours === "object") {
      const validation = validateOpeningHoursV1(localData.opening_hours);
      if (validation.ok) {
        openingHours = validation.value;
      } else {
        logger.warn("Invalid opening_hours in reservation validation (compat mode, not blocking by schedule)", {
          localId: validated.local_id,
          errors: validation.errors,
        });
      }
    }

    const baseIsOpenOnDate = isOpenOnOperationalDate(openingHours, operationalDate);
    const baseHoursOnDate = getTodayHoursDisplay(openingHours, operationalDate);
    const { isOpenToday } = applyDailyOverride(baseIsOpenOnDate, baseHoursOnDate, dailyIsOpen);

    if (isOpenToday === false) {
      return res.status(409).json({
        error: "El local está cerrado en la fecha seleccionada",
        code: "LOCAL_CLOSED_DAY",
        operational_date: operationalDate,
      });
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        local_id: validated.local_id,
        name: validated.name,
        last_name: validated.last_name ?? null,
        email: validated.email,
        phone: validated.phone,
        date: validated.date,
        guests: validated.guests,
        status: "en_revision",
        notes: validated.notes ?? null,
        table_note: validated.table_note ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating reservation", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    const localName = localData.name ?? undefined;

    // Enviar email de forma fire-and-forget
    sendReservationReceivedEmail({
      email: validated.email,
      name: validated.name,
      localName,
      date: validated.date,
      people: validated.guests,
    }).catch((err) => {
      logger.error("Error sending reservation email", { error: err });
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /reservations/:id (DEPRECATED)
// Este endpoint público ha sido deshabilitado por seguridad.
// Usar PATCH /panel/reservations/:id con autenticación.
reservationsRouter.patch("/:id", (_req, res) => {
  return res.status(410).json({
    error: "This endpoint is deprecated. Use PATCH /panel/reservations/:id with authentication.",
  });
});

// GET /locals/:id/reservations
// Esta ruta se monta en "/locals" en server.ts
// Requiere autenticación del panel
export const localsReservationsRouter = Router();
localsReservationsRouter.get("/:id/reservations", panelAuth, async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing local id" });
    }

    // Validar que el localId del path coincida con el del usuario autenticado
    if (id !== req.panelUser.localId) {
      return res.status(403).json({ error: "Forbidden: You can only access your own local's reservations" });
    }

    const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at"
    )
    .eq("local_id", id)
    .order("created_at", { ascending: false })
    .limit(20);  

    if (error) {
      logger.error("Error fetching reservations", {
        error: error.message,
        localId: id,
      });
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data || []);
  } catch (error) {
    next(error);
  }
});
