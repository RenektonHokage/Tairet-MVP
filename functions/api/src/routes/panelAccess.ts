import { NextFunction, Request, Response, Router } from "express";
import { ZodError } from "zod";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { accessCheckinTokenParamsSchema } from "../schemas/accessCheckin";
import {
  accessCheckinTokenHash,
  checkInAccessEntryByToken,
  lookupAccessCheckinByToken,
} from "../services/accessCheckin";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const panelAccessRouter = Router();

const ACCESS_ENTRY_STATUSES = ["issued", "voided"] as const;
const ACCESS_CHECKIN_STATUSES = ["unused", "used"] as const;
const ACCESS_STOCK_MODES = ["unlimited", "limited"] as const;
const ACCESS_ENTRIES_DEFAULT_LIMIT = 25;
const ACCESS_ENTRIES_MAX_LIMIT = 100;
const ACCESS_ENTRIES_INTERNAL_PAGE_SIZE = 1000;
const ACCESS_ENTRIES_ID_CHUNK_SIZE = 100;
const ACCESS_TICKET_NAME_MIN_LENGTH = 2;
const ACCESS_TICKET_NAME_MAX_LENGTH = 100;
const ACCESS_TICKET_DESCRIPTION_MAX_LENGTH = 500;
const ACCESS_STOCK_MAX_RANGE_DAYS = 31;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AccessEntryStatus = (typeof ACCESS_ENTRY_STATUSES)[number];
type AccessEntryCheckinStatus = (typeof ACCESS_CHECKIN_STATUSES)[number];
type AccessStockMode = (typeof ACCESS_STOCK_MODES)[number];

interface AccessEntriesListQuery {
  date?: string;
  entryStatus?: AccessEntryStatus;
  checkinStatus?: AccessEntryCheckinStatus;
  q?: string;
  limit: number;
  offset: number;
}

interface AccessEntryListRow {
  id: string;
  order_id: string;
  order_item_id: string;
  status: string;
  checkin_status: string;
  used_at: string | null;
  email_status: string;
  access_date: string;
  unit_index: number;
  attendee_name: string;
  attendee_last_name: string;
  created_at: string;
}

interface AccessOrderListRow {
  id: string;
  public_ref: string;
  source_type?: string;
  local_id?: string | null;
  amount_gs: number | string;
  currency: string;
  status: string;
}

interface AccessOrderItemListRow {
  id: string;
  name_snapshot: string;
}

interface AccessTicketTypeRow {
  id: string;
  source_type: string;
  local_id: string | null;
  event_id?: string | null;
  name: string;
  description: string | null;
  price_gs: number | string;
  currency: string;
  payment_kind: string;
  entries_per_unit: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface AccessTicketTypeResponse {
  id: string;
  name: string;
  description: string | null;
  price_gs: number;
  currency: string;
  payment_kind: string;
  entries_per_unit: number;
  active: boolean;
  sort_order: number;
  has_sales: boolean;
  created_at: string;
  updated_at: string;
}

interface AccessStockLimitRow {
  id: string;
  access_ticket_type_id: string;
  source_type: string;
  local_id: string | null;
  event_id?: string | null;
  access_date: string;
  stock_mode: AccessStockMode;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

interface AccessStockLimitResponse {
  id: string | null;
  access_ticket_type_id: string;
  ticket_name: string;
  access_date: string;
  stock_mode: AccessStockMode | null;
  capacity: number | null;
  sold_or_reserved_count: number;
  available_count: number | null;
  status: "unconfigured" | "configured" | "sold_out";
}

interface AccessStockReservationRow {
  access_ticket_type_id: string;
  access_date: string;
  quantity: number | string;
  status: string;
  expires_at: string;
}

interface AccessEntryResponse {
  entry_id: string;
  public_ref: string;
  ticket_name: string;
  attendee_name: string;
  unit_index: number;
  access_date: string;
  amount_gs: number;
  currency: string;
  order_status: string;
  entry_status: string;
  checkin_status: string;
  used_at: string | null;
  email_status: string;
  created_at: string;
}

interface SupabaseRowsResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface AccessStockRangeQuery {
  from: string;
  to: string;
}

type ParsedBody<T> =
  | { ok: true; value: T }
  | { ok: false; statusCode: number; code: string; error: string };

interface AccessTicketTypeCreateInput {
  name: string;
  description: string | null;
  priceGs: number;
  active: boolean;
  sortOrder?: number;
}

interface AccessTicketTypeUpdateInput {
  name?: string;
  description?: string | null;
  priceGs?: number;
  active?: boolean;
  sortOrder?: number;
}

interface AccessStockLimitUpsertInput {
  accessTicketTypeId: string;
  accessDate: string;
  stockMode: AccessStockMode;
  capacity: number | null;
}

function readSingleQueryValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePositiveIntQuery(
  value: unknown,
  fallback: number,
  max: number
): number | null {
  const rawValue = readSingleQueryValue(value);
  if (!rawValue) return fallback;
  if (!/^[0-9]+$/.test(rawValue)) return null;

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  if (parsed === 0) return fallback;

  return Math.min(parsed, max);
}

function parseOffsetQuery(value: unknown): number | null {
  const rawValue = readSingleQueryValue(value);
  if (!rawValue) return 0;
  if (!/^[0-9]+$/.test(rawValue)) return null;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseAccessEntriesListQuery(query: Request["query"]):
  | { ok: true; query: AccessEntriesListQuery }
  | { ok: false; error: string } {
  const date = readSingleQueryValue(query.date);
  if (date && !DATE_ONLY_PATTERN.test(date)) {
    return { ok: false, error: "Invalid date. Expected YYYY-MM-DD" };
  }

  const rawEntryStatus = readSingleQueryValue(query.entry_status);
  if (
    rawEntryStatus &&
    !ACCESS_ENTRY_STATUSES.includes(rawEntryStatus as AccessEntryStatus)
  ) {
    return { ok: false, error: "Invalid entry_status. Expected issued|voided" };
  }

  const rawCheckinStatus = readSingleQueryValue(query.checkin_status);
  if (
    rawCheckinStatus &&
    !ACCESS_CHECKIN_STATUSES.includes(rawCheckinStatus as AccessEntryCheckinStatus)
  ) {
    return { ok: false, error: "Invalid checkin_status. Expected unused|used" };
  }

  const q = readSingleQueryValue(query.q);
  if (q && q.length > 100) {
    return { ok: false, error: "Invalid q. Maximum length is 100" };
  }

  const limit = parsePositiveIntQuery(
    query.limit,
    ACCESS_ENTRIES_DEFAULT_LIMIT,
    ACCESS_ENTRIES_MAX_LIMIT
  );
  if (limit === null) {
    return { ok: false, error: "Invalid limit" };
  }

  const offset = parseOffsetQuery(query.offset);
  if (offset === null) {
    return { ok: false, error: "Invalid offset" };
  }

  return {
    ok: true,
    query: {
      date,
      entryStatus: rawEntryStatus as AccessEntryStatus | undefined,
      checkinStatus: rawCheckinStatus as AccessEntryCheckinStatus | undefined,
      q,
      limit,
      offset,
    },
  };
}

function escapeIlikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function toAmountGs(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseIntegerValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function parseTicketName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed.length < ACCESS_TICKET_NAME_MIN_LENGTH ||
    trimmed.length > ACCESS_TICKET_NAME_MAX_LENGTH
  ) {
    return null;
  }

  return trimmed;
}

function parseTicketDescription(value: unknown): string | null | undefined {
  const normalized = normalizeNullableText(value);
  if (normalized === undefined) return undefined;
  if (normalized !== null && normalized.length > ACCESS_TICKET_DESCRIPTION_MAX_LENGTH) {
    return undefined;
  }

  return normalized;
}

function parsePriceGs(value: unknown): number | null {
  const parsed = parseIntegerValue(value);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

function parseSortOrder(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  const parsed = parseIntegerValue(value);
  if (parsed === null || parsed < 0) return null;
  return parsed;
}

function parseAccessTicketTypeCreateBody(body: unknown): ParsedBody<AccessTicketTypeCreateInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_request",
      error: "Invalid request",
    };
  }

  const name = parseTicketName(body.name);
  if (!name) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_name",
      error: "El nombre debe tener entre 2 y 100 caracteres",
    };
  }

  const description = parseTicketDescription(body.description);
  if (description === undefined && body.description !== undefined) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_description",
      error: "La descripción no puede superar 500 caracteres",
    };
  }

  const priceGs = parsePriceGs(body.price_gs);
  if (priceGs === null) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_price_gs",
      error: "El precio debe ser un entero mayor a 0",
    };
  }

  const active = body.active === undefined ? true : parseBooleanValue(body.active);
  if (active === null) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_active",
      error: "active debe ser booleano",
    };
  }

  const sortOrder = parseSortOrder(body.sort_order);
  if (sortOrder === null) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_sort_order",
      error: "sort_order debe ser un entero mayor o igual a 0",
    };
  }

  return {
    ok: true,
    value: {
      name,
      description: description ?? null,
      priceGs,
      active,
      sortOrder,
    },
  };
}

function parseAccessTicketTypeUpdateBody(body: unknown): ParsedBody<AccessTicketTypeUpdateInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_request",
      error: "Invalid request",
    };
  }

  const value: AccessTicketTypeUpdateInput = {};

  if (body.name !== undefined) {
    const name = parseTicketName(body.name);
    if (!name) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_name",
        error: "El nombre debe tener entre 2 y 100 caracteres",
      };
    }
    value.name = name;
  }

  if (body.description !== undefined) {
    const description = parseTicketDescription(body.description);
    if (description === undefined) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_description",
        error: "La descripción no puede superar 500 caracteres",
      };
    }
    value.description = description;
  }

  if (body.price_gs !== undefined) {
    const priceGs = parsePriceGs(body.price_gs);
    if (priceGs === null) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_price_gs",
        error: "El precio debe ser un entero mayor a 0",
      };
    }
    value.priceGs = priceGs;
  }

  if (body.active !== undefined) {
    const active = parseBooleanValue(body.active);
    if (active === null) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_active",
        error: "active debe ser booleano",
      };
    }
    value.active = active;
  }

  if (body.sort_order !== undefined) {
    const sortOrder = parseSortOrder(body.sort_order);
    if (sortOrder === null || sortOrder === undefined) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_sort_order",
        error: "sort_order debe ser un entero mayor o igual a 0",
      };
    }
    value.sortOrder = sortOrder;
  }

  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      statusCode: 400,
      code: "empty_update",
      error: "No fields to update",
    };
  }

  return { ok: true, value };
}

function parseAccessStockLimitUpsertBody(body: unknown): ParsedBody<AccessStockLimitUpsertInput> {
  if (!isRecord(body)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_request",
      error: "Invalid request",
    };
  }

  const accessTicketTypeId =
    typeof body.access_ticket_type_id === "string"
      ? body.access_ticket_type_id.trim().toLowerCase()
      : "";
  if (!accessTicketTypeId || !isUuid(accessTicketTypeId)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_access_ticket_type_id",
      error: "Invalid access ticket type id",
    };
  }

  const accessDate = typeof body.access_date === "string" ? body.access_date.trim() : "";
  if (!DATE_ONLY_PATTERN.test(accessDate)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_access_date",
      error: "Invalid access_date. Expected YYYY-MM-DD",
    };
  }

  const stockMode = typeof body.stock_mode === "string" ? body.stock_mode.trim() : "";
  if (!ACCESS_STOCK_MODES.includes(stockMode as AccessStockMode)) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_stock_mode",
      error: "Invalid stock_mode. Expected unlimited|limited",
    };
  }

  let capacity: number | null = null;
  if (stockMode === "limited") {
    const parsedCapacity = parseIntegerValue(body.capacity);
    if (parsedCapacity === null || parsedCapacity <= 0) {
      return {
        ok: false,
        statusCode: 400,
        code: "invalid_capacity",
        error: "capacity debe ser un entero mayor a 0 para stock limitado",
      };
    }
    capacity = parsedCapacity;
  } else if (body.capacity !== undefined && body.capacity !== null) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_capacity",
      error: "capacity debe ser null para stock ilimitado",
    };
  }

  return {
    ok: true,
    value: {
      accessTicketTypeId,
      accessDate,
      stockMode: stockMode as AccessStockMode,
      capacity,
    },
  };
}

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateDiffInDays(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateKeys(from: string, to: string): string[] {
  const days = dateDiffInDays(from, to);
  return Array.from({ length: days + 1 }, (_value, index) => addDaysToDateKey(from, index));
}

function parseAccessStockRangeQuery(query: Request["query"]):
  | { ok: true; query: AccessStockRangeQuery }
  | { ok: false; error: string } {
  const date = readSingleQueryValue(query.date);
  const from = readSingleQueryValue(query.from);
  const to = readSingleQueryValue(query.to);

  if (date && (from || to)) {
    return { ok: false, error: "Use date or from/to, not both" };
  }

  if (date) {
    if (!DATE_ONLY_PATTERN.test(date)) {
      return { ok: false, error: "Invalid date. Expected YYYY-MM-DD" };
    }
    return { ok: true, query: { from: date, to: date } };
  }

  if ((from && !to) || (!from && to)) {
    return { ok: false, error: "from and to must be used together" };
  }

  if (from && to) {
    if (!DATE_ONLY_PATTERN.test(from) || !DATE_ONLY_PATTERN.test(to)) {
      return { ok: false, error: "Invalid range. Expected YYYY-MM-DD" };
    }

    if (from > to) {
      return { ok: false, error: "from must be before or equal to to" };
    }

    if (dateDiffInDays(from, to) + 1 > ACCESS_STOCK_MAX_RANGE_DAYS) {
      return { ok: false, error: "Date range cannot exceed 31 days" };
    }

    return { ok: true, query: { from, to } };
  }

  const today = getTodayDateKey();
  return { ok: true, query: { from: today, to: today } };
}

function combineAttendeeName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function buildAccessEntryResponse(
  entry: AccessEntryListRow,
  order: AccessOrderListRow,
  item: AccessOrderItemListRow
): AccessEntryResponse {
  return {
    entry_id: entry.id,
    public_ref: order.public_ref,
    ticket_name: item.name_snapshot,
    attendee_name: combineAttendeeName(entry.attendee_name, entry.attendee_last_name),
    unit_index: entry.unit_index,
    access_date: entry.access_date,
    amount_gs: toAmountGs(order.amount_gs),
    currency: order.currency,
    order_status: order.status,
    entry_status: entry.status,
    checkin_status: entry.checkin_status,
    used_at: entry.used_at,
    email_status: entry.email_status,
    created_at: entry.created_at,
  };
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function sortAccessEntriesForPanel(entries: AccessEntryListRow[]): AccessEntryListRow[] {
  return [...entries].sort((left, right) => {
    if (left.created_at !== right.created_at) {
      return left.created_at < right.created_at ? 1 : -1;
    }

    return left.id.localeCompare(right.id);
  });
}

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => unknown
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const result = await (buildQuery(
      offset,
      offset + ACCESS_ENTRIES_INTERNAL_PAGE_SIZE - 1
    ) as PromiseLike<SupabaseRowsResult<T>>);

    if (result.error) {
      return { rows: [], error: result.error.message };
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < ACCESS_ENTRIES_INTERNAL_PAGE_SIZE) {
      break;
    }

    offset += ACCESS_ENTRIES_INTERNAL_PAGE_SIZE;
  }

  return { rows, error: null };
}

async function fetchAllIds(
  buildQuery: (from: number, to: number) => unknown
): Promise<{ ids: string[]; error: string | null }> {
  const { rows, error } = await fetchAllRows<{ id: string }>(buildQuery);
  if (error) return { ids: [], error };

  return {
    ids: rows.map((row) => String(row.id)),
    error: null,
  };
}

async function verifyAccessLocalIsClub(
  localId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: local, error } = await supabase
    .from("locals")
    .select("id, type")
    .eq("id", localId)
    .maybeSingle();

  if (error || !local) {
    return { ok: false, error: error?.message ?? "local_not_found" };
  }

  if ((local as { type?: string }).type !== "club") {
    return { ok: false, error: "not_a_club" };
  }

  return { ok: true };
}

function buildAccessTicketTypeResponse(
  row: AccessTicketTypeRow,
  hasSales: boolean
): AccessTicketTypeResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price_gs: toAmountGs(row.price_gs),
    currency: row.currency,
    payment_kind: row.payment_kind,
    entries_per_unit: row.entries_per_unit,
    active: row.active,
    sort_order: row.sort_order,
    has_sales: hasSales,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchAccessTicketTypesForLocal(
  localId: string
): Promise<{ ticketTypes: AccessTicketTypeRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("access_ticket_types")
    .select(
      "id, source_type, local_id, event_id, name, description, price_gs, currency, payment_kind, entries_per_unit, active, sort_order, created_at, updated_at"
    )
    .eq("source_type", "local")
    .eq("local_id", localId)
    .eq("payment_kind", "paid")
    .eq("currency", "PYG")
    .order("active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("price_gs", { ascending: true });

  if (error) {
    return { ticketTypes: [], error: error.message };
  }

  return {
    ticketTypes: (data ?? []) as AccessTicketTypeRow[],
    error: null,
  };
}

async function fetchAccessTicketTypeForLocal(input: {
  localId: string;
  ticketTypeId: string;
}): Promise<{ ticketType: AccessTicketTypeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("access_ticket_types")
    .select(
      "id, source_type, local_id, event_id, name, description, price_gs, currency, payment_kind, entries_per_unit, active, sort_order, created_at, updated_at"
    )
    .eq("id", input.ticketTypeId)
    .eq("source_type", "local")
    .eq("local_id", input.localId)
    .eq("payment_kind", "paid")
    .eq("currency", "PYG")
    .maybeSingle();

  if (error) {
    return { ticketType: null, error: error.message };
  }

  return {
    ticketType: data ? (data as AccessTicketTypeRow) : null,
    error: null,
  };
}

async function fetchAccessTicketSalesMap(
  ticketTypeIds: string[]
): Promise<{ salesByTicketTypeId: Map<string, boolean>; error: string | null }> {
  const salesByTicketTypeId = new Map<string, boolean>();
  if (ticketTypeIds.length === 0) {
    return { salesByTicketTypeId, error: null };
  }

  for (const ticketTypeIdChunk of chunkValues(ticketTypeIds, ACCESS_ENTRIES_ID_CHUNK_SIZE)) {
    const result = await fetchAllRows<{ access_ticket_type_id: string }>((from, to) =>
      supabase
        .from("access_order_items")
        .select("access_ticket_type_id")
        .in("access_ticket_type_id", ticketTypeIdChunk)
        .order("access_ticket_type_id", { ascending: true })
        .range(from, to)
    );

    if (result.error) {
      return { salesByTicketTypeId, error: result.error };
    }

    for (const row of result.rows) {
      salesByTicketTypeId.set(row.access_ticket_type_id, true);
    }
  }

  return { salesByTicketTypeId, error: null };
}

async function fetchAccessTicketHasSales(ticketTypeId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("access_order_items")
    .select("id", { count: "exact", head: true })
    .eq("access_ticket_type_id", ticketTypeId);

  if (error) {
    logger.error("Failed to check Access Core ticket sales", {
      ticketTypeId,
      error: error.message,
    });
    return true;
  }

  return (count ?? 0) > 0;
}

function shouldCountStockReservation(row: AccessStockReservationRow, nowIso: string): boolean {
  if (row.status === "consumed" || row.status === "manual_hold") {
    return true;
  }

  return row.status === "reserved" && row.expires_at > nowIso;
}

function buildStockCountKey(ticketTypeId: string, accessDate: string): string {
  return `${ticketTypeId}:${accessDate}`;
}

async function fetchAccessStockBlockedCounts(input: {
  localId: string;
  ticketTypeIds: string[];
  from: string;
  to: string;
}): Promise<{ counts: Map<string, number>; error: string | null }> {
  const counts = new Map<string, number>();
  if (input.ticketTypeIds.length === 0) {
    return { counts, error: null };
  }

  const nowIso = new Date().toISOString();
  for (const ticketTypeIdChunk of chunkValues(
    input.ticketTypeIds,
    ACCESS_ENTRIES_ID_CHUNK_SIZE
  )) {
    const result = await fetchAllRows<AccessStockReservationRow>((from, to) =>
      supabase
        .from("access_stock_reservations")
        .select("access_ticket_type_id, access_date, quantity, status, expires_at")
        .eq("source_type", "local")
        .eq("local_id", input.localId)
        .gte("access_date", input.from)
        .lte("access_date", input.to)
        .in("access_ticket_type_id", ticketTypeIdChunk)
        .in("status", ["consumed", "manual_hold", "reserved"])
        .order("access_date", { ascending: true })
        .range(from, to)
    );

    if (result.error) {
      return { counts, error: result.error };
    }

    for (const row of result.rows) {
      if (!shouldCountStockReservation(row, nowIso)) continue;
      const key = buildStockCountKey(row.access_ticket_type_id, row.access_date);
      counts.set(key, (counts.get(key) ?? 0) + toAmountGs(row.quantity));
    }
  }

  return { counts, error: null };
}

async function fetchAccessStockBlockedCount(input: {
  localId: string;
  ticketTypeId: string;
  accessDate: string;
}): Promise<{ count: number; error: string | null }> {
  const result = await fetchAccessStockBlockedCounts({
    localId: input.localId,
    ticketTypeIds: [input.ticketTypeId],
    from: input.accessDate,
    to: input.accessDate,
  });

  if (result.error) {
    return { count: 0, error: result.error };
  }

  return {
    count: result.counts.get(buildStockCountKey(input.ticketTypeId, input.accessDate)) ?? 0,
    error: null,
  };
}

function buildAccessStockLimitResponse(input: {
  stockLimit: AccessStockLimitRow | null;
  ticketType: AccessTicketTypeRow;
  accessDate: string;
  soldOrReservedCount: number;
}): AccessStockLimitResponse {
  if (!input.stockLimit) {
    return {
      id: null,
      access_ticket_type_id: input.ticketType.id,
      ticket_name: input.ticketType.name,
      access_date: input.accessDate,
      stock_mode: null,
      capacity: null,
      sold_or_reserved_count: input.soldOrReservedCount,
      available_count: null,
      status: "unconfigured",
    };
  }

  const capacity =
    input.stockLimit.capacity === null ? null : Number(input.stockLimit.capacity);
  const availableCount =
    input.stockLimit.stock_mode === "limited" && capacity !== null
      ? Math.max(capacity - input.soldOrReservedCount, 0)
      : null;

  return {
    id: input.stockLimit.id,
    access_ticket_type_id: input.ticketType.id,
    ticket_name: input.ticketType.name,
    access_date: input.accessDate,
    stock_mode: input.stockLimit.stock_mode,
    capacity,
    sold_or_reserved_count: input.soldOrReservedCount,
    available_count: availableCount,
    status:
      input.stockLimit.stock_mode === "limited" && availableCount === 0
        ? "sold_out"
        : "configured",
  };
}

async function fetchEligibleAccessOrderIds(input: {
  localId: string;
  date?: string;
}): Promise<{ orderIds: string[]; error: string | null }> {
  const { ids, error } = await fetchAllIds((from, to) => {
    let query = supabase
      .from("access_orders")
      .select("id")
      .eq("source_type", "local")
      .eq("local_id", input.localId)
      .order("id", { ascending: true });

    if (input.date) {
      query = query.eq("access_date", input.date);
    }

    return query.range(from, to);
  });

  if (error) {
    return { orderIds: [], error };
  }

  return {
    orderIds: ids,
    error: null,
  };
}

async function findAccessEntryIdsBySearch(input: {
  orderIds: string[];
  searchTerm: string;
}): Promise<{ entryIds: Set<string>; error: string | null }> {
  const entryIds = new Set<string>();
  if (input.orderIds.length === 0) {
    return { entryIds, error: null };
  }

  const ilikePattern = `%${escapeIlikeTerm(input.searchTerm)}%`;

  for (const orderIdChunk of chunkValues(input.orderIds, ACCESS_ENTRIES_ID_CHUNK_SIZE)) {
    const orderMatches = await fetchAllIds((from, to) =>
      supabase
        .from("access_orders")
        .select("id")
        .in("id", orderIdChunk)
        .ilike("public_ref", ilikePattern)
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (orderMatches.error) return { entryIds, error: orderMatches.error };

    for (const matchedOrderIdChunk of chunkValues(
      orderMatches.ids,
      ACCESS_ENTRIES_ID_CHUNK_SIZE
    )) {
      const entriesByOrder = await fetchAllIds((from, to) =>
        supabase
          .from("access_entries")
          .select("id")
          .in("order_id", matchedOrderIdChunk)
          .order("id", { ascending: true })
          .range(from, to)
      );

      if (entriesByOrder.error) return { entryIds, error: entriesByOrder.error };
      for (const entryId of entriesByOrder.ids) entryIds.add(entryId);
    }

    const entrySearchFields = ["attendee_name", "attendee_last_name"] as const;
    for (const field of entrySearchFields) {
      const entriesByAttendee = await fetchAllIds((from, to) =>
        supabase
          .from("access_entries")
          .select("id")
          .in("order_id", orderIdChunk)
          .ilike(field, ilikePattern)
          .order("id", { ascending: true })
          .range(from, to)
      );

      if (entriesByAttendee.error) return { entryIds, error: entriesByAttendee.error };
      for (const entryId of entriesByAttendee.ids) entryIds.add(entryId);
    }

    const itemMatches = await fetchAllIds((from, to) =>
      supabase
        .from("access_order_items")
        .select("id")
        .in("order_id", orderIdChunk)
        .ilike("name_snapshot", ilikePattern)
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (itemMatches.error) return { entryIds, error: itemMatches.error };

    for (const matchedItemIdChunk of chunkValues(
      itemMatches.ids,
      ACCESS_ENTRIES_ID_CHUNK_SIZE
    )) {
      const entriesByItem = await fetchAllIds((from, to) =>
        supabase
          .from("access_entries")
          .select("id")
          .in("order_item_id", matchedItemIdChunk)
          .order("id", { ascending: true })
          .range(from, to)
      );

      if (entriesByItem.error) return { entryIds, error: entriesByItem.error };
      for (const entryId of entriesByItem.ids) entryIds.add(entryId);
    }
  }

  return { entryIds, error: null };
}

async function fetchAccessEntriesForList(input: {
  orderIds: string[];
  matchedEntryIds: string[] | null;
  entryStatus?: AccessEntryStatus;
  checkinStatus?: AccessEntryCheckinStatus;
}): Promise<{ entries: AccessEntryListRow[]; error: string | null }> {
  const entries: AccessEntryListRow[] = [];
  const idFilterValues = input.matchedEntryIds ?? input.orderIds;
  const idFilterColumn = input.matchedEntryIds ? "id" : "order_id";

  for (const idChunk of chunkValues(idFilterValues, ACCESS_ENTRIES_ID_CHUNK_SIZE)) {
    const result = await fetchAllRows<AccessEntryListRow>((from, to) => {
      let query = supabase
        .from("access_entries")
        .select(
          "id, order_id, order_item_id, status, checkin_status, used_at, email_status, access_date, unit_index, attendee_name, attendee_last_name, created_at"
        )
        .in(idFilterColumn, idChunk);

      if (input.entryStatus) {
        query = query.eq("status", input.entryStatus);
      }

      if (input.checkinStatus) {
        query = query.eq("checkin_status", input.checkinStatus);
      }

      return query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    });

    if (result.error) {
      return { entries: [], error: result.error };
    }

    entries.push(...result.rows);
  }

  return {
    entries: sortAccessEntriesForPanel(entries),
    error: null,
  };
}

async function fetchAccessEntryResponseContext(entry: AccessEntryListRow): Promise<
  | { ok: true; order: AccessOrderListRow; item: AccessOrderItemListRow }
  | { ok: false; error: string }
> {
  const [
    { data: orderData, error: orderError },
    { data: itemData, error: itemError },
  ] = await Promise.all([
    supabase
      .from("access_orders")
      .select("id, public_ref, source_type, local_id, amount_gs, currency, status")
      .eq("id", entry.order_id)
      .maybeSingle(),
    supabase
      .from("access_order_items")
      .select("id, name_snapshot")
      .eq("id", entry.order_item_id)
      .maybeSingle(),
  ]);

  if (orderError || !orderData) {
    return { ok: false, error: orderError?.message ?? "order_not_found" };
  }

  if (itemError || !itemData) {
    return { ok: false, error: itemError?.message ?? "order_item_not_found" };
  }

  return {
    ok: true,
    order: orderData as AccessOrderListRow,
    item: itemData as AccessOrderItemListRow,
  };
}

function sendAccessEntryUseConflict(
  res: Response,
  statusCode: number,
  code: string,
  message: string
) {
  return res.status(statusCode).json({
    error: message,
    code,
  });
}

function sanitizeCheckinUrlValue(value: string | undefined, token: string): string | undefined {
  if (!value || token.length === 0) return value;

  const encodedToken = encodeURIComponent(token);
  let sanitized = value.split(token).join(":token");
  if (encodedToken !== token) {
    sanitized = sanitized.split(encodedToken).join(":token");
  }

  return sanitized;
}

function sanitizeAccessCheckinRequestUrl(req: Request, _res: unknown, next: NextFunction) {
  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (token.length > 0) {
    req.originalUrl = sanitizeCheckinUrlValue(req.originalUrl, token) ?? req.originalUrl;
    req.url = sanitizeCheckinUrlValue(req.url, token) ?? req.url;
  }

  next();
}

panelAccessRouter.get(
  "/ticket-types",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const clubCheck = await verifyAccessLocalIsClub(req.panelUser.localId);
      if (!clubCheck.ok) {
        return res.status(403).json({
          error: "Solo discotecas pueden gestionar entradas pagas",
          code: clubCheck.error === "not_a_club" ? "not_a_club" : "local_not_found",
        });
      }

      const { ticketTypes, error } = await fetchAccessTicketTypesForLocal(
        req.panelUser.localId
      );
      if (error) {
        logger.error("Failed to fetch Access Core ticket types", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error,
        });
        return res.status(500).json({
          error: "Failed to fetch access ticket types",
          code: "access_ticket_types_fetch_failed",
        });
      }

      const salesMap = await fetchAccessTicketSalesMap(
        ticketTypes.map((ticketType) => ticketType.id)
      );
      if (salesMap.error) {
        logger.error("Failed to fetch Access Core ticket sales map", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: salesMap.error,
        });
        return res.status(500).json({
          error: "Failed to fetch access ticket types",
          code: "access_ticket_types_fetch_failed",
        });
      }

      return res.status(200).json({
        ok: true,
        ticketTypes: ticketTypes.map((ticketType) =>
          buildAccessTicketTypeResponse(
            ticketType,
            Boolean(salesMap.salesByTicketTypeId.get(ticketType.id))
          )
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.post(
  "/ticket-types",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const clubCheck = await verifyAccessLocalIsClub(req.panelUser.localId);
      if (!clubCheck.ok) {
        return res.status(403).json({
          error: "Solo discotecas pueden gestionar entradas pagas",
          code: clubCheck.error === "not_a_club" ? "not_a_club" : "local_not_found",
        });
      }

      const parsedBody = parseAccessTicketTypeCreateBody(req.body);
      if (!parsedBody.ok) {
        return res.status(parsedBody.statusCode).json({
          error: parsedBody.error,
          code: parsedBody.code,
        });
      }

      const input = parsedBody.value;
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const { data: maxOrder, error: maxOrderError } = await supabase
          .from("access_ticket_types")
          .select("sort_order")
          .eq("source_type", "local")
          .eq("local_id", req.panelUser.localId)
          .eq("payment_kind", "paid")
          .eq("currency", "PYG")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxOrderError) {
          logger.error("Failed to fetch next Access Core ticket sort order", {
            localId: req.panelUser.localId,
            role: req.panelUser.role,
            error: maxOrderError.message,
          });
          return res.status(500).json({
            error: "Failed to create access ticket type",
            code: "access_ticket_type_create_failed",
          });
        }

        sortOrder = Number((maxOrder as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
      }

      const { data, error } = await supabase
        .from("access_ticket_types")
        .insert({
          source_type: "local",
          local_id: req.panelUser.localId,
          event_id: null,
          name: input.name,
          description: input.description,
          price_gs: input.priceGs,
          currency: "PYG",
          payment_kind: "paid",
          entries_per_unit: 1,
          active: input.active,
          sort_order: sortOrder,
        })
        .select(
          "id, source_type, local_id, event_id, name, description, price_gs, currency, payment_kind, entries_per_unit, active, sort_order, created_at, updated_at"
        )
        .single();

      if (error) {
        const statusCode = error.code === "23505" ? 409 : 500;
        logger.error("Failed to create Access Core ticket type", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: error.message,
          code: error.code,
        });
        return res.status(statusCode).json({
          error:
            statusCode === 409
              ? "Ya existe una entrada activa con ese nombre"
              : "Failed to create access ticket type",
          code:
            statusCode === 409
              ? "access_ticket_type_duplicate_name"
              : "access_ticket_type_create_failed",
        });
      }

      return res.status(201).json({
        ok: true,
        ticketType: buildAccessTicketTypeResponse(data as AccessTicketTypeRow, false),
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.patch(
  "/ticket-types/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const ticketTypeId =
        typeof req.params.id === "string" ? req.params.id.trim().toLowerCase() : "";
      if (!ticketTypeId || !isUuid(ticketTypeId)) {
        return res.status(400).json({
          error: "Invalid access ticket type id",
          code: "invalid_access_ticket_type_id",
        });
      }

      const clubCheck = await verifyAccessLocalIsClub(req.panelUser.localId);
      if (!clubCheck.ok) {
        return res.status(403).json({
          error: "Solo discotecas pueden gestionar entradas pagas",
          code: clubCheck.error === "not_a_club" ? "not_a_club" : "local_not_found",
        });
      }

      const { ticketType, error: ticketTypeError } = await fetchAccessTicketTypeForLocal({
        localId: req.panelUser.localId,
        ticketTypeId,
      });

      if (ticketTypeError) {
        logger.error("Failed to fetch Access Core ticket type for update", {
          ticketTypeId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: ticketTypeError,
        });
        return res.status(500).json({
          error: "Failed to update access ticket type",
          code: "access_ticket_type_update_failed",
        });
      }

      if (!ticketType) {
        return res.status(404).json({
          error: "Access ticket type not found",
          code: "access_ticket_type_not_found",
        });
      }

      const parsedBody = parseAccessTicketTypeUpdateBody(req.body);
      if (!parsedBody.ok) {
        return res.status(parsedBody.statusCode).json({
          error: parsedBody.error,
          code: parsedBody.code,
        });
      }

      const input = parsedBody.value;
      const wantsProtectedChange =
        input.name !== undefined || input.priceGs !== undefined;
      const hasSales = await fetchAccessTicketHasSales(ticketType.id);
      if (wantsProtectedChange && hasSales) {
        return res.status(409).json({
          error:
            "Esta entrada ya tiene ventas. Para cambiar nombre o precio, desactivá esta entrada y creá una nueva.",
          code: "ticket_type_has_sales",
        });
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.priceGs !== undefined) updateData.price_gs = input.priceGs;
      if (input.active !== undefined) updateData.active = input.active;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;

      const { data, error } = await supabase
        .from("access_ticket_types")
        .update(updateData)
        .eq("id", ticketType.id)
        .eq("source_type", "local")
        .eq("local_id", req.panelUser.localId)
        .eq("payment_kind", "paid")
        .eq("currency", "PYG")
        .select(
          "id, source_type, local_id, event_id, name, description, price_gs, currency, payment_kind, entries_per_unit, active, sort_order, created_at, updated_at"
        )
        .single();

      if (error) {
        const statusCode = error.code === "23505" ? 409 : 500;
        logger.error("Failed to update Access Core ticket type", {
          ticketTypeId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: error.message,
          code: error.code,
        });
        return res.status(statusCode).json({
          error:
            statusCode === 409
              ? "Ya existe una entrada activa con ese nombre"
              : "Failed to update access ticket type",
          code:
            statusCode === 409
              ? "access_ticket_type_duplicate_name"
              : "access_ticket_type_update_failed",
        });
      }

      return res.status(200).json({
        ok: true,
        ticketType: buildAccessTicketTypeResponse(
          data as AccessTicketTypeRow,
          hasSales
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.get(
  "/stock-limits",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const clubCheck = await verifyAccessLocalIsClub(req.panelUser.localId);
      if (!clubCheck.ok) {
        return res.status(403).json({
          error: "Solo discotecas pueden gestionar stock de entradas pagas",
          code: clubCheck.error === "not_a_club" ? "not_a_club" : "local_not_found",
        });
      }

      const parsedQuery = parseAccessStockRangeQuery(req.query);
      if (!parsedQuery.ok) {
        return res.status(400).json({
          error: parsedQuery.error,
          code: "invalid_query",
        });
      }

      const { ticketTypes, error: ticketTypesError } = await fetchAccessTicketTypesForLocal(
        req.panelUser.localId
      );
      if (ticketTypesError) {
        logger.error("Failed to fetch Access Core ticket types for stock", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: ticketTypesError,
        });
        return res.status(500).json({
          error: "Failed to fetch access stock limits",
          code: "access_stock_limits_fetch_failed",
        });
      }

      if (ticketTypes.length === 0) {
        return res.status(200).json({
          ok: true,
          stockLimits: [],
          dateRange: parsedQuery.query,
        });
      }

      const localId = req.panelUser.localId;
      const ticketTypesById = indexById(ticketTypes);
      const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id);
      const [{ counts, error: countsError }, stockLimitsResult] = await Promise.all([
        fetchAccessStockBlockedCounts({
          localId,
          ticketTypeIds,
          from: parsedQuery.query.from,
          to: parsedQuery.query.to,
        }),
        fetchAllRows<AccessStockLimitRow>((from, to) =>
          supabase
            .from("access_stock_limits")
            .select(
              "id, access_ticket_type_id, source_type, local_id, event_id, access_date, stock_mode, capacity, created_at, updated_at"
            )
            .eq("source_type", "local")
            .eq("local_id", localId)
            .gte("access_date", parsedQuery.query.from)
            .lte("access_date", parsedQuery.query.to)
            .in("access_ticket_type_id", ticketTypeIds)
            .order("access_date", { ascending: true })
            .range(from, to)
        ),
      ]);

      if (countsError || stockLimitsResult.error) {
        logger.error("Failed to fetch Access Core stock context", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          countsError,
          stockLimitsError: stockLimitsResult.error,
        });
        return res.status(500).json({
          error: "Failed to fetch access stock limits",
          code: "access_stock_limits_fetch_failed",
        });
      }

      const stockLimitsByTicketDate = new Map<string, AccessStockLimitRow>();
      for (const stockLimit of stockLimitsResult.rows) {
        stockLimitsByTicketDate.set(
          buildStockCountKey(stockLimit.access_ticket_type_id, stockLimit.access_date),
          stockLimit
        );
      }

      const stockLimits: AccessStockLimitResponse[] = [];
      for (const accessDate of buildDateKeys(parsedQuery.query.from, parsedQuery.query.to)) {
        for (const ticketType of ticketTypes) {
          const key = buildStockCountKey(ticketType.id, accessDate);
          const stockLimit = stockLimitsByTicketDate.get(key) ?? null;
          const soldOrReservedCount = counts.get(key) ?? 0;
          const ticketTypeContext = ticketTypesById.get(ticketType.id);
          if (!ticketTypeContext) continue;

          stockLimits.push(
            buildAccessStockLimitResponse({
              stockLimit,
              ticketType: ticketTypeContext,
              accessDate,
              soldOrReservedCount,
            })
          );
        }
      }

      return res.status(200).json({
        ok: true,
        stockLimits,
        dateRange: parsedQuery.query,
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.put(
  "/stock-limits",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const clubCheck = await verifyAccessLocalIsClub(req.panelUser.localId);
      if (!clubCheck.ok) {
        return res.status(403).json({
          error: "Solo discotecas pueden gestionar stock de entradas pagas",
          code: clubCheck.error === "not_a_club" ? "not_a_club" : "local_not_found",
        });
      }

      const parsedBody = parseAccessStockLimitUpsertBody(req.body);
      if (!parsedBody.ok) {
        return res.status(parsedBody.statusCode).json({
          error: parsedBody.error,
          code: parsedBody.code,
        });
      }

      const input = parsedBody.value;
      const { ticketType, error: ticketTypeError } = await fetchAccessTicketTypeForLocal({
        localId: req.panelUser.localId,
        ticketTypeId: input.accessTicketTypeId,
      });

      if (ticketTypeError) {
        logger.error("Failed to fetch Access Core ticket type for stock upsert", {
          ticketTypeId: input.accessTicketTypeId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: ticketTypeError,
        });
        return res.status(500).json({
          error: "Failed to save access stock limit",
          code: "access_stock_limit_save_failed",
        });
      }

      if (!ticketType) {
        return res.status(404).json({
          error: "Access ticket type not found",
          code: "access_ticket_type_not_found",
        });
      }

      const { count: blockedCount, error: blockedCountError } =
        await fetchAccessStockBlockedCount({
          localId: req.panelUser.localId,
          ticketTypeId: ticketType.id,
          accessDate: input.accessDate,
        });

      if (blockedCountError) {
        logger.error("Failed to fetch Access Core blocked stock count", {
          ticketTypeId: ticketType.id,
          accessDate: input.accessDate,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: blockedCountError,
        });
        return res.status(500).json({
          error: "Failed to save access stock limit",
          code: "access_stock_limit_save_failed",
        });
      }

      if (input.stockMode === "limited" && input.capacity !== null) {
        if (input.capacity < blockedCount) {
          return res.status(409).json({
            error: "La capacidad no puede ser menor a las reservas o ventas existentes",
            code: "capacity_below_reserved",
          });
        }
      }

      const { data, error } = await supabase
        .from("access_stock_limits")
        .upsert(
          {
            access_ticket_type_id: ticketType.id,
            source_type: "local",
            local_id: req.panelUser.localId,
            event_id: null,
            access_date: input.accessDate,
            stock_mode: input.stockMode,
            capacity: input.capacity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "access_ticket_type_id,access_date" }
        )
        .select(
          "id, access_ticket_type_id, source_type, local_id, event_id, access_date, stock_mode, capacity, created_at, updated_at"
        )
        .single();

      if (error) {
        logger.error("Failed to save Access Core stock limit", {
          ticketTypeId: ticketType.id,
          accessDate: input.accessDate,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: error.message,
          code: error.code,
        });
        return res.status(500).json({
          error: "Failed to save access stock limit",
          code: "access_stock_limit_save_failed",
        });
      }

      return res.status(200).json({
        ok: true,
        stockLimit: buildAccessStockLimitResponse({
          stockLimit: data as AccessStockLimitRow,
          ticketType,
          accessDate: input.accessDate,
          soldOrReservedCount: blockedCount,
        }),
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.get(
  "/entries",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsedQuery = parseAccessEntriesListQuery(req.query);
      if (!parsedQuery.ok) {
        return res.status(400).json({
          error: parsedQuery.error,
          code: "invalid_query",
        });
      }

      const query = parsedQuery.query;
      const { orderIds, error: orderIdsError } = await fetchEligibleAccessOrderIds({
        localId: req.panelUser.localId,
        date: query.date,
      });

      if (orderIdsError) {
        logger.error("Failed to fetch Access Core panel order ids", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: orderIdsError,
        });
        return res.status(500).json({
          error: "Failed to fetch access entries",
          code: "access_entries_fetch_failed",
        });
      }

      if (orderIds.length === 0) {
        return res.status(200).json({
          ok: true,
          entries: [],
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total: 0,
            hasMore: false,
          },
        });
      }

      let matchedEntryIds: string[] | null = null;
      if (query.q) {
        const searchResult = await findAccessEntryIdsBySearch({
          orderIds,
          searchTerm: query.q,
        });

        if (searchResult.error) {
          logger.error("Failed to search Access Core panel entries", {
            localId: req.panelUser.localId,
            role: req.panelUser.role,
            error: searchResult.error,
          });
          return res.status(500).json({
            error: "Failed to fetch access entries",
            code: "access_entries_fetch_failed",
          });
        }

        matchedEntryIds = Array.from(searchResult.entryIds);
        if (matchedEntryIds.length === 0) {
          return res.status(200).json({
            ok: true,
            entries: [],
            pagination: {
              limit: query.limit,
              offset: query.offset,
              total: 0,
              hasMore: false,
            },
          });
        }
      }

      const entriesResult = await fetchAccessEntriesForList({
        orderIds,
        matchedEntryIds,
        entryStatus: query.entryStatus,
        checkinStatus: query.checkinStatus,
      });

      if (entriesResult.error) {
        logger.error("Failed to fetch Access Core panel entries", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: entriesResult.error,
        });
        return res.status(500).json({
          error: "Failed to fetch access entries",
          code: "access_entries_fetch_failed",
        });
      }

      const total = entriesResult.entries.length;
      const entries = entriesResult.entries.slice(query.offset, query.offset + query.limit);
      if (entries.length === 0) {
        return res.status(200).json({
          ok: true,
          entries: [],
          pagination: {
            limit: query.limit,
            offset: query.offset,
            total,
            hasMore: false,
          },
        });
      }

      const pageOrderIds = Array.from(new Set(entries.map((entry) => entry.order_id)));
      const pageItemIds = Array.from(new Set(entries.map((entry) => entry.order_item_id)));
      const [
        { data: orderData, error: ordersError },
        { data: itemData, error: itemsError },
      ] = await Promise.all([
        supabase
          .from("access_orders")
          .select("id, public_ref, source_type, local_id, amount_gs, currency, status")
          .eq("source_type", "local")
          .eq("local_id", req.panelUser.localId)
          .in("id", pageOrderIds),
        supabase
          .from("access_order_items")
          .select("id, name_snapshot")
          .in("id", pageItemIds),
      ]);

      if (ordersError || itemsError) {
        logger.error("Failed to fetch Access Core panel entry context", {
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          ordersError: ordersError?.message,
          itemsError: itemsError?.message,
        });
        return res.status(500).json({
          error: "Failed to fetch access entries",
          code: "access_entries_fetch_failed",
        });
      }

      const ordersById = indexById((orderData ?? []) as AccessOrderListRow[]);
      const itemsById = indexById((itemData ?? []) as AccessOrderItemListRow[]);
      const responseEntries: AccessEntryResponse[] = [];

      for (const entry of entries) {
        const order = ordersById.get(entry.order_id);
        const item = itemsById.get(entry.order_item_id);
        if (!order || !item) {
          logger.error("Access Core panel entry context missing", {
            entryId: entry.id,
            localId: req.panelUser.localId,
            role: req.panelUser.role,
            missingOrder: !order,
            missingItem: !item,
          });
          return res.status(500).json({
            error: "Failed to fetch access entries",
            code: "access_entries_fetch_failed",
          });
        }

        responseEntries.push(buildAccessEntryResponse(entry, order, item));
      }

      return res.status(200).json({
        ok: true,
        entries: responseEntries,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total,
          hasMore: query.offset + responseEntries.length < total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.post(
  "/entries/:entryId/use",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const entryId =
        typeof req.params.entryId === "string"
          ? req.params.entryId.trim().toLowerCase()
          : "";

      if (!entryId || !isUuid(entryId)) {
        return res.status(400).json({
          error: "Invalid access entry id",
          code: "invalid_entry_id",
        });
      }

      const entrySelect =
        "id, order_id, order_item_id, status, checkin_status, used_at, used_by, email_status, access_date, unit_index, attendee_name, attendee_last_name, created_at";
      const { data: entryData, error: entryError } = await supabase
        .from("access_entries")
        .select(entrySelect)
        .eq("id", entryId)
        .maybeSingle();

      if (entryError) {
        logger.error("Failed to fetch Access Core entry for manual use", {
          entryId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: entryError.message,
        });
        return res.status(500).json({
          error: "Failed to use access entry",
          code: "access_entry_use_failed",
        });
      }

      const entry = entryData as (AccessEntryListRow & { used_by?: string | null }) | null;
      if (!entry) {
        return res.status(404).json({
          error: "Access entry not found",
          code: "entry_not_found",
        });
      }

      const context = await fetchAccessEntryResponseContext(entry);
      if (!context.ok) {
        logger.error("Failed to fetch Access Core entry context for manual use", {
          entryId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: context.error,
        });
        return res.status(500).json({
          error: "Failed to use access entry",
          code: "access_entry_use_failed",
        });
      }

      const { order, item } = context;
      const logManualUseRejected = (result: string) => {
        logger.warn("Access Core manual use rejected", {
          entryId,
          publicRef: order.public_ref,
          localId: req.panelUser?.localId,
          role: req.panelUser?.role,
          result,
        });
      };

      if (order.source_type !== "local" || order.local_id !== req.panelUser.localId) {
        logger.warn("Access Core manual use rejected by tenant isolation", {
          entryId,
          publicRef: order.public_ref,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          result: "entry_not_found",
        });
        return res.status(404).json({
          error: "Access entry not found",
          code: "entry_not_found",
        });
      }

      if (entry.status === "voided") {
        logManualUseRejected("voided");
        return sendAccessEntryUseConflict(res, 409, "voided", "Access entry is voided");
      }

      if (order.status !== "paid") {
        logManualUseRejected("not_paid");
        return sendAccessEntryUseConflict(res, 409, "not_paid", "Access order is not paid");
      }

      if (entry.status !== "issued") {
        logManualUseRejected("not_valid_status");
        return sendAccessEntryUseConflict(
          res,
          409,
          "not_valid_status",
          "Access entry is not valid for use"
        );
      }

      if (entry.checkin_status === "used") {
        logManualUseRejected("already_used");
        return sendAccessEntryUseConflict(res, 409, "already_used", "Access entry already used");
      }

      if (entry.checkin_status !== "unused" || entry.used_at || entry.used_by) {
        logManualUseRejected("not_valid_status");
        return sendAccessEntryUseConflict(
          res,
          409,
          "not_valid_status",
          "Access entry is not valid for use"
        );
      }

      const usedAt = new Date().toISOString();
      const { data: updatedData, error: updateError } = await supabase
        .from("access_entries")
        .update({
          checkin_status: "used",
          used_at: usedAt,
          used_by: req.panelUser.userId,
        })
        .eq("id", entry.id)
        .eq("status", "issued")
        .eq("checkin_status", "unused")
        .is("used_at", null)
        .is("used_by", null)
        .select(entrySelect)
        .maybeSingle();

      if (updateError) {
        logger.error("Failed to mark Access Core entry as used manually", {
          entryId,
          publicRef: order.public_ref,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
          error: updateError.message,
        });
        return res.status(500).json({
          error: "Failed to use access entry",
          code: "access_entry_use_failed",
        });
      }

      if (!updatedData) {
        const { data: latestData, error: latestError } = await supabase
          .from("access_entries")
          .select(entrySelect)
          .eq("id", entry.id)
          .maybeSingle();

        if (latestError || !latestData) {
          logger.error("Failed to refetch Access Core entry after manual use miss", {
            entryId,
            publicRef: order.public_ref,
            localId: req.panelUser.localId,
            role: req.panelUser.role,
            error: latestError?.message,
          });
          return res.status(500).json({
            error: "Failed to use access entry",
            code: "access_entry_use_failed",
          });
        }

        const latestEntry = latestData as AccessEntryListRow & { used_by?: string | null };
        if (latestEntry.status === "issued" && latestEntry.checkin_status === "used") {
          logManualUseRejected("already_used");
          return sendAccessEntryUseConflict(
            res,
            409,
            "already_used",
            "Access entry already used"
          );
        }

        if (latestEntry.status === "voided") {
          logManualUseRejected("voided");
          return sendAccessEntryUseConflict(res, 409, "voided", "Access entry is voided");
        }

        logManualUseRejected("not_valid_status");
        return sendAccessEntryUseConflict(
          res,
          409,
          "not_valid_status",
          "Access entry is not valid for use"
        );
      }

      const updatedEntry = updatedData as AccessEntryListRow;
      logger.info("Access Core entry manually used", {
        entryId,
        publicRef: order.public_ref,
        localId: req.panelUser.localId,
        role: req.panelUser.role,
        result: "used",
      });

      return res.status(200).json({
        ok: true,
        entry: buildAccessEntryResponse(updatedEntry, order, item),
      });
    } catch (error) {
      next(error);
    }
  }
);

panelAccessRouter.get(
  "/checkin/:token",
  sanitizeAccessCheckinRequestUrl,
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsedParams = accessCheckinTokenParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        const rawToken = typeof req.params.token === "string" ? req.params.token.trim() : "";
        logger.warn("Invalid access check-in token", {
          tokenHash: rawToken.length > 0 ? accessCheckinTokenHash(rawToken) : undefined,
          panelUserId: req.panelUser.userId,
          role: req.panelUser.role,
          errorCode: "invalid_checkin_token",
        });

        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const result = await lookupAccessCheckinByToken({
        token: parsedParams.data.token,
        panelUser: {
          userId: req.panelUser.userId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
        },
      });

      if (!result.ok) {
        logger.warn("Access check-in lookup rejected", { ...result.logContext });
        return res.status(result.statusCode).json({
          error: result.error.message,
          code: result.error.code,
        });
      }

      logger.info("Access check-in lookup successful", {
        ...result.logContext,
        status: result.status,
        checkinStatus: result.entry.checkin_status,
      });

      return res.status(200).json({
        ok: true,
        status: result.status,
        entry: result.entry,
        attendee: result.attendee,
        order: result.order,
        warnings: result.warnings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      next(error);
    }
  }
);

panelAccessRouter.post(
  "/checkin/:token/use",
  sanitizeAccessCheckinRequestUrl,
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsedParams = accessCheckinTokenParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        const rawToken = typeof req.params.token === "string" ? req.params.token.trim() : "";
        logger.warn("Invalid access check-in token use request", {
          tokenHash: rawToken.length > 0 ? accessCheckinTokenHash(rawToken) : undefined,
          panelUserId: req.panelUser.userId,
          role: req.panelUser.role,
          errorCode: "invalid_checkin_token",
        });

        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const result = await checkInAccessEntryByToken({
        token: parsedParams.data.token,
        panelUser: {
          userId: req.panelUser.userId,
          localId: req.panelUser.localId,
          role: req.panelUser.role,
        },
      });

      if (!result.ok) {
        const logPayload = { ...result.logContext };
        if (result.statusCode >= 500) {
          logger.error("Access check-in use failed", logPayload);
        } else {
          logger.warn("Access check-in use rejected", logPayload);
        }

        return res.status(result.statusCode).json({
          error: result.error.message,
          code: result.error.code,
        });
      }

      logger.info("Access check-in use completed", {
        ...result.logContext,
        status: result.status,
        checkinStatus: result.entry.checkin_status,
      });

      return res.status(200).json({
        ok: true,
        status: result.status,
        entry: result.entry,
        attendee: result.attendee,
        order: result.order,
        warnings: result.warnings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      next(error);
    }
  }
);
