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
const ASUNCION_TIMEZONE = "America/Asuncion";
const MS_PER_DAY = 86_400_000;

function parseDateOnlyToEpochDay(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(utcMs / MS_PER_DAY);
}

function epochDayToDateString(epochDay: number): string {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
}

function shiftDateOnly(value: string, deltaDays: number): string | null {
  const epochDay = parseDateOnlyToEpochDay(value);
  if (epochDay === null) {
    return null;
  }

  return epochDayToDateString(epochDay + deltaDays);
}

function toAsuncionDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ASUNCION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

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

    const dateParam = typeof req.query.date === "string" ? req.query.date.trim() : "";

    if (dateParam) {
      if (parseDateOnlyToEpochDay(dateParam) === null) {
        return res.status(400).json({
          error: 'Invalid date. Expected query param "date" in YYYY-MM-DD format.',
        });
      }

      const fallbackFrom = shiftDateOnly(dateParam, -1) ?? dateParam;
      const fallbackToExclusive = shiftDateOnly(dateParam, 2) ?? dateParam;

      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at"
        )
        .eq("local_id", id)
        .gte("date", `${fallbackFrom}T00:00:00.000Z`)
        .lt("date", `${fallbackToExclusive}T00:00:00.000Z`)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("Error fetching reservations for date", {
          error: error.message,
          localId: id,
          date: dateParam,
        });
        return res.status(500).json({ error: error.message });
      }

      const filtered = (data || []).filter((reservation) => {
        return toAsuncionDateOnly(reservation.date) === dateParam;
      });

      return res.status(200).json(filtered);
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
