/**
 * Funciones para obtener información de locales desde la API.
 * Usado por B2C para resolver slug → local_id real.
 */

import { API_URL } from "@/constants";
import type { ApiPromotion } from "./types";
import { slugify } from "./slug";
import { formatHoursDisplay } from "./hours";
import { getAsuncionOperationalDayIso } from "./operationalDay";

function getApiBase(): string {
  return import.meta.env?.VITE_API_URL || API_URL || "http://localhost:4000";
}

// Gallery Types
// hero: imagen principal del perfil (solo bar, NO aparece en cards)
// cover: foto de perfil para cards/listado
export type GalleryKind = "cover" | "hero" | "carousel" | "menu" | "drinks" | "food" | "interior";

export interface LocalGalleryItem {
  id: string;
  url: string;
  path: string; // Storage object path
  kind: GalleryKind;
  order: number;
}

export interface LocalInfo {
  id: string; // UUID
  slug: string;
  name: string;
  address: string | null;
  location: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: string[];
  opening_hours: OpeningHoursV1 | null;
  is_open_today?: boolean | null;
  today_hours?: string | null;
  operational_date?: string;
  additional_info: string[];
  phone: string | null;
  whatsapp: string | null;
  ticket_price: number;
  type: "bar" | "club";
  gallery: LocalGalleryItem[];
  // Promotions from DB (may be undefined if backend is old, empty array if no promos)
  promotions?: ApiPromotion[];
}

// Tipo para listado de locales (resumido, con cover)
export interface LocalListItem {
  id: string;
  slug: string;
  name: string;
  type: "bar" | "club";
  location: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cover_url: string | null;
  attributes: string[];
  min_age: number | null;
  is_open_today?: boolean | null;
  today_hours?: string | null;
  operational_date?: string;
}

interface TodayScheduleSource {
  is_open_today?: boolean | null;
  today_hours?: string | null;
}

type OpeningHoursDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface OpeningHoursRange {
  start: string;
  end: string;
}

interface OpeningHoursDay {
  closed: boolean;
  ranges: OpeningHoursRange[];
}

export interface OpeningHoursV1 {
  version: 1;
  timezone: "America/Asuncion";
  days: Record<OpeningHoursDayKey, OpeningHoursDay>;
}

const OPENING_DAY_ORDER: OpeningHoursDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const OPENING_DAY_LABELS: Record<OpeningHoursDayKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mie",
  thu: "Jue",
  fri: "Vie",
  sat: "Sab",
  sun: "Dom",
};

const OPENING_DAY_INDEX: Record<OpeningHoursDayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const STRICT_HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeHHmm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (STRICT_HHMM_REGEX.test(trimmed)) {
    return trimmed;
  }

  const tolerantMatch = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!tolerantMatch) return null;

  const hour = Number.parseInt(tolerantMatch[1], 10);
  const minute = Number.parseInt(tolerantMatch[2] ?? "0", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatOpeningRange(range: OpeningHoursRange): string | null {
  const start = normalizeHHmm(range.start);
  const end = normalizeHHmm(range.end);
  if (!start || !end || start === end) return null;

  return `${start}–${end} hs`;
}

function normalizeLegacyHoursLines(rawHours: unknown): string[] {
  if (!Array.isArray(rawHours)) return [];

  return rawHours
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => formatHoursDisplay(item) ?? item);
}

function normalizeDayText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDayKeyFromOperationalIso(isoDate: string): OpeningHoursDayKey | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayMap: OpeningHoursDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return dayMap[utcDate.getUTCDay()] ?? null;
}

function mapLegacyTokenToDay(token: string): OpeningHoursDayKey | null {
  const normalizedToken = normalizeDayText(token);
  if (normalizedToken.startsWith("lun")) return "mon";
  if (normalizedToken.startsWith("mar")) return "tue";
  if (normalizedToken.startsWith("mie")) return "wed";
  if (normalizedToken.startsWith("jue")) return "thu";
  if (normalizedToken.startsWith("vie")) return "fri";
  if (normalizedToken.startsWith("sab")) return "sat";
  if (normalizedToken.startsWith("dom")) return "sun";
  return null;
}

function isDayInRange(target: OpeningHoursDayKey, start: OpeningHoursDayKey, end: OpeningHoursDayKey): boolean {
  const targetIndex = OPENING_DAY_INDEX[target];
  const startIndex = OPENING_DAY_INDEX[start];
  const endIndex = OPENING_DAY_INDEX[end];

  if (startIndex <= endIndex) {
    return targetIndex >= startIndex && targetIndex <= endIndex;
  }

  return targetIndex >= startIndex || targetIndex <= endIndex;
}

function lineMatchesOperationalDay(prefix: string, operationalDay: OpeningHoursDayKey): boolean {
  const rawMatches = prefix.match(/(lun(?:es)?|mar(?:tes)?|mi[eé](?:rcoles)?|jue(?:ves)?|vie(?:rnes)?|s[aá]b(?:ado)?|dom(?:ingo)?)/gi) ?? [];
  const dayTokens = rawMatches
    .map((token) => mapLegacyTokenToDay(token))
    .filter((token): token is OpeningHoursDayKey => token !== null);

  if (dayTokens.length === 0) return false;

  const normalizedPrefix = normalizeDayText(prefix);
  const hasRangeSeparator = /[-–—]|\ba\b|\bal\b/.test(normalizedPrefix);

  if (hasRangeSeparator && dayTokens.length >= 2) {
    return isDayInRange(operationalDay, dayTokens[0], dayTokens[dayTokens.length - 1]);
  }

  return dayTokens.includes(operationalDay);
}

function formatLegacyTodayBody(body: string): string | null {
  const trimmedBody = body.trim();
  if (!trimmedBody) return null;

  if (/cerrad[oa]s?/i.test(trimmedBody)) {
    return "Hoy: Cerrado";
  }

  const normalizedSegments = trimmedBody
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => formatHoursDisplay(segment) ?? segment);

  if (normalizedSegments.length === 0) {
    return null;
  }

  return `Hoy: ${normalizedSegments.join(" / ")}`;
}

function getLegacyTodayScheduleLabel(
  legacyHours: unknown,
  operationalDay: OpeningHoursDayKey | null,
): string | null {
  if (!operationalDay) return null;

  const legacyLines = normalizeLegacyHoursLines(legacyHours);
  if (legacyLines.length === 0) return null;

  for (const line of legacyLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;

    const prefix = line.slice(0, separatorIndex).trim();
    if (!lineMatchesOperationalDay(prefix, operationalDay)) continue;

    const formattedBody = formatLegacyTodayBody(line.slice(separatorIndex + 1));
    if (formattedBody) {
      return formattedBody;
    }
  }

  const explicitToday = legacyLines.find((line) => /^hoy\s*:/i.test(line));
  if (explicitToday) {
    const formattedExplicit = formatLegacyTodayBody(explicitToday.replace(/^hoy\s*:/i, ""));
    if (formattedExplicit) return formattedExplicit;
  }

  return null;
}

function isOpeningHoursV1(input: unknown): input is OpeningHoursV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const source = input as Record<string, unknown>;
  if (source.version !== 1 || source.timezone !== "America/Asuncion") return false;
  if (!source.days || typeof source.days !== "object" || Array.isArray(source.days)) return false;

  const days = source.days as Record<string, unknown>;
  return OPENING_DAY_ORDER.every((dayKey) => {
    const dayConfig = days[dayKey];
    if (!dayConfig || typeof dayConfig !== "object" || Array.isArray(dayConfig)) return false;
    const dayRecord = dayConfig as Record<string, unknown>;
    return typeof dayRecord.closed === "boolean" && Array.isArray(dayRecord.ranges);
  });
}

export function buildOpeningHoursWeekLines(openingHours: unknown): string[] {
  if (!isOpeningHoursV1(openingHours)) return [];

  return OPENING_DAY_ORDER.map((dayKey) => {
    const dayConfig = openingHours.days[dayKey];
    if (dayConfig.closed || !Array.isArray(dayConfig.ranges) || dayConfig.ranges.length === 0) {
      return `${OPENING_DAY_LABELS[dayKey]}: Cerrado`;
    }

    const formattedRanges = dayConfig.ranges
      .map((range) => formatOpeningRange(range))
      .filter((range): range is string => Boolean(range));

    if (formattedRanges.length === 0) {
      return `${OPENING_DAY_LABELS[dayKey]}: Cerrado`;
    }

    return `${OPENING_DAY_LABELS[dayKey]}: ${formattedRanges.join(" / ")}`;
  });
}

export function buildDetailHoursLines(openingHours: unknown, legacyHours: unknown): string[] {
  const openingHoursLines = buildOpeningHoursWeekLines(openingHours);
  if (openingHoursLines.length > 0) return openingHoursLines;
  return normalizeLegacyHoursLines(legacyHours);
}

function getOpeningDayKeyFromDate(date: Date): OpeningHoursDayKey | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const utcDate = new Date(Date.UTC(year, month, day));
  const dayMap: OpeningHoursDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return dayMap[utcDate.getUTCDay()] ?? null;
}

export function isOpenOnWeekdayFromOpeningHours(openingHours: unknown, date: Date): boolean | null {
  if (!isOpeningHoursV1(openingHours)) return null;

  const dayKey = getOpeningDayKeyFromDate(date);
  if (!dayKey) return null;

  const dayConfig = openingHours.days[dayKey];
  if (!dayConfig) return null;

  if (dayConfig.closed || !Array.isArray(dayConfig.ranges) || dayConfig.ranges.length === 0) {
    return false;
  }

  const hasValidRange = dayConfig.ranges.some((range) => {
    const start = normalizeHHmm(range.start);
    const end = normalizeHHmm(range.end);
    return Boolean(start && end && start !== end);
  });

  return hasValidRange;
}

export function getDetailTodayScheduleLabel(
  openingHours: unknown,
  legacyHours: unknown,
  now: Date = new Date(),
): string {
  const operationalIso = getAsuncionOperationalDayIso(now);
  const operationalDay = getDayKeyFromOperationalIso(operationalIso);

  if (isOpeningHoursV1(openingHours) && operationalDay) {
    const dayConfig = openingHours.days[operationalDay];
    if (dayConfig.closed || !Array.isArray(dayConfig.ranges) || dayConfig.ranges.length === 0) {
      return "Hoy: Cerrado";
    }

    const ranges = dayConfig.ranges
      .map((range) => formatOpeningRange(range))
      .filter((range): range is string => Boolean(range));

    if (ranges.length > 0) {
      return `Hoy: ${ranges.join(" / ")}`;
    }
    return "Hoy: Cerrado";
  }

  return getLegacyTodayScheduleLabel(legacyHours, operationalDay) ?? "Horario no disponible";
}

export function getDetailTodayScheduleLabelApiFirst(
  source: {
    is_open_today?: boolean | null;
    today_hours?: string | null;
    opening_hours?: unknown;
    hours?: unknown;
  },
  now: Date = new Date(),
): string {
  const apiTodayLabel = getTodayScheduleLabel(source);
  if (apiTodayLabel) {
    return apiTodayLabel;
  }

  return getDetailTodayScheduleLabel(source.opening_hours, source.hours, now);
}

export function getPrimaryHoursLine(hours: string[]): string {
  if (!Array.isArray(hours) || hours.length === 0) {
    return "Horario no disponible";
  }

  const firstOpenLine = hours.find((line) => !/cerrad[oa]s?/i.test(line));
  return firstOpenLine ?? hours[0] ?? "Horario no disponible";
}

/**
 * Obtiene lista de locales con información básica.
 * Útil para mostrar cards en listados.
 * 
 * @param type Filtrar por tipo (bar/club), opcional
 * @param limit Máximo de resultados (default 50)
 * @returns Lista de locales con cover_url
 */
export async function getLocalsList(
  type?: "bar" | "club",
  limit: number = 50
): Promise<LocalListItem[]> {
  try {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("limit", String(limit));

    const response = await fetch(
      `${getApiBase()}/public/locals?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error al listar locales: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Error de conexión con la API");
    }
    throw error;
  }
}

export function getTodayScheduleLabel(local: TodayScheduleSource): string | null {
  const hasIsOpenToday = Object.prototype.hasOwnProperty.call(local, "is_open_today");
  const hasTodayHours = Object.prototype.hasOwnProperty.call(local, "today_hours");

  // Old backend payloads may not expose the new fields yet.
  if (!hasIsOpenToday && !hasTodayHours) {
    return null;
  }

  if (local.is_open_today === false) {
    return "Hoy: Cerrado";
  }

  const todayHours = typeof local.today_hours === "string" ? local.today_hours.trim() : "";
  if (local.is_open_today === true && todayHours.length > 0) {
    return `Hoy: ${todayHours}`;
  }

  return "Horario no disponible";
}

export function buildTodayScheduleBySlug(locals: LocalListItem[]): Map<string, string> {
  const scheduleMap = new Map<string, string>();

  locals.forEach((local) => {
    const scheduleLabel = getTodayScheduleLabel(local);
    if (!scheduleLabel) return;

    if (local.slug) {
      scheduleMap.set(local.slug, scheduleLabel);
    }

    const normalizedSlug = slugify(local.name);
    if (normalizedSlug) {
      scheduleMap.set(normalizedSlug, scheduleLabel);
    }
  });

  return scheduleMap;
}

/**
 * Obtiene un local por su slug desde la API pública.
 * 
 * @param slug Slug del local (ej: "mckharthys-bar", "morgan")
 * @returns Información del local o null si no existe
 * @throws Error si la petición falla (excepto 404)
 */
export async function getLocalBySlug(slug: string): Promise<LocalInfo | null> {
  if (!slug || !slug.trim()) {
    throw new Error("Slug requerido");
  }

  try {
    const response = await fetch(`${getApiBase()}/public/locals/by-slug/${encodeURIComponent(slug.trim())}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      // Local no encontrado
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData?.message || `Error al obtener local: ${response.status}`);
    }

    const data = await response.json();
    return data as LocalInfo;
  } catch (error) {
    // Si es un error de red, relanzarlo
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Error de conexión con la API");
    }
    throw error;
  }
}

// ============================================================
// Catalog Types (Entradas y Mesas - solo clubs)
// ============================================================

export interface CatalogTicket {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export interface CatalogTable {
  id: string;
  name: string;
  price: number | null;
  capacity: number | null;
  includes: string | null;
}

export interface ClubCatalog {
  local_id: string;
  tickets: CatalogTicket[];
  tables: CatalogTable[];
}

/**
 * Obtiene el catálogo de entradas y mesas de un club por su slug.
 * Solo funciona para locales tipo "club".
 * 
 * @param slug Slug del club
 * @returns Catálogo con tickets y tables, o null si no hay catálogo o no es club
 */
export async function getClubCatalog(slug: string): Promise<ClubCatalog | null> {
  if (!slug || !slug.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getApiBase()}/public/locals/by-slug/${encodeURIComponent(slug.trim())}/catalog`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 404 || response.status === 400) {
      // Local no encontrado o no es club
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData?.message || `Error al obtener catálogo: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Si es un error de red, loguear y retornar null (fallback a mocks)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn("Error de conexión al obtener catálogo, usando fallback");
      return null;
    }
    console.error("Error al obtener catálogo:", error);
    return null;
  }
}
