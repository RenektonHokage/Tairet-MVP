import { supabase } from "./supabase";
import { logger } from "../utils/logger";

export type WeekendWindowSelection = "this" | "next";

export interface WeekendWindow {
  validFrom: string;
  validTo: string;
  windowKey: string;
}

export interface ActiveNightWindow extends WeekendWindow {
  intendedDate: string;
}

type CheckinWindowReason = "not_yet_valid" | "expired" | "legacy_not_allowed";

export type CheckinWindowValidationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: CheckinWindowReason;
      validFrom: string | null;
      validTo: string | null;
      cutoffIso: string | null;
    };

interface WeekendWindowRow {
  valid_from: string;
  valid_to: string;
  window_key: string;
}

interface ActiveNightWindowRow extends WeekendWindowRow {
  intended_date: string;
}

interface OrderWindowShape {
  valid_from?: string | null;
  valid_to?: string | null;
  is_window_legacy?: boolean | null;
  created_at?: string | null;
}

let cachedCutoffValue: string | null = null;
let cachedCutoffDate: Date | null | undefined;
const ASUNCION_TIMEZONE = "America/Asuncion";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseDateOnlyToEpochDay(value: string): number | null {
  if (!DATE_REGEX.test(value)) {
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

export function getAsuncionDateString(baseNow: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ASUNCION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(baseNow);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format Asuncion date");
  }

  return `${year}-${month}-${day}`;
}

export function validateIntendedDateRange(
  intendedDate: string,
  baseNow: Date = new Date(),
  maxDaysAhead = 30
): { ok: true } | { ok: false; reason: "invalid_format" | "out_of_range"; minDate: string; maxDate: string } {
  const intendedEpochDay = parseDateOnlyToEpochDay(intendedDate);
  const todayAsuncion = getAsuncionDateString(baseNow);
  const minEpochDay = parseDateOnlyToEpochDay(todayAsuncion);

  if (intendedEpochDay === null || minEpochDay === null) {
    return {
      ok: false,
      reason: "invalid_format",
      minDate: todayAsuncion,
      maxDate: todayAsuncion,
    };
  }

  const maxEpochDay = minEpochDay + maxDaysAhead;
  if (intendedEpochDay < minEpochDay || intendedEpochDay > maxEpochDay) {
    return {
      ok: false,
      reason: "out_of_range",
      minDate: todayAsuncion,
      maxDate: epochDayToDateString(maxEpochDay),
    };
  }

  return { ok: true };
}

export function getClubValidWindowCutoff(): Date | null {
  const cutoffIso = process.env.CLUB_VALID_WINDOW_CUTOFF_ISO?.trim() ?? "";
  const normalized = cutoffIso.length > 0 ? cutoffIso : null;

  if (normalized === cachedCutoffValue && cachedCutoffDate !== undefined) {
    return cachedCutoffDate;
  }

  cachedCutoffValue = normalized;

  if (!normalized) {
    cachedCutoffDate = null;
    return cachedCutoffDate;
  }

  const cutoffDate = parseIsoDate(normalized);
  if (!cutoffDate) {
    logger.warn("Invalid CLUB_VALID_WINDOW_CUTOFF_ISO value; running in compatibility mode", {
      cutoffIso: normalized,
    });
    cachedCutoffDate = null;
    return cachedCutoffDate;
  }

  cachedCutoffDate = cutoffDate;
  return cachedCutoffDate;
}

export function shouldMarkLegacyOrder(createdAt: Date = new Date()): boolean {
  const cutoff = getClubValidWindowCutoff();
  if (!cutoff) {
    return false;
  }
  return createdAt.getTime() < cutoff.getTime();
}

export function isLegacyOrderAllowed(order: Pick<OrderWindowShape, "is_window_legacy" | "created_at">): boolean {
  if (order.is_window_legacy === true) {
    return true;
  }

  const cutoff = getClubValidWindowCutoff();
  if (!cutoff) {
    // Compatibility mode while cutoff is not configured.
    return true;
  }

  if (!order.created_at) {
    return false;
  }

  const createdAt = parseIsoDate(order.created_at);
  if (!createdAt) {
    return false;
  }

  return createdAt.getTime() < cutoff.getTime();
}

export function validateOrderWindowForCheckin(
  order: OrderWindowShape,
  now: Date = new Date()
): CheckinWindowValidationResult {
  const validFromIso = typeof order.valid_from === "string" ? order.valid_from : null;
  const validToIso = typeof order.valid_to === "string" ? order.valid_to : null;
  const cutoff = getClubValidWindowCutoff();
  const cutoffIso = cutoff ? cutoff.toISOString() : null;

  if (validFromIso && validToIso) {
    const validFrom = parseIsoDate(validFromIso);
    const validTo = parseIsoDate(validToIso);

    if (!validFrom || !validTo) {
      return {
        allowed: false,
        reason: "legacy_not_allowed",
        validFrom: validFromIso,
        validTo: validToIso,
        cutoffIso,
      };
    }

    if (now.getTime() < validFrom.getTime()) {
      return {
        allowed: false,
        reason: "not_yet_valid",
        validFrom: validFromIso,
        validTo: validToIso,
        cutoffIso,
      };
    }

    if (now.getTime() >= validTo.getTime()) {
      return {
        allowed: false,
        reason: "expired",
        validFrom: validFromIso,
        validTo: validToIso,
        cutoffIso,
      };
    }

    return { allowed: true };
  }

  if (isLegacyOrderAllowed(order)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "legacy_not_allowed",
    validFrom: validFromIso,
    validTo: validToIso,
    cutoffIso,
  };
}

export async function getWeekendWindow(
  selection: WeekendWindowSelection,
  baseNow: Date = new Date()
): Promise<WeekendWindow> {
  const { data, error } = await supabase.rpc("get_weekend_window", {
    selection,
    base_now: baseNow.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to calculate weekend window: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as WeekendWindowRow | undefined;

  if (!row || !row.valid_from || !row.valid_to || !row.window_key) {
    throw new Error("Weekend window function returned empty response");
  }

  return {
    validFrom: row.valid_from,
    validTo: row.valid_to,
    windowKey: row.window_key,
  };
}

export async function getNightWindow(intendedDate: string): Promise<WeekendWindow> {
  const { data, error } = await supabase.rpc("get_night_window", {
    intended_date: intendedDate,
  });

  if (error) {
    throw new Error(`Failed to calculate night window: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as WeekendWindowRow | undefined;

  if (!row || !row.valid_from || !row.valid_to || !row.window_key) {
    throw new Error("Night window function returned empty response");
  }

  return {
    validFrom: row.valid_from,
    validTo: row.valid_to,
    windowKey: row.window_key,
  };
}

export async function getActiveNightWindow(baseNow: Date = new Date()): Promise<ActiveNightWindow> {
  const { data, error } = await supabase.rpc("get_active_night_window", {
    base_now: baseNow.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to calculate active night window: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as ActiveNightWindowRow | undefined;

  if (!row || !row.intended_date || !row.valid_from || !row.valid_to || !row.window_key) {
    throw new Error("Active night window function returned empty response");
  }

  return {
    intendedDate: row.intended_date,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    windowKey: row.window_key,
  };
}
