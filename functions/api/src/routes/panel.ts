import { Router } from "express";
import * as XLSX from "xlsx";
import { ZodError } from "zod";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { calendarRouter } from "./calendar";
import { panelCatalogRouter } from "./panelCatalog";
import { panelLocalRouter } from "./panelLocal";
import { updateReservationStatusSchema } from "../schemas/reservations";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendReservationCancelledEmail, sendReservationConfirmedEmail } from "../services/emails";
import { CheckinWindowValidationResult, getActiveNightWindow, getNightWindow, validateOrderWindowForCheckin } from "../services/weekendWindow";

function buildCheckinWindowErrorPayload(validation: Extract<CheckinWindowValidationResult, { allowed: false }>) {
  if (validation.reason === "not_yet_valid") {
    return {
      status: 409,
      body: {
        error: "Aun no valida para check-in",
        code: "not_yet_valid",
        valid_from: validation.validFrom,
        valid_to: validation.validTo,
      },
    };
  }

  if (validation.reason === "expired") {
    return {
      status: 409,
      body: {
        error: "Entrada caducada para check-in",
        code: "expired",
        valid_from: validation.validFrom,
        valid_to: validation.validTo,
      },
    };
  }

  return {
    status: 409,
    body: {
      error: "Orden legacy sin ventana valida no permitida para check-in",
      code: "legacy_not_allowed",
      cutoff_iso: validation.cutoffIso,
    },
  };
}

type OrderStateFilter = "all" | "used" | "pending" | "unused";
const ORDER_STATE_FILTERS: readonly OrderStateFilter[] = ["all", "used", "pending", "unused"];

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function applyClubOrderStateFilter(query: any, state: OrderStateFilter, nowIso: string, thirtyDaysAgoIso: string) {
  if (state === "used") {
    return query.not("used_at", "is", null);
  }

  if (state === "pending") {
    return query
      .eq("status", "paid")
      .is("used_at", null)
      .not("valid_from", "is", null)
      .not("valid_to", "is", null)
      .lte("valid_from", nowIso)
      .gt("valid_to", nowIso);
  }

  if (state === "unused") {
    return query
      .eq("status", "paid")
      .is("used_at", null)
      .not("valid_to", "is", null)
      .gte("valid_to", thirtyDaysAgoIso)
      .lte("valid_to", nowIso);
  }

  return query;
}

function resolveOrderState(order: {
  status: string;
  used_at: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
}, now: Date): "used" | "pending" | "unused" | "other" {
  if (order.used_at) {
    return "used";
  }

  const nowMs = now.getTime();
  const validFromMs = order.valid_from ? Date.parse(order.valid_from) : NaN;
  const validToMs = order.valid_to ? Date.parse(order.valid_to) : NaN;
  const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  if (
    order.status === "paid" &&
    Number.isFinite(validFromMs) &&
    Number.isFinite(validToMs) &&
    validFromMs <= nowMs &&
    validToMs > nowMs
  ) {
    return "pending";
  }

  if (
    order.status === "paid" &&
    Number.isFinite(validToMs) &&
    validToMs >= thirtyDaysAgoMs &&
    validToMs <= nowMs
  ) {
    return "unused";
  }

  return "other";
}

function sumOrderQuantity(rows: Array<{ quantity: number | null }> | null | undefined): number {
  if (!rows) {
    return 0;
  }

  return rows.reduce((total, row) => {
    const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 0;
    return total + quantity;
  }, 0);
}

function sumOrderRevenue(rows: Array<{ total_amount: number | null }> | null | undefined): number {
  if (!rows) {
    return 0;
  }

  return rows.reduce((total, row) => {
    const amount =
      typeof row.total_amount === "number" && Number.isFinite(row.total_amount)
        ? row.total_amount
        : 0;
    return total + amount;
  }, 0);
}

async function verifyClubOnly(localId: string): Promise<{ isClub: boolean; error?: string }> {
  const { data: local, error } = await supabase
    .from("locals")
    .select("type")
    .eq("id", localId)
    .single();

  if (error || !local) {
    return { isClub: false, error: "Local no encontrado" };
  }

  if (local.type !== "club") {
    return { isClub: false, error: "Solo discotecas pueden gestionar catálogo de entradas y mesas" };
  }

  return { isClub: true };
}

const EXPORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EXPORT_MAX_RANGE_DAYS = 366;
const ASUNCION_TIMEZONE = "America/Asuncion";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnlyToEpochDay(value: string): number | null {
  if (!EXPORT_DATE_REGEX.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

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

function parseExportDateRange(fromRaw: unknown, toRaw: unknown):
  | { ok: true; from: string; to: string; fromEpochDay: number; toEpochDay: number }
  | { ok: false; error: string } {
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";
  const to = typeof toRaw === "string" ? toRaw.trim() : "";

  const fromEpochDay = parseDateOnlyToEpochDay(from);
  const toEpochDay = parseDateOnlyToEpochDay(to);

  if (fromEpochDay === null || toEpochDay === null) {
    return { ok: false, error: "Invalid date range. Expected from/to in YYYY-MM-DD format." };
  }

  if (fromEpochDay > toEpochDay) {
    return { ok: false, error: "Invalid date range. \"from\" must be earlier than or equal to \"to\"." };
  }

  const totalDays = toEpochDay - fromEpochDay + 1;
  if (totalDays > EXPORT_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `Date range exceeds maximum of ${EXPORT_MAX_RANGE_DAYS} days.`,
    };
  }

  return { ok: true, from, to, fromEpochDay, toEpochDay };
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

function formatDateTimeAsuncion(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-PY", {
    timeZone: ASUNCION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

function toCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const singleLine = raw.replace(/\r?\n/g, " ");
  const safeForExcel = /^[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
  return `"${safeForExcel.replace(/"/g, "\"\"")}"`;
}

function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const csvLines: string[] = [];
  csvLines.push(headers.map(toCsvCell).join(","));
  for (const row of rows) {
    csvLines.push(row.map(toCsvCell).join(","));
  }
  return `\uFEFF${csvLines.join("\r\n")}\r\n`;
}

function toExcelCell(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = value == null ? "" : String(value);
  const singleLine = raw.replace(/\r?\n/g, " ");
  return /^[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
}

function buildXlsx(headers: string[], rows: Array<Array<unknown>>): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map((value) => toExcelCell(value))),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function sanitizeFileNameSegment(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, "_");
  return collapsed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "local";
}

type ExportOrderRow = {
  id: string;
  local_id: string | null;
  status: string;
  used_at: string | null;
  checkin_token: string | null;
  customer_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  quantity: number | null;
  created_at: string | null;
  intended_date: string | null;
  valid_from: string | null;
  valid_to: string | null;
};

type ReservationsClientsExportPayload = {
  headers: string[];
  rows: Array<Array<unknown>>;
  fileNameBase: string;
};

type ReservationsClientsExportResult =
  | { ok: true; data: ReservationsClientsExportPayload }
  | { ok: false; status: number; error: string };

async function buildReservationsClientsExportPayload(
  localId: string,
  from: string,
  to: string
): Promise<ReservationsClientsExportResult> {
  const { data: local, error: localError } = await supabase
    .from("locals")
    .select("id, name, type")
    .eq("id", localId)
    .single();

  if (localError || !local) {
    logger.error("Failed to resolve local in panel export", {
      localId,
      error: localError?.message,
    });
    return { ok: false, status: 404, error: "Local not found" };
  }

  const fallbackFrom = shiftDateOnly(from, -1) ?? from;
  const fallbackToExclusive = shiftDateOnly(to, 2) ?? to;
  const now = new Date();

  if (local.type === "bar") {
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at")
      .eq("local_id", localId)
      .gte("date", `${fallbackFrom}T00:00:00.000Z`)
      .lt("date", `${fallbackToExclusive}T00:00:00.000Z`)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(10000);

    if (reservationsError) {
      logger.error("Failed to fetch reservations for panel export", {
        localId,
        from,
        to,
        error: reservationsError.message,
      });
      return { ok: false, status: 500, error: "Failed to export reservations" };
    }

    const filteredReservations = (reservations ?? []).filter((reservation) => {
      const asuncionDay = toAsuncionDateOnly(reservation.date);
      return Boolean(asuncionDay && asuncionDay >= from && asuncionDay <= to);
    });

    const headers = [
      "Tipo local",
      "Local ID",
      "Reserva ID",
      "Fecha reserva",
      "Fecha reserva y hora",
      "Estado",
      "Nombre",
      "Apellido",
      "Email",
      "Telefono",
      "Personas",
      "Nota cliente",
      "Nota interna",
      "Creada",
    ];

    const rows = filteredReservations.map((reservation) => [
      "bar",
      reservation.local_id ?? localId,
      reservation.id,
      toAsuncionDateOnly(reservation.date) ?? "",
      formatDateTimeAsuncion(reservation.date),
      reservation.status,
      reservation.name,
      reservation.last_name ?? "",
      reservation.email ?? "",
      reservation.phone ?? "",
      reservation.guests ?? "",
      reservation.notes ?? "",
      reservation.table_note ?? "",
      formatDateTimeAsuncion(reservation.created_at),
    ]);

    return {
      ok: true,
      data: {
        headers,
        rows,
        fileNameBase: `tairet_reservas_clientes_bar_${sanitizeFileNameSegment(local.name)}_${from}_a_${to}`,
      },
    };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, local_id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_phone, customer_document, quantity, created_at, intended_date, valid_from, valid_to")
    .eq("local_id", localId)
    .gte("intended_date", from)
    .lte("intended_date", to)
    .order("intended_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(10000);

  if (ordersError) {
    logger.error("Failed to fetch club orders for panel export", {
      localId,
      from,
      to,
      error: ordersError.message,
    });
    return { ok: false, status: 500, error: "Failed to export orders" };
  }

  const { data: legacyOrders, error: legacyOrdersError } = await supabase
    .from("orders")
    .select("id, local_id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_phone, customer_document, quantity, created_at, intended_date, valid_from, valid_to")
    .eq("local_id", localId)
    .is("intended_date", null)
    .gte("created_at", `${fallbackFrom}T00:00:00.000Z`)
    .lt("created_at", `${fallbackToExclusive}T00:00:00.000Z`)
    .order("created_at", { ascending: true })
    .limit(10000);

  if (legacyOrdersError) {
    logger.error("Failed to fetch legacy club orders for panel export", {
      localId,
      from,
      to,
      error: legacyOrdersError.message,
    });
    return { ok: false, status: 500, error: "Failed to export legacy orders" };
  }

  const legacyInRange = (legacyOrders ?? []).filter((order) => {
    const createdDay = toAsuncionDateOnly(order.created_at);
    return Boolean(createdDay && createdDay >= from && createdDay <= to);
  });

  const clubRowsMap = new Map<string, ExportOrderRow>();
  for (const order of orders ?? []) {
    clubRowsMap.set(order.id, order);
  }
  for (const legacyOrder of legacyInRange) {
    if (!clubRowsMap.has(legacyOrder.id)) {
      clubRowsMap.set(legacyOrder.id, legacyOrder);
    }
  }

  const allOrders = Array.from(clubRowsMap.values()).sort((a, b) => {
    const aKey = a.intended_date ?? toAsuncionDateOnly(a.created_at) ?? "";
    const bKey = b.intended_date ?? toAsuncionDateOnly(b.created_at) ?? "";
    if (aKey === bKey) {
      const aCreated = Date.parse(a.created_at ?? "");
      const bCreated = Date.parse(b.created_at ?? "");
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated)) {
        return aCreated - bCreated;
      }
      return 0;
    }
    return aKey.localeCompare(bKey);
  });

  const headers = [
    "Tipo local",
    "Local ID",
    "Orden ID",
    "Fecha evento",
    "Estado check-in",
    "Estado orden",
    "Nombre",
    "Apellido",
    "Email",
    "Telefono",
    "Documento",
    "Entradas",
    "Token check-in",
    "Usada",
    "Creada",
  ];

  const rows = allOrders.map((order) => [
    "club",
    order.local_id ?? localId,
    order.id,
    order.intended_date ?? toAsuncionDateOnly(order.created_at) ?? "",
    resolveOrderState(order, now),
    order.status,
    order.customer_name ?? "",
    order.customer_last_name ?? "",
    order.customer_email ?? "",
    order.customer_phone ?? "",
    order.customer_document ?? "",
    typeof order.quantity === "number" && Number.isFinite(order.quantity) ? order.quantity : "",
    order.checkin_token ?? "",
    formatDateTimeAsuncion(order.used_at),
    formatDateTimeAsuncion(order.created_at),
  ]);

  return {
    ok: true,
    data: {
      headers,
      rows,
      fileNameBase: `tairet_reservas_clientes_club_${sanitizeFileNameSegment(local.name)}_${from}_a_${to}`,
    },
  };
}

export const panelRouter = Router();

// GET /panel/me
// Endpoint para obtener información del usuario del panel autenticado
// Requiere autenticación (middleware panelAuth)
panelRouter.get("/me", panelAuth, async (req, res) => {
  // req.panelUser está disponible gracias al middleware panelAuth
  if (!req.panelUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Obtener información del local (con JOIN)
    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("id, name, slug, type")
      .eq("id", req.panelUser.localId)
      .single();

    if (localError || !local) {
      logger.warn("Local not found for panel user", {
        localId: req.panelUser.localId,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for panel user" });
    }

    res.status(200).json({
      role: req.panelUser.role,
      email: req.panelUser.email,
      local: {
        id: local.id,
        name: local.name,
        slug: local.slug,
        type: local.type,
      },
    });
  } catch (error) {
    logger.error("Error fetching panel user info", {
      localId: req.panelUser.localId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

panelRouter.use("/local", panelLocalRouter);

// GET /panel/reservations/search?q=<term>
// Buscar reservas por email, phone, name o last_name
// Roles permitidos: owner, staff
panelRouter.get(
  "/reservations/search",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { q } = req.query;
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.status(400).json({ error: "Missing search query (q)" });
      }

      const searchTerm = q.trim();

      // Búsqueda multi-criterio: email, phone, name, last_name
      const { data, error } = await supabase
        .from("reservations")
        .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at")
        .eq("local_id", req.panelUser.localId) // TENANT SEGURO
        .or(`email.ilike.%${searchTerm}%,phone.eq.${searchTerm},name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("Error searching reservations", {
          error: error.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json(data || []);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /panel/reservations/:id
// Actualiza estado o table_note de una reserva
// Requiere autenticación y validación de tenant
panelRouter.patch("/reservations/:id", panelAuth, async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing reservation id" });
    }

    const validated = updateReservationStatusSchema.parse(req.body);

    // Buscar la reserva actual
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      logger.error("Error fetching reservation", {
        error: fetchError?.message,
        reservationId: id,
      });
      return res.status(404).json({ error: "Reservation not found" });
    }

    // TENANT CHECK: validar que la reserva pertenece al local del usuario
    if (reservation.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in reservation update", {
        reservationId: id,
        reservationLocalId: reservation.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update reservations for your own local",
      });
    }

    // Preparar objeto de actualización
    const updateData: {
      status?: string;
      table_note?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    // Si se intenta cambiar el status, validar que solo se puede desde 'en_revision'
    if (validated.status !== undefined) {
      if (reservation.status !== "en_revision") {
        return res.status(400).json({
          error: "La reserva ya fue procesada",
          currentStatus: reservation.status,
        });
      }
      updateData.status = validated.status;
    }

    // Permitir actualizar table_note independientemente del status
    if (validated.table_note !== undefined) {
      updateData.table_note = validated.table_note;
    }

    // Si no hay nada que actualizar, retornar error
    if (Object.keys(updateData).length === 1) {
      // Solo updated_at, no hay cambios reales
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    // Actualizar la reserva
    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at")
      .single();

    if (updateError) {
      logger.error("Error updating reservation", {
        error: updateError.message,
        reservationId: id,
      });
      return res.status(500).json({ error: updateError.message });
    }

    const statusChanged =
      validated.status !== undefined && validated.status !== reservation.status;

    if (statusChanged && (updated.status === "confirmed" || updated.status === "cancelled")) {
      let localName: string | undefined;
      const { data: localData, error: localError } = await supabase
        .from("locals")
        .select("name")
        .eq("id", reservation.local_id)
        .maybeSingle();

      if (localError) {
        logger.warn("Error fetching local name for reservation status email", {
          error: localError.message,
          localId: reservation.local_id,
        });
      } else {
        localName = localData?.name ?? undefined;
      }

      if (updated.status === "confirmed") {
        sendReservationConfirmedEmail({
          email: reservation.email,
          name: reservation.name,
          localName,
          date: reservation.date,
          people: reservation.guests,
        }).catch((err) => {
          logger.error("Error sending reservation confirmation email", { error: err });
        });
      } else if (updated.status === "cancelled") {
        sendReservationCancelledEmail({
          email: reservation.email,
          name: reservation.name,
          localName,
          date: reservation.date,
          people: reservation.guests,
          cancelReason: validated.cancel_reason || validated.table_note || undefined,
        }).catch((err) => {
          logger.error("Error sending reservation cancellation email", { error: err });
        });
      }
    }

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    next(error);
  }
});

// PATCH /panel/orders/:id/use (check-in)
// Roles permitidos: owner, staff
panelRouter.patch("/orders/:id/use", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing order id" });
    }

    // Buscar la orden
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in order check-in", {
        orderId: id,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update orders for your own local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(400).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", order.local_id)
      .single();

    if (localError || !local) {
      logger.error("Local not found while validating check-in window", {
        orderId: id,
        localId: order.local_id,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for order" });
    }

    if (local.type === "club") {
      const windowValidation = validateOrderWindowForCheckin(order, new Date());
      if (!windowValidation.allowed) {
        const payload = buildCheckinWindowErrorPayload(windowValidation);
        return res.status(payload.status).json(payload.body);
      }
    }

    // Actualizar used_at
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating order for check-in", {
        error: updateError.message,
        orderId: id,
      });
      return res.status(500).json({ error: "Failed to update order" });
    }

    logger.info("Order checked in successfully", {
      orderId: id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// PATCH /panel/checkin/:token
// Check-in por QR token
// Roles permitidos: owner, staff
panelRouter.patch("/checkin/:token", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Missing checkin token" });
    }

    // Buscar order por checkin_token
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, local_id, status, used_at, checkin_token, valid_from, valid_to, is_window_legacy, created_at")
      .eq("checkin_token", token)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in token check-in", {
        token,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: This order belongs to another local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(409).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", order.local_id)
      .single();

    if (localError || !local) {
      logger.error("Local not found while validating token check-in window", {
        token,
        localId: order.local_id,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for order" });
    }

    if (local.type === "club") {
      const windowValidation = validateOrderWindowForCheckin(order, new Date());
      if (!windowValidation.allowed) {
        const payload = buildCheckinWindowErrorPayload(windowValidation);
        return res.status(payload.status).json(payload.body);
      }
    }

    // Actualizar used_at y devolver datos del comprador para verificación
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("checkin_token", token)
      .select("id, local_id, status, used_at, customer_name, customer_last_name, customer_document")
      .single();

    if (updateError) {
      logger.error("Error in token check-in", {
        error: updateError.message,
        token,
      });
      return res.status(500).json({ error: "Failed to check in" });
    }

    logger.info("Token check-in successful", {
      orderId: updated.id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// GET /panel/checkins
// Últimos check-ins del local (used_at NOT NULL)
// Roles permitidos: owner, staff
panelRouter.get("/checkins", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limitParam = req.query.limit;
    const limit = typeof limitParam === "string" ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;
    const now = new Date();
    const nowIso = now.toISOString();

    let pendingCount = 0;
    let unusedCount = 0;
    let currentWindow: { intended_date: string; valid_from: string; valid_to: string; window_key: string } | null = null;

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", req.panelUser.localId)
      .single();

    if (localError || !local) {
      logger.error("Error fetching local type for /panel/checkins", {
        error: localError?.message,
        localId: req.panelUser.localId,
      });
      return res.status(404).json({ error: "Local not found" });
    }

    const { data: checkins, error } = await supabase
      .from("orders")
      .select("id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_document")
      .eq("local_id", req.panelUser.localId)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Error fetching checkins", { error: error.message });
      return res.status(500).json({ error: "Failed to fetch checkins" });
    }

    if (local.type === "club") {
      try {
        const activeNightWindow = await getActiveNightWindow(now);
        currentWindow = {
          intended_date: activeNightWindow.intendedDate,
          valid_from: activeNightWindow.validFrom,
          valid_to: activeNightWindow.validTo,
          window_key: activeNightWindow.windowKey,
        };

        const { count: pending, error: pendingError } = await supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("local_id", req.panelUser.localId)
          .eq("status", "paid")
          .is("used_at", null)
          .not("valid_from", "is", null)
          .not("valid_to", "is", null)
          .lte("valid_from", nowIso)
          .gt("valid_to", nowIso);

        if (pendingError) {
          logger.error("Error fetching pending_count in /panel/checkins", {
            error: pendingError.message,
            localId: req.panelUser.localId,
          });
        } else {
          pendingCount = pending ?? 0;
        }

        const { count: unused, error: unusedError } = await supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("local_id", req.panelUser.localId)
          .eq("status", "paid")
          .is("used_at", null)
          .not("valid_to", "is", null)
          .gte("valid_to", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .lte("valid_to", nowIso);

        if (unusedError) {
          logger.error("Error fetching unused_count in /panel/checkins", {
            error: unusedError.message,
            localId: req.panelUser.localId,
          });
        } else {
          unusedCount = unused ?? 0;
        }
      } catch (windowError) {
        logger.error("Error calculating current weekend window in /panel/checkins", {
          error: windowError instanceof Error ? windowError.message : String(windowError),
          localId: req.panelUser.localId,
        });
      }
    }

    res.status(200).json({
      items: checkins ?? [],
      count: checkins?.length ?? 0,
      pending_count: pendingCount,
      unused_count: unusedCount,
      current_window: currentWindow,
    });
  } catch (error) {
    next(error);
  }
});

// GET /panel/orders/search
// Buscar órdenes por email o documento
// Roles permitidos: owner, staff
panelRouter.get("/orders/search", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const localId = req.panelUser.localId;

    const { email, document } = req.query;
    const intendedDateRaw =
      typeof req.query.intended_date === "string" ? req.query.intended_date.trim() : "";
    const hasIntendedDate = intendedDateRaw.length > 0;
    const stateRaw =
      typeof req.query.state === "string" ? req.query.state.trim().toLowerCase() : "all";
    const selectedState: OrderStateFilter = ORDER_STATE_FILTERS.includes(stateRaw as OrderStateFilter)
      ? (stateRaw as OrderStateFilter)
      : "all";
    const stateProvided = typeof req.query.state === "string" && req.query.state.trim().length > 0;

    if (stateProvided && !ORDER_STATE_FILTERS.includes(stateRaw as OrderStateFilter)) {
      return res.status(400).json({ error: "Invalid state. Expected all|used|pending|unused" });
    }

    // Si vienen ambos filtros de búsqueda, es inválido.
    const hasEmail = typeof email === "string" && email.trim().length > 0;
    const hasDocument = typeof document === "string" && document.trim().length > 0;

    if (hasEmail && hasDocument) {
      return res.status(400).json({ error: "Provide only one parameter: email or document" });
    }

    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit =
      typeof limitParam === "string"
        ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100)
        : 20;
    const offset =
      typeof offsetParam === "string" ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;
    const now = new Date();
    const nowIso = now.toISOString();
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("orders")
      .select(
        "id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_phone, customer_document, quantity, created_at, intended_date, valid_from, valid_to",
        { count: "exact" }
      )
      .eq("local_id", localId);

    if (hasEmail) {
      const emailLower = email.trim().toLowerCase();
      query = query.eq("customer_email_lower", emailLower);
    } else if (hasDocument) {
      query = query.eq("customer_document", document.trim());
    }

    if (hasIntendedDate || selectedState !== "all") {
      const clubCheck = await verifyClubOnly(localId);
      if (clubCheck.isClub) {
        if (hasIntendedDate && !isValidDateOnly(intendedDateRaw)) {
          return res.status(400).json({ error: "Invalid intended_date. Expected YYYY-MM-DD" });
        }

        if (hasIntendedDate) {
          query = query.eq("intended_date", intendedDateRaw);
        }

        query = applyClubOrderStateFilter(query, selectedState, nowIso, thirtyDaysAgoIso);
      }
    }

    const rangeEnd = offset + limit - 1;
    const { data: orders, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, rangeEnd);

    if (error) {
      logger.error("Error searching orders", { error: error.message });
      return res.status(500).json({ error: "Failed to search orders" });
    }

    const items = (orders ?? []).map((order) => ({
      ...order,
      checkin_state: resolveOrderState(order, now),
    }));

    const total = count ?? items.length;

    res.status(200).json({
      items,
      count: items.length,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  } catch (error) {
    next(error);
  }
});

// GET /panel/orders/summary
// Resumen de entradas por estado para clubs (SUM(quantity)).
// Roles permitidos: owner, staff
panelRouter.get("/orders/summary", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const localId = req.panelUser.localId;

    const clubCheck = await verifyClubOnly(localId);
    if (!clubCheck.isClub) {
      return res.status(200).json({
        total_qty: 0,
        used_qty: 0,
        pending_qty: 0,
        unused_qty: 0,
        revenue_paid: 0,
        latest_purchase_at: null,
        recent_sales_qty: 0,
        recent_sales_window_label: "Últimas 24 h",
        total_count: 0,
        used_count: 0,
        pending_count: 0,
        unused_count: 0,
        current_window: null,
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSalesStartIso = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();

    const intendedDateRaw =
      typeof req.query.intended_date === "string" ? req.query.intended_date.trim() : "";
    const hasIntendedDate = intendedDateRaw.length > 0;

    if (hasIntendedDate && !isValidDateOnly(intendedDateRaw)) {
      return res.status(400).json({ error: "Invalid intended_date. Expected YYYY-MM-DD" });
    }

    let selectedIntendedDate = intendedDateRaw;
    let currentWindow: { intended_date: string; valid_from: string; valid_to: string; window_key: string } | null = null;

    if (!selectedIntendedDate) {
      const activeNightWindow = await getActiveNightWindow(now);
      selectedIntendedDate = activeNightWindow.intendedDate;
      currentWindow = {
        intended_date: activeNightWindow.intendedDate,
        valid_from: activeNightWindow.validFrom,
        valid_to: activeNightWindow.validTo,
        window_key: activeNightWindow.windowKey,
      };
    } else {
      const nightWindow = await getNightWindow(selectedIntendedDate);
      currentWindow = {
        intended_date: selectedIntendedDate,
        valid_from: nightWindow.validFrom,
        valid_to: nightWindow.validTo,
        window_key: nightWindow.windowKey,
      };
    }

    const buildOrdersSummaryQuery = (selectClause: string) =>
      supabase
        .from("orders")
        .select(selectClause)
        .eq("local_id", localId)
        .eq("intended_date", selectedIntendedDate);

    const [
      { data: usedRows, error: usedError },
      { data: pendingRows, error: pendingError },
      { data: unusedRows, error: unusedError },
      { data: latestPurchaseRows, error: latestPurchaseError },
      { data: recentSalesRows, error: recentSalesError },
    ] = await Promise.all([
      applyClubOrderStateFilter(
        buildOrdersSummaryQuery(
          "id, quantity, total_amount, status, used_at, valid_from, valid_to"
        ),
        "used",
        nowIso,
        thirtyDaysAgoIso
      ),
      applyClubOrderStateFilter(
        buildOrdersSummaryQuery(
          "id, quantity, total_amount, status, used_at, valid_from, valid_to"
        ),
        "pending",
        nowIso,
        thirtyDaysAgoIso
      ),
      applyClubOrderStateFilter(
        buildOrdersSummaryQuery(
          "id, quantity, total_amount, status, used_at, valid_from, valid_to"
        ),
        "unused",
        nowIso,
        thirtyDaysAgoIso
      ),
      buildOrdersSummaryQuery("created_at")
        .eq("status", "paid")
        .lte("created_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1),
      buildOrdersSummaryQuery("quantity, created_at")
        .eq("status", "paid")
        .gte("created_at", recentSalesStartIso)
        .lte("created_at", nowIso),
    ]);

    if (
      usedError ||
      pendingError ||
      unusedError ||
      latestPurchaseError ||
      recentSalesError
    ) {
      logger.error("Error fetching /panel/orders/summary", {
        usedError: usedError?.message,
        pendingError: pendingError?.message,
        unusedError: unusedError?.message,
        latestPurchaseError: latestPurchaseError?.message,
        recentSalesError: recentSalesError?.message,
        localId,
        intendedDate: selectedIntendedDate,
      });
      return res.status(500).json({ error: "Failed to calculate orders summary" });
    }

    const usedQty = sumOrderQuantity(usedRows);
    const pendingQty = sumOrderQuantity(pendingRows);
    const unusedQty = sumOrderQuantity(unusedRows);
    const totalQty = usedQty + pendingQty + unusedQty;
    const revenuePaid =
      sumOrderRevenue(usedRows) +
      sumOrderRevenue(pendingRows) +
      sumOrderRevenue(unusedRows);
    const latestPurchaseAt = latestPurchaseRows?.[0]?.created_at ?? null;
    const recentSalesQty = sumOrderQuantity(recentSalesRows);

    res.status(200).json({
      total_qty: totalQty,
      used_qty: usedQty,
      pending_qty: pendingQty,
      unused_qty: unusedQty,
      revenue_paid: revenuePaid,
      latest_purchase_at: latestPurchaseAt,
      recent_sales_qty: recentSalesQty,
      recent_sales_window_label: "Últimas 24 h",
      total_count: (usedRows?.length ?? 0) + (pendingRows?.length ?? 0) + (unusedRows?.length ?? 0),
      used_count: usedRows?.length ?? 0,
      pending_count: pendingRows?.length ?? 0,
      unused_count: unusedRows?.length ?? 0,
      current_window: currentWindow,
    });
  } catch (error) {
    next(error);
  }
});

// GET /panel/exports/reservations-clients.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
// Export CSV de reservas/clientes por local autenticado y rango de fechas
// Roles permitidos: owner, staff
panelRouter.get("/exports/reservations-clients.csv", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsedRange = parseExportDateRange(req.query.from, req.query.to);
    if (!parsedRange.ok) {
      return res.status(400).json({ error: parsedRange.error });
    }

    const { from, to } = parsedRange;
    const exportPayload = await buildReservationsClientsExportPayload(req.panelUser.localId, from, to);
    if (!exportPayload.ok) {
      return res.status(exportPayload.status).json({ error: exportPayload.error });
    }

    const fileName = `${exportPayload.data.fileNameBase}.csv`;
    const csvBody = buildCsv(exportPayload.data.headers, exportPayload.data.rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csvBody);
  } catch (error) {
    next(error);
  }
});

// GET /panel/exports/reservations-clients.xlsx?from=YYYY-MM-DD&to=YYYY-MM-DD
// Export Excel de reservas/clientes por local autenticado y rango de fechas
// Roles permitidos: owner, staff
panelRouter.get("/exports/reservations-clients.xlsx", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsedRange = parseExportDateRange(req.query.from, req.query.to);
    if (!parsedRange.ok) {
      return res.status(400).json({ error: parsedRange.error });
    }

    const { from, to } = parsedRange;
    const exportPayload = await buildReservationsClientsExportPayload(req.panelUser.localId, from, to);
    if (!exportPayload.ok) {
      return res.status(exportPayload.status).json({ error: exportPayload.error });
    }

    const fileName = `${exportPayload.data.fileNameBase}.xlsx`;
    const workbook = buildXlsx(exportPayload.data.headers, exportPayload.data.rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(workbook);
  } catch (error) {
    next(error);
  }
});



panelRouter.use("/catalog", panelCatalogRouter);

// Rutas de calendario
panelRouter.use("/calendar", calendarRouter);
