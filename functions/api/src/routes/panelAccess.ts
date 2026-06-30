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
const ACCESS_ENTRIES_DEFAULT_LIMIT = 25;
const ACCESS_ENTRIES_MAX_LIMIT = 100;
const ACCESS_ENTRIES_INTERNAL_PAGE_SIZE = 1000;
const ACCESS_ENTRIES_ID_CHUNK_SIZE = 100;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AccessEntryStatus = (typeof ACCESS_ENTRY_STATUSES)[number];
type AccessEntryCheckinStatus = (typeof ACCESS_CHECKIN_STATUSES)[number];

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
  error: { message: string } | null;
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
