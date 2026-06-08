import { NextFunction, Request, Response, Router } from "express";
import { eventPanelAuth } from "../middlewares/eventPanelAuth";
import { requireEventRole } from "../middlewares/requireEventRole";
import { eventEntriesReadQuerySchema } from "../schemas/eventEntriesRead";
import { eventManualIssueSchema } from "../schemas/eventManualIssue";
import { getRequestId } from "../middlewares/requestId";
import { sendEventEntryQrEmail, sendEventOrderQrBundleEmail } from "../services/eventEmails";
import { generateEventEntryQrPng } from "../services/eventQr";
import { recordEventActivity } from "../services/eventActivity";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const panelEventsRouter = Router({ mergeParams: true });

type EventTicketTypeRow = {
  id: string;
  name: string;
  description: string | null;
  price_amount: number | string | null;
  currency: string;
  stock: number | null;
  active: boolean;
  sort_order: number | null;
  sales_unit_type: "single_entry" | "package" | string;
  entries_per_unit: number | null;
};

type EventOrderItemMetricRow = {
  event_ticket_type_id: string;
  quantity: number | null;
  total_amount: number | string | null;
};

type EventOrderEntryMetricRow = {
  event_ticket_type_id: string;
};

type EventEntryQrRow = {
  id: string;
  event_id: string;
  status: string;
  checkin_token: string;
};

type EventEntryEmailRow = EventEntryQrRow & {
  event_order_id: string;
  event_order_item_id: string;
  event_ticket_type_id: string;
  attendee_name: string;
  attendee_last_name: string;
  attendee_email: string;
};

type EventOrderBundleEmailEntryRow = EventEntryQrRow & {
  event_order_item_id: string;
  attendee_name: string;
  attendee_last_name: string;
};

type EventEntryEmailEventRow = {
  title: string;
  starts_at: string | null;
  timezone: string | null;
  location_name: string | null;
};

type EventEntryEmailItemRow = {
  ticket_name: string;
  sales_unit_type: string;
};

type EventEntryReadRelatedItem = {
  id: string;
  ticket_name: string;
  sales_unit_type: string;
  quantity: number | null;
  entries_per_unit: number | null;
  total_amount: number | string | null;
};

type EventEntryReadRelatedOrder = {
  id: string;
  total_amount: number | string | null;
  currency: string;
  source: string;
  payment_method: string;
  payment_status: string;
  buyer_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_document: string;
  created_at: string;
};

type EventEntryReadRow = {
  id: string;
  event_order_id: string;
  event_order_item_id: string;
  event_ticket_type_id: string;
  unit_price_amount: number | string | null;
  currency: string;
  attendee_name: string;
  attendee_last_name: string;
  attendee_email: string;
  attendee_phone: string;
  attendee_document: string;
  status: string;
  checkin_status: string;
  used_at: string | null;
  created_at: string;
  event_order_item: EventEntryReadRelatedItem | EventEntryReadRelatedItem[] | null;
  event_order: EventEntryReadRelatedOrder | EventEntryReadRelatedOrder[] | null;
};

type EventEntryEmailDeliveryStatus = "sent" | "failed" | "skipped";
type EventEntryEmailDeliveryErrorCode =
  | "entry_not_found"
  | "entry_not_issuable"
  | "attendee_email_unavailable"
  | "event_entry_email_failed"
  | "email_context_failed"
  | "email_send_failed"
  | "email_update_failed"
  | "buyer_email_unavailable"
  | "too_many_entries_for_order_bundle_email"
  | "email_sent_but_update_failed"
  | "email_sent_but_partial_update_failed";

type EventEntryEmailDeliveryResult = {
  entry_id: string;
  to?: string | null;
  status: EventEntryEmailDeliveryStatus;
  email_sent_at: string | null;
  error_code: EventEntryEmailDeliveryErrorCode | null;
  event_order_id?: string | null;
  event_order_item_id?: string | null;
  event_ticket_type_id?: string | null;
  ticket_name?: string | null;
};

type EventAutomaticEmailDeliverySummary = {
  mode: "order_bundle";
  email_attempts: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  status: "sent" | "partial_failed" | "failed" | "skipped";
  reason: "no_entries" | "too_many_entries_for_order_bundle_email" | "buyer_email_unavailable" | null;
  results: EventEntryEmailDeliveryResult[];
};

type ManualIssueRpcResult =
  | {
      ok: true;
      data: {
        order: Record<string, unknown>;
        items: Array<Record<string, unknown>>;
        entries: Array<Record<string, unknown>>;
      };
    }
  | {
      ok: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

type EventCheckinSemanticStatus =
  | "valid"
  | "already_used"
  | "invalid"
  | "outside_window"
  | "voided"
  | "not_valid_status"
  | "event_not_operable";

type EventCheckinRpcResult =
  | {
      ok: true;
      status: EventCheckinSemanticStatus;
      entry: Record<string, unknown> | null;
      attendee: Record<string, unknown> | null;
      event: Record<string, unknown> | null;
    }
  | {
      ok: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

const AUTOMATIC_EMAIL_MAX_ENTRIES = 20;
const EVENT_ACTIVITY_MAX_CONCURRENCY = 3;
const MANUAL_ISSUE_RPC_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  invalid_buyer: 400,
  invalid_items: 400,
  invalid_quantity: 400,
  invalid_attendees_count: 400,
  invalid_attendee: 400,
  forbidden: 403,
  event_not_found: 404,
  ticket_type_not_found: 404,
  event_not_operable: 409,
  insufficient_stock: 409,
  non_divisible_package_price: 409,
  manual_issue_failed: 500,
};
const EVENT_CHECKIN_RPC_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  forbidden: 403,
  event_not_found: 404,
  checkin_failed: 500,
};
const EVENT_MANUAL_CHECKIN_RPC_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  forbidden: 403,
  event_not_found: 404,
  entry_not_found: 404,
  manual_checkin_failed: 500,
};
const EVENT_CHECKIN_SENSITIVE_RESPONSE_KEYS = new Set([
  "token",
  "checkin_token",
  "checkintoken",
  "checkinToken",
  "qr",
  "qr_payload",
  "qrpayload",
  "qr_base64",
  "qrbase64",
  "qr_raw",
  "qrraw",
  "raw_qr",
  "rawqr",
  "email",
  "phone",
  "buyer_email",
  "buyeremail",
  "buyer_phone",
  "buyerphone",
  "buyer_document",
  "buyerdocument",
  "used_by_auth_user_id",
  "usedbyauthuserid",
  "created_by_auth_user_id",
  "createdbyauthuserid",
  "auth_user_id",
  "authuserid",
  "local_id",
  "localid",
  "metadata",
]);
const EVENT_CHECKIN_FORBIDDEN_INPUT_KEYS = new Set([
  "event_id",
  "eventId",
  "p_event_id",
  "local_id",
  "localId",
  "p_local_id",
  "auth_user_id",
  "authUserId",
  "p_actor_auth_user_id",
  "actor",
  "actor_auth_user_id",
  "actorAuthUserId",
  "entry",
  "entry_id",
  "entryId",
  "p_entry_id",
  "attendee",
  "attendee_name",
  "attendeeName",
  "attendee_last_name",
  "attendeeLastName",
  "attendee_email",
  "attendeeEmail",
  "attendee_phone",
  "attendeePhone",
  "attendee_document",
  "attendeeDocument",
  "buyer",
  "buyer_name",
  "buyerName",
  "buyer_last_name",
  "buyerLastName",
  "buyer_email",
  "buyerEmail",
  "buyer_phone",
  "buyerPhone",
  "buyer_document",
  "buyerDocument",
  "ticket",
  "ticket_name",
  "ticketName",
  "ticket_type_id",
  "ticketTypeId",
  "status",
  "checkin_status",
  "checkinStatus",
  "used_at",
  "usedAt",
  "used_by_auth_user_id",
  "usedByAuthUserId",
  "metadata",
  "token",
  "p_token",
  "checkin_token",
  "checkinToken",
  "p_checkin_token",
  "qr_payload",
  "qrPayload",
  "qr_base64",
  "qrBase64",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EVENT_ENTRY_SELECT = `
  id,
  event_order_id,
  event_order_item_id,
  event_ticket_type_id,
  unit_price_amount,
  currency,
  attendee_name,
  attendee_last_name,
  attendee_email,
  attendee_phone,
  attendee_document,
  status,
  checkin_status,
  used_at,
  created_at,
  event_order_item:event_order_items!event_order_entries_order_item_alignment_fk (
    id,
    ticket_name,
    sales_unit_type,
    quantity,
    entries_per_unit,
    total_amount
  ),
  event_order:event_orders!event_order_entries_order_event_fk (
    id,
    total_amount,
    currency,
    source,
    payment_method,
    payment_status,
    buyer_name,
    buyer_last_name,
    buyer_email,
    buyer_phone,
    buyer_document,
    created_at
  )
`;

const ENTRY_SEARCH_FIELDS = [
  "attendee_name",
  "attendee_last_name",
  "attendee_email",
  "attendee_document",
] as const;

const ORDER_SEARCH_FIELDS = [
  "buyer_name",
  "buyer_last_name",
  "buyer_email",
  "buyer_document",
] as const;

function toFiniteNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function requireEventContext(req: Request, res: Response): string | null {
  if (!req.eventPanelUser || !req.eventPanelEvent) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return req.eventPanelUser.eventId;
}

function buildCatalogSummary(ticketTypes: EventTicketTypeRow[]) {
  const commercialUnitsStock = ticketTypes.reduce((total, ticketType) => {
    return total + toFiniteNumber(ticketType.stock);
  }, 0);

  const potentialQrAccesses = ticketTypes.reduce((total, ticketType) => {
    return total + toFiniteNumber(ticketType.stock) * toFiniteNumber(ticketType.entries_per_unit);
  }, 0);

  const potentialCommercialAmount = ticketTypes.reduce((total, ticketType) => {
    return total + toFiniteNumber(ticketType.stock) * toFiniteNumber(ticketType.price_amount);
  }, 0);

  const currency = ticketTypes.find((ticketType) => ticketType.currency)?.currency ?? "PYG";

  return {
    ticket_type_count: ticketTypes.length,
    commercial_units_stock: commercialUnitsStock,
    potential_qr_accesses: potentialQrAccesses,
    potential_commercial_amount: potentialCommercialAmount,
    currency,
  };
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

function sanitizeEventCheckinRequestUrl(req: Request, _res: Response, next: NextFunction) {
  const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
  if (token.length > 0) {
    req.originalUrl = sanitizeCheckinUrlValue(req.originalUrl, token) ?? req.originalUrl;
    req.url = sanitizeCheckinUrlValue(req.url, token) ?? req.url;
  }
  next();
}

function sanitizeEventManualCheckinRequestUrl(req: Request, _res: Response, next: NextFunction) {
  const queryIndex = req.originalUrl.indexOf("?");
  if (queryIndex >= 0) {
    req.originalUrl = `${req.originalUrl.slice(0, queryIndex)}?query=:redacted`;
  }
  next();
}

function hasForbiddenEventCheckinInputKeys(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenEventCheckinInputKeys(item));
  }

  return Object.entries(value as Record<string, unknown>).some(([key, nestedValue]) => {
    return EVENT_CHECKIN_FORBIDDEN_INPUT_KEYS.has(key) || hasForbiddenEventCheckinInputKeys(nestedValue);
  });
}

function normalizeEventCheckinResponseKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function containsSensitiveEventCheckinResponseKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveEventCheckinResponseKey(item));
  }

  return Object.entries(value as Record<string, unknown>).some(([key, nestedValue]) => {
    return (
      EVENT_CHECKIN_SENSITIVE_RESPONSE_KEYS.has(key) ||
      EVENT_CHECKIN_SENSITIVE_RESPONSE_KEYS.has(normalizeEventCheckinResponseKey(key)) ||
      containsSensitiveEventCheckinResponseKey(nestedValue)
    );
  });
}

function escapeIlikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function findEventEntryIdsBySearch(eventId: string, searchTerm: string) {
  const ilikePattern = `%${escapeIlikeTerm(searchTerm)}%`;
  const entryIds = new Set<string>();

  const entrySearchResults = await Promise.all(
    ENTRY_SEARCH_FIELDS.map((field) =>
      supabase
        .from("event_order_entries")
        .select("id")
        .eq("event_id", eventId)
        .ilike(field, ilikePattern)
        .range(0, 9999)
    )
  );

  for (const result of entrySearchResults) {
    if (result.error) return { entryIds, error: result.error };

    for (const row of result.data ?? []) {
      entryIds.add(row.id);
    }
  }

  const orderIds = new Set<string>();
  const orderSearchResults = await Promise.all(
    ORDER_SEARCH_FIELDS.map((field) =>
      supabase
        .from("event_orders")
        .select("id")
        .eq("event_id", eventId)
        .ilike(field, ilikePattern)
        .range(0, 9999)
    )
  );

  for (const result of orderSearchResults) {
    if (result.error) return { entryIds, error: result.error };

    for (const row of result.data ?? []) {
      orderIds.add(row.id);
    }
  }

  if (orderIds.size > 0) {
    const { data, error } = await supabase
      .from("event_order_entries")
      .select("id")
      .eq("event_id", eventId)
      .in("event_order_id", Array.from(orderIds))
      .range(0, 9999);

    if (error) return { entryIds, error };

    for (const row of data ?? []) {
      entryIds.add(row.id);
    }
  }

  return { entryIds };
}

function getManualIssueEntryId(entry: Record<string, unknown>): string | null {
  const entryId = typeof entry.id === "string" ? entry.id.trim() : "";
  return UUID_PATTERN.test(entryId) ? entryId : null;
}

function getManualIssueOrderId(order: Record<string, unknown>): string | null {
  const orderId = typeof order.id === "string" ? order.id.trim() : "";
  return UUID_PATTERN.test(orderId) ? orderId : null;
}

function getManualIssueUuidField(record: Record<string, unknown>, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (UUID_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

function getManualIssueStringField(record: Record<string, unknown>, fieldName: string): string | null {
  const value = record[fieldName];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getManualIssueMetadataValue(value: unknown): string | number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function setManualIssueMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown
) {
  const safeValue = getManualIssueMetadataValue(value);
  if (safeValue !== undefined) {
    metadata[key] = safeValue;
  }
}

type ManualIssueActivityItemContext = {
  id: string;
  ticketTypeId: string | null;
  ticketName: string | null;
  salesUnitType: string | null;
  entriesPerUnit: string | number | undefined;
  totalAmount: string | number | undefined;
  currency: string | null;
};

function buildManualIssueActivityItemContext(
  items: Array<Record<string, unknown>>
): Map<string, ManualIssueActivityItemContext> {
  const contextByItemId = new Map<string, ManualIssueActivityItemContext>();

  for (const item of items) {
    const itemId = getManualIssueUuidField(item, ["id"]);
    if (!itemId) continue;

    contextByItemId.set(itemId, {
      id: itemId,
      ticketTypeId: getManualIssueUuidField(item, ["event_ticket_type_id", "ticket_type_id"]),
      ticketName: getManualIssueStringField(item, "ticket_name"),
      salesUnitType: getManualIssueStringField(item, "sales_unit_type"),
      entriesPerUnit: getManualIssueMetadataValue(item.entries_per_unit),
      totalAmount: getManualIssueMetadataValue(item.total_amount),
      currency: getManualIssueStringField(item, "currency"),
    });
  }

  return contextByItemId;
}

async function recordEventActivityBestEffort(input: {
  requestId: string | undefined;
  eventId: string;
  action: Parameters<typeof recordEventActivity>[0]["action"];
  entityType: Parameters<typeof recordEventActivity>[0]["entityType"];
  entityId?: string | null;
  eventOrderId?: string | null;
  eventOrderItemId?: string | null;
  eventOrderEntryId?: string | null;
  eventTicketTypeId?: string | null;
  source: Parameters<typeof recordEventActivity>[0]["source"];
  actor: Parameters<typeof recordEventActivity>[0]["actor"];
  message: string;
  metadata: Record<string, unknown>;
}) {
  try {
    const result = await recordEventActivity({
      eventId: input.eventId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      eventOrderId: input.eventOrderId,
      eventOrderItemId: input.eventOrderItemId,
      eventOrderEntryId: input.eventOrderEntryId,
      eventTicketTypeId: input.eventTicketTypeId,
      source: input.source,
      actor: input.actor,
      message: input.message,
      metadata: input.metadata,
    });

    if (!result.ok) {
      logger.warn("Event activity was not recorded", {
        requestId: input.requestId,
        eventId: input.eventId,
        action: input.action,
        entityType: input.entityType,
        source: input.source ?? undefined,
        errorCode: result.error,
      });
    }
  } catch {
    logger.warn("Unexpected error recording event activity", {
      requestId: input.requestId,
      eventId: input.eventId,
      action: input.action,
      entityType: input.entityType,
      source: input.source ?? undefined,
      errorCode: "event_activity_unexpected_error",
    });
  }
}

async function recordManualIssueActivity(input: {
  eventId: string;
  requestId: string | undefined;
  actor: {
    authUserId: string;
    role: "owner" | "staff";
    displayName: string | null;
  };
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
}) {
  const orderId = getManualIssueOrderId(input.order);
  if (!orderId) {
    logger.warn("Skipping event manual issue activity without order id", {
      requestId: input.requestId,
      eventId: input.eventId,
    });
    return;
  }

  const actor = {
    type: "event_panel_user" as const,
    authUserId: input.actor.authUserId,
    role: input.actor.role,
    displayName: input.actor.displayName,
  };
  const itemContextById = buildManualIssueActivityItemContext(input.items);
  const uniqueTicketNames = new Set(
    Array.from(itemContextById.values())
      .map((item) => item.ticketName)
      .filter((ticketName): ticketName is string => Boolean(ticketName))
  );
  const orderMetadata: Record<string, unknown> = {
    entries_count: input.entries.length,
  };
  setManualIssueMetadataValue(orderMetadata, "total_amount", input.order.total_amount);
  setManualIssueMetadataValue(orderMetadata, "currency", input.order.currency);
  if (uniqueTicketNames.size === 1) {
    orderMetadata.ticket_name = Array.from(uniqueTicketNames)[0];
  }

  await recordEventActivityBestEffort({
    requestId: input.requestId,
    eventId: input.eventId,
    action: "event_order_manual_issued",
    entityType: "event_order",
    entityId: orderId,
    eventOrderId: orderId,
    source: "manual",
    actor,
    message: "Orden manual emitida",
    metadata: orderMetadata,
  });

  await mapWithConcurrency(
    input.entries,
    EVENT_ACTIVITY_MAX_CONCURRENCY,
    async (entry) => {
      const entryId = getManualIssueEntryId(entry);
      if (!entryId) {
        logger.warn("Skipping event entry issued activity without entry id", {
          requestId: input.requestId,
          eventId: input.eventId,
          orderId,
        });
        return;
      }

      const eventOrderItemId = getManualIssueUuidField(entry, ["event_order_item_id"]);
      const itemContext = eventOrderItemId ? itemContextById.get(eventOrderItemId) : null;
      const eventTicketTypeId =
        getManualIssueUuidField(entry, ["event_ticket_type_id", "ticket_type_id"]) ??
        itemContext?.ticketTypeId ??
        null;
      const entryMetadata: Record<string, unknown> = {};
      setManualIssueMetadataValue(
        entryMetadata,
        "ticket_name",
        getManualIssueStringField(entry, "ticket_name") ?? itemContext?.ticketName
      );
      setManualIssueMetadataValue(entryMetadata, "sales_unit_type", itemContext?.salesUnitType);
      setManualIssueMetadataValue(entryMetadata, "entries_per_unit", itemContext?.entriesPerUnit);
      setManualIssueMetadataValue(
        entryMetadata,
        "currency",
        getManualIssueStringField(entry, "currency") ?? itemContext?.currency
      );
      setManualIssueMetadataValue(entryMetadata, "total_amount", itemContext?.totalAmount);

      await recordEventActivityBestEffort({
        requestId: input.requestId,
        eventId: input.eventId,
        action: "event_entry_issued",
        entityType: "event_order_entry",
        entityId: entryId,
        eventOrderId: orderId,
        eventOrderItemId,
        eventOrderEntryId: entryId,
        eventTicketTypeId,
        source: "manual",
        actor,
        message: "Entrada emitida",
        metadata: entryMetadata,
      });
    }
  );
}

type EventEmailActivityContext = {
  entryId: string;
  eventOrderId: string | null;
  eventOrderItemId: string | null;
  eventTicketTypeId: string | null;
  ticketName: string | null;
};

function buildEventEmailActivityContextFromDeliveryResult(
  result: EventEntryEmailDeliveryResult
): EventEmailActivityContext | null {
  if (!result.entry_id) return null;

  return {
    entryId: result.entry_id,
    eventOrderId: result.event_order_id ?? null,
    eventOrderItemId: result.event_order_item_id ?? null,
    eventTicketTypeId: result.event_ticket_type_id ?? null,
    ticketName: result.ticket_name ?? null,
  };
}

async function fetchEventEmailActivityContext(input: {
  eventId: string;
  entryId: string;
  requestId: string | undefined;
}): Promise<EventEmailActivityContext | null> {
  const { data: entry, error: entryError } = await supabase
    .from("event_order_entries")
    .select("id, event_order_id, event_order_item_id, event_ticket_type_id")
    .eq("event_id", input.eventId)
    .eq("id", input.entryId)
    .maybeSingle();

  if (entryError || !entry) {
    logger.warn("Failed to fetch event email activity entry context", {
      requestId: input.requestId,
      eventId: input.eventId,
      entryId: input.entryId,
      errorCode: entryError?.code ?? "entry_context_unavailable",
    });
    return null;
  }

  const entryRow = entry as {
    id: string;
    event_order_id: string | null;
    event_order_item_id: string | null;
    event_ticket_type_id: string | null;
  };
  let ticketName: string | null = null;

  if (entryRow.event_order_item_id) {
    const { data: orderItem, error: itemError } = await supabase
      .from("event_order_items")
      .select("ticket_name")
      .eq("event_id", input.eventId)
      .eq("id", entryRow.event_order_item_id)
      .maybeSingle();

    if (itemError) {
      logger.warn("Failed to fetch event email activity item context", {
        requestId: input.requestId,
        eventId: input.eventId,
        entryId: input.entryId,
        eventOrderItemId: entryRow.event_order_item_id,
        errorCode: itemError.code ?? "item_context_unavailable",
      });
    } else {
      ticketName = getManualIssueStringField((orderItem ?? {}) as Record<string, unknown>, "ticket_name");
    }
  }

  return {
    entryId: entryRow.id,
    eventOrderId: entryRow.event_order_id,
    eventOrderItemId: entryRow.event_order_item_id,
    eventTicketTypeId: entryRow.event_ticket_type_id,
    ticketName,
  };
}

async function getEventEmailActivityContext(input: {
  eventId: string;
  requestId: string | undefined;
  result: EventEntryEmailDeliveryResult;
}): Promise<EventEmailActivityContext | null> {
  const resultContext = buildEventEmailActivityContextFromDeliveryResult(input.result);
  if (
    resultContext?.eventOrderId ||
    resultContext?.eventOrderItemId ||
    resultContext?.eventTicketTypeId
  ) {
    return resultContext;
  }

  if (!input.result.entry_id) return null;

  return fetchEventEmailActivityContext({
    eventId: input.eventId,
    entryId: input.result.entry_id,
    requestId: input.requestId,
  });
}

function setEventEmailActivityMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown
) {
  setManualIssueMetadataValue(metadata, key, value);
}

type EventCheckinSuccessResult = Extract<EventCheckinRpcResult, { ok: true }>;

type EventCheckinActivityContext = {
  entryId: string;
  eventOrderId: string | null;
  eventOrderItemId: string | null;
  eventTicketTypeId: string | null;
  ticketName: string | null;
};

function buildEventCheckinActivityContextFromEntry(
  entry: Record<string, unknown> | null
): EventCheckinActivityContext | null {
  if (!entry) return null;

  const entryId = getManualIssueUuidField(entry, ["id"]);
  if (!entryId) return null;

  return {
    entryId,
    eventOrderId: null,
    eventOrderItemId: null,
    eventTicketTypeId: null,
    ticketName: getManualIssueStringField(entry, "ticket_name"),
  };
}

async function fetchEventCheckinActivityContext(input: {
  eventId: string;
  entryId: string;
  requestId: string | undefined;
}): Promise<EventCheckinActivityContext | null> {
  const { data: entry, error: entryError } = await supabase
    .from("event_order_entries")
    .select("id, event_order_id, event_order_item_id, event_ticket_type_id")
    .eq("event_id", input.eventId)
    .eq("id", input.entryId)
    .maybeSingle();

  if (entryError || !entry) {
    logger.warn("Failed to fetch event check-in activity entry context", {
      requestId: input.requestId,
      eventId: input.eventId,
      entryId: input.entryId,
      errorCode: entryError?.code ?? "entry_context_unavailable",
    });
    return null;
  }

  const entryRow = entry as {
    id: string;
    event_order_id: string | null;
    event_order_item_id: string | null;
    event_ticket_type_id: string | null;
  };
  let ticketName: string | null = null;

  if (entryRow.event_order_item_id) {
    const { data: orderItem, error: itemError } = await supabase
      .from("event_order_items")
      .select("ticket_name")
      .eq("event_id", input.eventId)
      .eq("id", entryRow.event_order_item_id)
      .maybeSingle();

    if (itemError) {
      logger.warn("Failed to fetch event check-in activity item context", {
        requestId: input.requestId,
        eventId: input.eventId,
        entryId: input.entryId,
        eventOrderItemId: entryRow.event_order_item_id,
        errorCode: itemError.code ?? "item_context_unavailable",
      });
    } else {
      ticketName = getManualIssueStringField((orderItem ?? {}) as Record<string, unknown>, "ticket_name");
    }
  }

  return {
    entryId: entryRow.id,
    eventOrderId: entryRow.event_order_id,
    eventOrderItemId: entryRow.event_order_item_id,
    eventTicketTypeId: entryRow.event_ticket_type_id,
    ticketName,
  };
}

async function getEventCheckinActivityContext(input: {
  eventId: string;
  requestId: string | undefined;
  entry: Record<string, unknown> | null;
}): Promise<EventCheckinActivityContext | null> {
  const responseContext = buildEventCheckinActivityContextFromEntry(input.entry);
  if (!responseContext) return null;

  const dbContext = await fetchEventCheckinActivityContext({
    eventId: input.eventId,
    entryId: responseContext.entryId,
    requestId: input.requestId,
  });

  if (!dbContext) {
    return responseContext;
  }

  return {
    ...dbContext,
    ticketName: dbContext.ticketName ?? responseContext.ticketName,
  };
}

async function recordMalformedQrCheckinActivity(input: {
  eventId: string;
  requestId: string | undefined;
  actor: {
    authUserId: string;
    role: "owner" | "staff";
    displayName: string | null;
  };
}) {
  await recordEventActivityBestEffort({
    requestId: input.requestId,
    eventId: input.eventId,
    action: "event_entry_invalid_token_attempt",
    entityType: "event_checkin",
    entityId: null,
    eventOrderEntryId: null,
    source: "qr",
    actor: {
      type: "event_panel_user",
      authUserId: input.actor.authUserId,
      role: input.actor.role,
      displayName: input.actor.displayName,
    },
    message: "Intento de validar QR invalido",
    metadata: {
      reason_code: "malformed_token",
    },
  });
}

async function recordQrCheckinActivity(input: {
  eventId: string;
  requestId: string | undefined;
  actor: {
    authUserId: string;
    role: "owner" | "staff";
    displayName: string | null;
  };
  result: EventCheckinSuccessResult;
}) {
  if (input.result.status === "event_not_operable" || input.result.status === "not_valid_status") {
    return;
  }

  const actor = {
    type: "event_panel_user" as const,
    authUserId: input.actor.authUserId,
    role: input.actor.role,
    displayName: input.actor.displayName,
  };

  if (input.result.status === "invalid") {
    await recordEventActivityBestEffort({
      requestId: input.requestId,
      eventId: input.eventId,
      action: "event_entry_invalid_token_attempt",
      entityType: "event_checkin",
      entityId: null,
      eventOrderEntryId: null,
      source: "qr",
      actor,
      message: "Intento de validar QR invalido",
      metadata: {
        reason_code: "invalid_token",
      },
    });
    return;
  }

  const context = await getEventCheckinActivityContext({
    eventId: input.eventId,
    requestId: input.requestId,
    entry: input.result.entry,
  });

  if (!context) {
    logger.warn("Skipping QR check-in activity without entry context", {
      requestId: input.requestId,
      eventId: input.eventId,
      status: input.result.status,
    });
    return;
  }

  const metadata: Record<string, unknown> = {};
  let action: Parameters<typeof recordEventActivity>[0]["action"];
  let message: string;

  if (input.result.status === "valid") {
    action = "event_entry_checked_in";
    message = "Entrada validada por QR";
    metadata.previous_checkin_status = "unused";
    metadata.next_checkin_status = "used";
  } else if (input.result.status === "already_used") {
    action = "event_entry_already_used_attempt";
    message = "Intento de validar entrada ya usada";
    metadata.reason_code = "already_used";
  } else if (input.result.status === "outside_window") {
    action = "event_entry_outside_window_attempt";
    message = "Intento de validar entrada fuera de ventana";
    metadata.reason_code = "outside_window";
  } else if (input.result.status === "voided") {
    action = "event_entry_voided_attempt";
    message = "Intento de validar entrada anulada";
    metadata.reason_code = "voided";
  } else {
    return;
  }

  setManualIssueMetadataValue(metadata, "ticket_name", context.ticketName);

  await recordEventActivityBestEffort({
    requestId: input.requestId,
    eventId: input.eventId,
    action,
    entityType: "event_checkin",
    entityId: context.entryId,
    eventOrderId: context.eventOrderId,
    eventOrderItemId: context.eventOrderItemId,
    eventOrderEntryId: context.entryId,
    eventTicketTypeId: context.eventTicketTypeId,
    source: "qr",
    actor,
    message,
    metadata,
  });
}

async function recordManualCheckinActivity(input: {
  eventId: string;
  requestId: string | undefined;
  actor: {
    authUserId: string;
    role: "owner" | "staff";
    displayName: string | null;
  };
  result: EventCheckinSuccessResult;
}) {
  if (
    input.result.status === "event_not_operable" ||
    input.result.status === "not_valid_status" ||
    input.result.status === "invalid"
  ) {
    return;
  }

  const context = await getEventCheckinActivityContext({
    eventId: input.eventId,
    requestId: input.requestId,
    entry: input.result.entry,
  });

  if (!context) {
    logger.warn("Skipping manual check-in activity without entry context", {
      requestId: input.requestId,
      eventId: input.eventId,
      status: input.result.status,
    });
    return;
  }

  const metadata: Record<string, unknown> = {};
  let action: Parameters<typeof recordEventActivity>[0]["action"];
  let message: string;

  if (input.result.status === "valid") {
    action = "event_entry_checked_in";
    message = "Entrada validada manualmente";
    metadata.previous_checkin_status = "unused";
    metadata.next_checkin_status = "used";
  } else if (input.result.status === "already_used") {
    action = "event_entry_already_used_attempt";
    message = "Intento manual sobre entrada ya usada";
    metadata.reason_code = "already_used";
  } else if (input.result.status === "outside_window") {
    action = "event_entry_outside_window_attempt";
    message = "Intento manual fuera de ventana";
    metadata.reason_code = "outside_window";
  } else if (input.result.status === "voided") {
    action = "event_entry_voided_attempt";
    message = "Intento manual sobre entrada anulada";
    metadata.reason_code = "voided";
  } else {
    return;
  }

  setManualIssueMetadataValue(metadata, "ticket_name", context.ticketName);

  await recordEventActivityBestEffort({
    requestId: input.requestId,
    eventId: input.eventId,
    action,
    entityType: "event_checkin",
    entityId: context.entryId,
    eventOrderId: context.eventOrderId,
    eventOrderItemId: context.eventOrderItemId,
    eventOrderEntryId: context.entryId,
    eventTicketTypeId: context.eventTicketTypeId,
    source: "manual",
    actor: {
      type: "event_panel_user",
      authUserId: input.actor.authUserId,
      role: input.actor.role,
      displayName: input.actor.displayName,
    },
    message,
    metadata,
  });
}

async function recordManualEmailActivity(input: {
  eventId: string;
  requestId: string | undefined;
  actor: {
    authUserId: string;
    role: "owner" | "staff";
    displayName: string | null;
  };
  result: EventEntryEmailDeliveryResult;
}) {
  if (input.result.error_code === "entry_not_found" || !input.result.entry_id) {
    return;
  }

  const context = await getEventEmailActivityContext({
    eventId: input.eventId,
    requestId: input.requestId,
    result: input.result,
  });
  if (!context) {
    logger.warn("Skipping event manual email activity without entry context", {
      requestId: input.requestId,
      eventId: input.eventId,
      entryId: input.result.entry_id,
    });
    return;
  }

  const isSent = input.result.status === "sent";
  const metadata: Record<string, unknown> = {
    email_status: isSent ? "sent" : "failed",
    delivery_mode: "single_entry",
  };
  if (!isSent && input.result.error_code) {
    metadata.email_error_code = input.result.error_code;
  }
  setEventEmailActivityMetadataValue(metadata, "ticket_name", context.ticketName);

  await recordEventActivityBestEffort({
    requestId: input.requestId,
    eventId: input.eventId,
    action: isSent ? "event_entry_email_sent" : "event_entry_email_failed",
    entityType: "event_email",
    entityId: context.entryId,
    eventOrderId: context.eventOrderId,
    eventOrderItemId: context.eventOrderItemId,
    eventOrderEntryId: context.entryId,
    eventTicketTypeId: context.eventTicketTypeId,
    source: "manual_email",
    actor: {
      type: "event_panel_user",
      authUserId: input.actor.authUserId,
      role: input.actor.role,
      displayName: input.actor.displayName,
    },
    message: isSent ? "Email de QR enviado" : "Fallo al enviar email de QR",
    metadata,
  });
}

async function recordAutomaticBundleEmailActivity(input: {
  eventId: string;
  requestId: string | undefined;
  orderId: string | null;
  items: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
  emailDelivery: EventAutomaticEmailDeliverySummary;
}) {
  const results = input.emailDelivery.results.filter((result) => result.status !== "skipped");
  if (results.length === 0) return;

  const itemContextById = buildManualIssueActivityItemContext(input.items);
  const responseEntryById = new Map(
    input.entries
      .map((entry) => {
        const entryId = getManualIssueEntryId(entry);
        return entryId ? ([entryId, entry] as const) : null;
      })
      .filter((item): item is readonly [string, Record<string, unknown>] => item !== null)
  );

  await mapWithConcurrency(
    results,
    EVENT_ACTIVITY_MAX_CONCURRENCY,
    async (result) => {
      if (!result.entry_id) return;

      const responseEntry = responseEntryById.get(result.entry_id);
      const responseEventOrderItemId = responseEntry
        ? getManualIssueUuidField(responseEntry, ["event_order_item_id"])
        : null;
      const itemContext = responseEventOrderItemId ? itemContextById.get(responseEventOrderItemId) : null;
      const fallbackContext = !responseEntry
        ? await fetchEventEmailActivityContext({
            eventId: input.eventId,
            entryId: result.entry_id,
            requestId: input.requestId,
          })
        : null;
      const eventOrderItemId =
        responseEventOrderItemId ??
        result.event_order_item_id ??
        fallbackContext?.eventOrderItemId ??
        null;
      const eventTicketTypeId =
        (responseEntry ? getManualIssueUuidField(responseEntry, ["event_ticket_type_id", "ticket_type_id"]) : null) ??
        itemContext?.ticketTypeId ??
        result.event_ticket_type_id ??
        fallbackContext?.eventTicketTypeId ??
        null;
      const ticketName =
        (responseEntry ? getManualIssueStringField(responseEntry, "ticket_name") : null) ??
        itemContext?.ticketName ??
        result.ticket_name ??
        fallbackContext?.ticketName ??
        null;
      const eventOrderId = input.orderId ?? result.event_order_id ?? fallbackContext?.eventOrderId ?? null;
      const isSent = result.status === "sent";
      const emailStatus =
        isSent
          ? "sent"
          : result.error_code === "email_sent_but_update_failed" ||
              result.error_code === "email_sent_but_partial_update_failed"
            ? "sent_but_update_failed"
            : "failed";
      const metadata: Record<string, unknown> = {
        email_status: emailStatus,
        delivery_mode: "order_bundle",
        email_attempts: input.emailDelivery.email_attempts,
        bundle_entries_count: input.entries.length,
      };
      if (!isSent && result.error_code) {
        metadata.email_error_code = result.error_code;
      }
      setEventEmailActivityMetadataValue(metadata, "ticket_name", ticketName);

      await recordEventActivityBestEffort({
        requestId: input.requestId,
        eventId: input.eventId,
        action: isSent ? "event_entry_email_sent" : "event_entry_email_failed",
        entityType: "event_email",
        entityId: result.entry_id,
        eventOrderId,
        eventOrderItemId,
        eventOrderEntryId: result.entry_id,
        eventTicketTypeId,
        source: "automatic_email",
        actor: {
          type: "system",
          displayName: "Tairet",
        },
        message: isSent ? "Email automatico de QR enviado" : "Fallo al enviar email automatico de QR",
        metadata,
      });
    }
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

async function sendEventEntryQrEmailForEntry(input: {
  eventId: string;
  entryId: string;
  requestId: string | undefined;
  orderId?: string | null;
}): Promise<EventEntryEmailDeliveryResult> {
  const failed = (
    errorCode: EventEntryEmailDeliveryErrorCode,
    to: string | null = null,
    context: Partial<EventEntryEmailDeliveryResult> = {}
  ): EventEntryEmailDeliveryResult => ({
    ...context,
    entry_id: input.entryId,
    to,
    status: "failed",
    email_sent_at: null,
    error_code: errorCode,
  });

  const { data: entry, error: entryError } = await supabase
    .from("event_order_entries")
    .select("id, event_id, event_order_id, event_order_item_id, event_ticket_type_id, status, checkin_token, attendee_name, attendee_last_name, attendee_email")
    .eq("event_id", input.eventId)
    .eq("id", input.entryId)
    .maybeSingle();

  if (entryError) {
    logger.error("Failed to fetch event entry for email", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entryId: input.entryId,
      error_code: "event_entry_email_failed",
      error: entryError.message,
    });
    return failed("event_entry_email_failed");
  }

  if (!entry) {
    return failed("entry_not_found");
  }

  const eventEntry = entry as EventEntryEmailRow;
  const deliveryContext: Partial<EventEntryEmailDeliveryResult> = {
    event_order_id: eventEntry.event_order_id,
    event_order_item_id: eventEntry.event_order_item_id,
    event_ticket_type_id: eventEntry.event_ticket_type_id,
  };
  if (eventEntry.status !== "issued") {
    return failed("entry_not_issuable", null, deliveryContext);
  }

  const attendeeEmail = eventEntry.attendee_email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(attendeeEmail)) {
    return failed("attendee_email_unavailable", null, deliveryContext);
  }

  const [{ data: event, error: eventError }, { data: orderItem, error: itemError }] = await Promise.all([
    supabase
      .from("events")
      .select("title, starts_at, timezone, location_name")
      .eq("id", input.eventId)
      .maybeSingle(),
    supabase
      .from("event_order_items")
      .select("ticket_name, sales_unit_type")
      .eq("event_id", input.eventId)
      .eq("id", eventEntry.event_order_item_id)
      .maybeSingle(),
  ]);

  if (eventError || itemError || !event || !orderItem) {
    logger.error("Failed to fetch event entry email context", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entryId: input.entryId,
      error_code: "event_entry_email_failed",
      error: eventError?.message ?? itemError?.message ?? "Missing event email context",
    });
    return failed("event_entry_email_failed", attendeeEmail, deliveryContext);
  }

  let qrBuffer: Buffer;
  try {
    qrBuffer = await generateEventEntryQrPng(eventEntry.checkin_token);
  } catch (qrError) {
    logger.error("Failed to generate event entry QR for email", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entryId: input.entryId,
      error_code: "event_entry_email_failed",
      error: qrError instanceof Error ? qrError.message : String(qrError),
    });
    return failed("event_entry_email_failed", attendeeEmail, deliveryContext);
  }

  const eventRow = event as EventEntryEmailEventRow;
  const itemRow = orderItem as EventEntryEmailItemRow;
  const deliveryContextWithTicket: Partial<EventEntryEmailDeliveryResult> = {
    ...deliveryContext,
    ticket_name: itemRow.ticket_name,
  };
  try {
    await sendEventEntryQrEmail({
      to: attendeeEmail,
      eventTitle: eventRow.title,
      startsAt: eventRow.starts_at,
      timezone: eventRow.timezone,
      locationName: eventRow.location_name,
      ticketName: itemRow.ticket_name,
      attendeeName: eventEntry.attendee_name,
      attendeeLastName: eventEntry.attendee_last_name,
      qrPngBuffer: qrBuffer,
    });
  } catch (emailError) {
    logger.error("Failed to send event entry QR email", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entryId: input.entryId,
      error_code: "email_send_failed",
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
    return failed("email_send_failed", attendeeEmail, deliveryContextWithTicket);
  }

  const sentAt = new Date().toISOString();
  const { data: updatedEntry, error: updateError } = await supabase
    .from("event_order_entries")
    .update({ email_sent_at: sentAt })
    .eq("event_id", input.eventId)
    .eq("id", input.entryId)
    .select("id, email_sent_at")
    .maybeSingle();

  if (updateError || !updatedEntry) {
    logger.error("Failed to update event entry email_sent_at", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entryId: input.entryId,
      error_code: "email_update_failed",
      error: updateError?.message ?? "Missing updated entry",
    });
    return failed("email_update_failed", attendeeEmail, deliveryContextWithTicket);
  }

  return {
    entry_id: updatedEntry.id,
    to: attendeeEmail,
    status: "sent",
    email_sent_at: updatedEntry.email_sent_at,
    error_code: null,
    event_order_id: eventEntry.event_order_id,
    event_order_item_id: eventEntry.event_order_item_id,
    event_ticket_type_id: eventEntry.event_ticket_type_id,
    ticket_name: itemRow.ticket_name,
  };
}

function buildOrderBundleEmailResults(
  entryIds: string[],
  status: EventEntryEmailDeliveryStatus,
  emailSentAt: string | null,
  errorCode: EventEntryEmailDeliveryErrorCode | null
): EventEntryEmailDeliveryResult[] {
  return entryIds.map((entryId) => ({
    entry_id: entryId,
    status,
    email_sent_at: emailSentAt,
    error_code: errorCode,
  }));
}

function buildOrderBundleEmailDeliverySummary(input: {
  emailAttempts: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  status: EventAutomaticEmailDeliverySummary["status"];
  reason: EventAutomaticEmailDeliverySummary["reason"];
  results: EventEntryEmailDeliveryResult[];
}): EventAutomaticEmailDeliverySummary {
  return {
    mode: "order_bundle",
    email_attempts: input.emailAttempts,
    attempted: input.attempted,
    sent: input.sent,
    failed: input.failed,
    skipped: input.skipped,
    status: input.status,
    reason: input.reason,
    results: input.results,
  };
}

function normalizeEmailCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

async function resolveManualIssueBuyerEmail(input: {
  eventId: string;
  orderId: string | null;
  order: Record<string, unknown>;
  buyerEmail: string;
  requestId: string | undefined;
}): Promise<string | null> {
  const orderBuyerEmail =
    normalizeEmailCandidate(input.order.buyer_email) ??
    normalizeEmailCandidate(input.order.buyerEmail);
  if (orderBuyerEmail) return orderBuyerEmail;

  const requestBuyerEmail = normalizeEmailCandidate(input.buyerEmail);
  if (requestBuyerEmail) return requestBuyerEmail;

  if (!input.orderId) return null;

  const { data, error } = await supabase
    .from("event_orders")
    .select("buyer_email")
    .eq("event_id", input.eventId)
    .eq("id", input.orderId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to fetch event order buyer email for bundle delivery", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      error_code: "email_context_failed",
      error: error.message,
    });
    return null;
  }

  return normalizeEmailCandidate((data as { buyer_email?: unknown } | null)?.buyer_email);
}

async function buildManualIssueEmailDelivery(input: {
  eventId: string;
  orderId: string | null;
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
  buyerEmail: string;
  requestId: string | undefined;
}): Promise<EventAutomaticEmailDeliverySummary> {
  const requestedEntryIds = input.entries.map((entry) => getManualIssueEntryId(entry) ?? "");
  const entryCount = requestedEntryIds.length;

  if (input.entries.length === 0) {
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      status: "skipped",
      reason: "no_entries",
      results: [],
    });
  }

  if (input.entries.length > AUTOMATIC_EMAIL_MAX_ENTRIES) {
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: entryCount,
      status: "skipped",
      reason: "too_many_entries_for_order_bundle_email",
      results: buildOrderBundleEmailResults(
        requestedEntryIds,
        "skipped",
        null,
        "too_many_entries_for_order_bundle_email"
      ),
    });
  }

  if (requestedEntryIds.some((entryId) => entryId.length === 0)) {
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: entryCount,
      sent: 0,
      failed: entryCount,
      skipped: 0,
      status: "failed",
      reason: null,
      results: buildOrderBundleEmailResults(requestedEntryIds, "failed", null, "email_context_failed"),
    });
  }

  const buyerEmail = await resolveManualIssueBuyerEmail({
    eventId: input.eventId,
    orderId: input.orderId,
    order: input.order,
    buyerEmail: input.buyerEmail,
    requestId: input.requestId,
  });

  if (!buyerEmail) {
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: entryCount,
      status: "skipped",
      reason: "buyer_email_unavailable",
      results: buildOrderBundleEmailResults(requestedEntryIds, "skipped", null, "buyer_email_unavailable"),
    });
  }

  const [{ data: event, error: eventError }, { data: entryRows, error: entriesError }] = await Promise.all([
    supabase
      .from("events")
      .select("title, starts_at, timezone, location_name")
      .eq("id", input.eventId)
      .maybeSingle(),
    supabase
      .from("event_order_entries")
      .select("id, event_id, event_order_item_id, status, checkin_token, attendee_name, attendee_last_name")
      .eq("event_id", input.eventId)
      .in("id", requestedEntryIds),
  ]);

  if (eventError || entriesError || !event || !entryRows || entryRows.length !== entryCount) {
    logger.error("Failed to fetch event order bundle email context", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entries_count: entryCount,
      error_code: "email_context_failed",
      error: eventError?.message ?? entriesError?.message ?? "Missing event bundle email context",
    });
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: entryCount,
      sent: 0,
      failed: entryCount,
      skipped: 0,
      status: "failed",
      reason: null,
      results: buildOrderBundleEmailResults(requestedEntryIds, "failed", null, "email_context_failed"),
    });
  }

  const itemContextById = buildManualIssueActivityItemContext(input.items);
  const responseEntryById = new Map(
    input.entries
      .map((entry) => {
        const entryId = getManualIssueEntryId(entry);
        return entryId ? ([entryId, entry] as const) : null;
      })
      .filter((item): item is readonly [string, Record<string, unknown>] => item !== null)
  );
  const entryRowById = new Map(
    (entryRows as EventOrderBundleEmailEntryRow[]).map((entryRow) => [entryRow.id, entryRow])
  );
  const eventRow = event as EventEntryEmailEventRow;

  const bundleEntries: Array<{
    ticketName: string;
    attendeeName: string;
    attendeeLastName: string;
    qrPngBuffer: Buffer;
    contentId: string;
  }> = [];

  try {
    for (const [index, entryId] of requestedEntryIds.entries()) {
      const entryRow = entryRowById.get(entryId);
      if (!entryRow || entryRow.status !== "issued") {
        throw new Error("Entry unavailable for bundle email");
      }

      const responseEntry = responseEntryById.get(entryId);
      const itemContext = itemContextById.get(entryRow.event_order_item_id);
      const ticketName =
        (responseEntry ? getManualIssueStringField(responseEntry, "ticket_name") : null) ??
        itemContext?.ticketName ??
        "Entrada";
      const qrPngBuffer = await generateEventEntryQrPng(entryRow.checkin_token);

      bundleEntries.push({
        ticketName,
        attendeeName: entryRow.attendee_name,
        attendeeLastName: entryRow.attendee_last_name,
        qrPngBuffer,
        contentId: `event-entry-qr-${index + 1}`,
      });
    }
  } catch (error) {
    logger.error("Failed to build event order QR bundle email", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entries_count: entryCount,
      error_code: "event_entry_email_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 0,
      attempted: entryCount,
      sent: 0,
      failed: entryCount,
      skipped: 0,
      status: "failed",
      reason: null,
      results: buildOrderBundleEmailResults(requestedEntryIds, "failed", null, "event_entry_email_failed"),
    });
  }

  try {
    await sendEventOrderQrBundleEmail({
      to: buyerEmail,
      eventTitle: eventRow.title,
      startsAt: eventRow.starts_at,
      timezone: eventRow.timezone,
      locationName: eventRow.location_name,
      entries: bundleEntries,
    });
  } catch (error) {
    logger.error("Failed to send event order QR bundle email", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entries_count: entryCount,
      error_code: "email_send_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 1,
      attempted: entryCount,
      sent: 0,
      failed: entryCount,
      skipped: 0,
      status: "failed",
      reason: null,
      results: buildOrderBundleEmailResults(requestedEntryIds, "failed", null, "email_send_failed"),
    });
  }

  const sentAt = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await supabase
    .from("event_order_entries")
    .update({ email_sent_at: sentAt })
    .eq("event_id", input.eventId)
    .in("id", requestedEntryIds)
    .select("id, email_sent_at");

  if (updateError || !updatedRows) {
    logger.error("Failed to update event order bundle email_sent_at", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entries_count: entryCount,
      error_code: "email_sent_but_update_failed",
      error: updateError?.message ?? "Missing updated entries",
    });
    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 1,
      attempted: entryCount,
      sent: 0,
      failed: entryCount,
      skipped: 0,
      status: "partial_failed",
      reason: null,
      results: buildOrderBundleEmailResults(
        requestedEntryIds,
        "failed",
        null,
        "email_sent_but_update_failed"
      ),
    });
  }

  const updatedEmailSentAtById = new Map(
    (updatedRows as Array<{ id: string; email_sent_at: string | null }>).map((row) => [row.id, row.email_sent_at])
  );

  if (updatedEmailSentAtById.size !== entryCount) {
    logger.error("Partial update of event order bundle email_sent_at", {
      requestId: input.requestId,
      eventId: input.eventId,
      orderId: input.orderId,
      entries_count: entryCount,
      updated_count: updatedEmailSentAtById.size,
      error_code: "email_sent_but_partial_update_failed",
    });
    const results = requestedEntryIds.map((entryId) => {
      const emailSentAt = updatedEmailSentAtById.get(entryId) ?? null;
      return {
        entry_id: entryId,
        status: emailSentAt ? "sent" : "failed",
        email_sent_at: emailSentAt,
        error_code: emailSentAt ? null : "email_sent_but_partial_update_failed",
      } satisfies EventEntryEmailDeliveryResult;
    });
    const sent = results.filter((result) => result.status === "sent").length;
    const failed = entryCount - sent;

    return buildOrderBundleEmailDeliverySummary({
      emailAttempts: 1,
      attempted: entryCount,
      sent,
      failed,
      skipped: 0,
      status: "partial_failed",
      reason: null,
      results,
    });
  }

  return buildOrderBundleEmailDeliverySummary({
    emailAttempts: 1,
    attempted: entryCount,
    sent: entryCount,
    failed: 0,
    skipped: 0,
    status: "sent",
    reason: null,
    results: requestedEntryIds.map((entryId) => ({
      entry_id: entryId,
      status: "sent",
      email_sent_at: updatedEmailSentAtById.get(entryId) ?? sentAt,
      error_code: null,
    })),
  });
}

panelEventsRouter.get("/:eventId/me", eventPanelAuth, requireEventRole(["owner", "staff"]), (req, res) => {
  if (!req.eventPanelUser || !req.eventPanelEvent) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({
    event: {
      id: req.eventPanelEvent.id,
      slug: req.eventPanelEvent.slug,
      title: req.eventPanelEvent.title,
      status: req.eventPanelEvent.status,
    },
    membership: {
      role: req.eventPanelUser.role,
      display_name: req.eventPanelUser.displayName,
    },
  });
});

panelEventsRouter.post("/:eventId/orders/manual-issue", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId || !req.eventPanelUser) return;

    const parsedBody = eventManualIssueSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.flatten(),
        code: "invalid_input",
      });
    }

    const requestId = getRequestId(req);
    const manualIssueInput = parsedBody.data;
    const { data: rpcData, error: rpcError } = await supabase.rpc("issue_event_manual_order", {
      p_event_id: req.eventPanelUser.eventId,
      p_actor_auth_user_id: req.eventPanelUser.authUserId,
      p_buyer: manualIssueInput.buyer,
      p_items: manualIssueInput.items,
      p_notes: manualIssueInput.notes && manualIssueInput.notes.length > 0 ? manualIssueInput.notes : null,
    });

    if (rpcError) {
      logger.error("Failed to call event manual issue RPC", {
        requestId,
        eventId,
        error: rpcError.message,
      });
      return res.status(500).json({
        error: "Manual issue failed",
        code: "manual_issue_failed",
      });
    }

    const result = rpcData as ManualIssueRpcResult | null;
    if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
      logger.error("Unexpected event manual issue RPC response", {
        requestId,
        eventId,
      });
      return res.status(500).json({
        error: "Manual issue failed",
        code: "manual_issue_failed",
      });
    }

    if (result.ok === false) {
      const code = result.error?.code ?? "manual_issue_failed";
      const status = MANUAL_ISSUE_RPC_ERROR_STATUS[code] ?? 500;

      return res.status(status).json({
        error: result.error?.message ?? "Manual issue failed",
        code,
      });
    }

    const emailDelivery = await buildManualIssueEmailDelivery({
      eventId: req.eventPanelUser.eventId,
      orderId: getManualIssueOrderId(result.data.order),
      order: result.data.order,
      items: result.data.items,
      entries: result.data.entries,
      buyerEmail: manualIssueInput.buyer.email,
      requestId,
    });
    const orderId = getManualIssueOrderId(result.data.order);

    await recordManualIssueActivity({
      eventId: req.eventPanelUser.eventId,
      requestId,
      actor: req.eventPanelUser,
      order: result.data.order,
      items: result.data.items,
      entries: result.data.entries,
    });

    await recordAutomaticBundleEmailActivity({
      eventId: req.eventPanelUser.eventId,
      requestId,
      orderId,
      items: result.data.items,
      entries: result.data.entries,
      emailDelivery,
    }).catch((error) => {
      logger.warn("Unexpected error recording automatic email activity", {
        requestId,
        eventId: req.eventPanelUser?.eventId,
        orderId,
        errorCode: "event_activity_unexpected_error",
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return res.status(201).json({
      ...result.data,
      email_delivery: emailDelivery,
    });
  } catch (error) {
    next(error);
  }
});

panelEventsRouter.patch(
  "/:eventId/checkin/:token",
  sanitizeEventCheckinRequestUrl,
  eventPanelAuth,
  requireEventRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      const eventId = requireEventContext(req, res);
      if (!eventId || !req.eventPanelUser) return;

      const requestId = getRequestId(req);

      if (Object.keys(req.query).length > 0 || hasForbiddenEventCheckinInputKeys(req.body)) {
        return res.status(400).json({
          error: "Invalid check-in input",
          code: "invalid_checkin_input",
        });
      }

      const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
      if (!UUID_PATTERN.test(token)) {
        await recordMalformedQrCheckinActivity({
          eventId: req.eventPanelUser.eventId,
          requestId,
          actor: req.eventPanelUser,
        }).catch((error) => {
          logger.warn("Unexpected error recording malformed QR check-in activity", {
            requestId,
            eventId: req.eventPanelUser?.eventId,
            errorCode: "event_activity_unexpected_error",
            error: error instanceof Error ? error.message : String(error),
          });
        });

        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc("check_in_event_entry_by_token", {
        p_event_id: req.eventPanelUser.eventId,
        p_actor_auth_user_id: req.eventPanelUser.authUserId,
        p_token: token,
      });

      if (rpcError) {
        logger.error("Failed to call event check-in RPC", {
          requestId,
          eventId,
          error: rpcError.message,
        });
        return res.status(500).json({
          error: "Event check-in failed",
          code: "checkin_failed",
        });
      }

      const result = rpcData as EventCheckinRpcResult | null;
      if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
        logger.error("Unexpected event check-in RPC response", {
          requestId,
          eventId,
        });
        return res.status(500).json({
          error: "Event check-in failed",
          code: "checkin_failed",
        });
      }

      if (result.ok === false) {
        const code = result.error?.code ?? "checkin_failed";
        const status = EVENT_CHECKIN_RPC_ERROR_STATUS[code] ?? 500;

        return res.status(status).json({
          error: result.error?.message ?? "Event check-in failed",
          code,
        });
      }

      if (containsSensitiveEventCheckinResponseKey(result)) {
        logger.error("Unsafe event check-in RPC response blocked", {
          requestId,
          eventId,
          status: result.status,
          errorCode: "unsafe_checkin_response",
        });
        return res.status(500).json({
          error: "Event check-in failed",
          code: "checkin_failed",
        });
      }

      await recordQrCheckinActivity({
        eventId: req.eventPanelUser.eventId,
        requestId,
        actor: req.eventPanelUser,
        result,
      }).catch((error) => {
        logger.warn("Unexpected error recording QR check-in activity", {
          requestId,
          eventId: req.eventPanelUser?.eventId,
          status: result.status,
          errorCode: "event_activity_unexpected_error",
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

panelEventsRouter.patch(
  "/:eventId/entries/:entryId/use",
  sanitizeEventManualCheckinRequestUrl,
  eventPanelAuth,
  requireEventRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      const eventId = requireEventContext(req, res);
      if (!eventId || !req.eventPanelUser) return;

      const entryId = typeof req.params.entryId === "string" ? req.params.entryId.trim() : "";
      if (!UUID_PATTERN.test(entryId)) {
        return res.status(400).json({
          error: "Invalid entryId",
          code: "invalid_entry_id",
        });
      }

      if (Object.keys(req.query).length > 0 || hasForbiddenEventCheckinInputKeys(req.body)) {
        return res.status(400).json({
          error: "Invalid manual check-in input",
          code: "invalid_manual_checkin_input",
        });
      }

      const requestId = getRequestId(req);
      const { data: rpcData, error: rpcError } = await supabase.rpc("check_in_event_entry_manually", {
        p_event_id: req.eventPanelUser.eventId,
        p_actor_auth_user_id: req.eventPanelUser.authUserId,
        p_entry_id: entryId,
      });

      if (rpcError) {
        logger.error("Failed to call event manual check-in RPC", {
          requestId,
          eventId,
          entryId,
          error: rpcError.message,
        });
        return res.status(500).json({
          error: "Event manual check-in failed",
          code: "manual_checkin_failed",
        });
      }

      const result = rpcData as EventCheckinRpcResult | null;
      if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
        logger.error("Unexpected event manual check-in RPC response", {
          requestId,
          eventId,
          entryId,
        });
        return res.status(500).json({
          error: "Event manual check-in failed",
          code: "manual_checkin_failed",
        });
      }

      if (result.ok === false) {
        const code = result.error?.code ?? "manual_checkin_failed";
        const status = EVENT_MANUAL_CHECKIN_RPC_ERROR_STATUS[code] ?? 500;

        return res.status(status).json({
          error: result.error?.message ?? "Event manual check-in failed",
          code,
        });
      }

      if (containsSensitiveEventCheckinResponseKey(result)) {
        logger.error("Unsafe event manual check-in RPC response blocked", {
          requestId,
          eventId,
          entryId,
          status: result.status,
          errorCode: "unsafe_manual_checkin_response",
        });
        return res.status(500).json({
          error: "Event manual check-in failed",
          code: "manual_checkin_failed",
        });
      }

      await recordManualCheckinActivity({
        eventId: req.eventPanelUser.eventId,
        requestId,
        actor: req.eventPanelUser,
        result,
      }).catch((error) => {
        logger.warn("Unexpected error recording manual check-in activity", {
          requestId,
          eventId: req.eventPanelUser?.eventId,
          entryId,
          status: result.status,
          errorCode: "event_activity_unexpected_error",
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

panelEventsRouter.post("/:eventId/entries/:entryId/send-email", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId || !req.eventPanelUser) return;

    const entryId = typeof req.params.entryId === "string" ? req.params.entryId.trim() : "";
    if (!UUID_PATTERN.test(entryId)) {
      return res.status(400).json({
        error: "Invalid entryId",
        code: "invalid_entry_id",
      });
    }

    const requestId = getRequestId(req);
    const deliveryResult = await sendEventEntryQrEmailForEntry({
      eventId: req.eventPanelUser.eventId,
      entryId,
      requestId,
    });

    await recordManualEmailActivity({
      eventId: req.eventPanelUser.eventId,
      requestId,
      actor: req.eventPanelUser,
      result: deliveryResult,
    }).catch((error) => {
      logger.warn("Unexpected error recording manual email activity", {
        requestId,
        eventId: req.eventPanelUser?.eventId,
        entryId,
        errorCode: "event_activity_unexpected_error",
        error: error instanceof Error ? error.message : String(error),
      });
    });

    if (deliveryResult.status === "sent") {
      return res.status(200).json({
        ok: true,
        entry: {
          id: deliveryResult.entry_id,
          email_sent_at: deliveryResult.email_sent_at,
        },
        email: {
          to: deliveryResult.to,
          status: "sent",
        },
      });
    }

    if (deliveryResult.error_code === "entry_not_found") {
      return res.status(404).json({
        error: "Entry not found",
        code: "entry_not_found",
      });
    }

    if (deliveryResult.error_code === "entry_not_issuable") {
      return res.status(409).json({
        error: "Entry is not issuable",
        code: "entry_not_issuable",
      });
    }

    if (deliveryResult.error_code === "attendee_email_unavailable") {
      return res.status(409).json({
        error: "Attendee email unavailable",
        code: "attendee_email_unavailable",
      });
    }

    if (deliveryResult.error_code === "email_send_failed") {
      return res.status(502).json({
        error: "Failed to send entry email",
        code: "email_send_failed",
      });
    }

    if (deliveryResult.error_code === "email_update_failed") {
      return res.status(500).json({
        error: "Failed to update email status",
        code: "email_update_failed",
      });
    }

    return res.status(500).json({
      error: "Failed to send entry email",
      code: "event_entry_email_failed",
    });
  } catch (error) {
    next(error);
  }
});

panelEventsRouter.get("/:eventId/entries/:entryId/qr", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId || !req.eventPanelUser) return;

    const entryId = typeof req.params.entryId === "string" ? req.params.entryId.trim() : "";
    if (!UUID_PATTERN.test(entryId)) {
      return res.status(400).json({
        error: "Invalid entryId",
        code: "invalid_entry_id",
      });
    }

    const requestId = getRequestId(req);
    const { data: entry, error: entryError } = await supabase
      .from("event_order_entries")
      .select("id, event_id, status, checkin_token")
      .eq("event_id", req.eventPanelUser.eventId)
      .eq("id", entryId)
      .maybeSingle();

    if (entryError) {
      logger.error("Failed to fetch event entry for QR", {
        requestId,
        eventId,
        entryId,
        error: entryError.message,
      });
      return res.status(500).json({
        error: "Failed to generate entry QR",
        code: "qr_generation_failed",
      });
    }

    if (!entry) {
      return res.status(404).json({
        error: "Entry not found",
        code: "entry_not_found",
      });
    }

    const eventEntry = entry as EventEntryQrRow;
    if (eventEntry.status !== "issued") {
      return res.status(409).json({
        error: "Entry is not issuable",
        code: "entry_not_issuable",
      });
    }

    try {
      const qrBuffer = await generateEventEntryQrPng(eventEntry.checkin_token);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", 'inline; filename="tairet-event-entry-qr.png"');
      return res.status(200).send(qrBuffer);
    } catch (qrError) {
      logger.error("Failed to generate event entry QR", {
        requestId,
        eventId,
        entryId,
        error: qrError instanceof Error ? qrError.message : String(qrError),
      });
      return res.status(500).json({
        error: "Failed to generate entry QR",
        code: "qr_generation_failed",
      });
    }
  } catch (error) {
    next(error);
  }
});

panelEventsRouter.get("/:eventId/entries", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId || !req.eventPanelUser) return;

    const parsedQuery = eventEntriesReadQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: parsedQuery.error.flatten(),
        code: "invalid_query",
      });
    }

    const requestId = getRequestId(req);
    const query = parsedQuery.data;
    const offset = (query.page - 1) * query.page_size;
    const rangeEnd = offset + query.page_size - 1;
    let matchedEntryIds: string[] | null = null;

    if (query.q) {
      const searchResult = await findEventEntryIdsBySearch(req.eventPanelUser.eventId, query.q);

      if (searchResult.error) {
        logger.error("Failed to search event entries", {
          requestId,
          eventId,
          error: searchResult.error.message,
        });
        return res.status(500).json({
          error: "Failed to fetch event entries",
          code: "entries_read_failed",
        });
      }

      matchedEntryIds = Array.from(searchResult.entryIds);
      if (matchedEntryIds.length === 0) {
        return res.status(200).json({
          items: [],
          pagination: {
            page: query.page,
            page_size: query.page_size,
            total: 0,
            total_pages: 0,
          },
        });
      }
    }

    let entriesQuery = supabase
      .from("event_order_entries")
      .select(EVENT_ENTRY_SELECT, { count: "exact" })
      .eq("event_id", req.eventPanelUser.eventId);

    if (matchedEntryIds) {
      entriesQuery = entriesQuery.in("id", matchedEntryIds);
    }

    if (query.ticket_type_id) {
      entriesQuery = entriesQuery.eq("event_ticket_type_id", query.ticket_type_id);
    }

    if (query.status) {
      entriesQuery = entriesQuery.eq("status", query.status);
    }

    if (query.checkin_status) {
      entriesQuery = entriesQuery.eq("checkin_status", query.checkin_status);
    }

    const ascending = query.sort === "created_at_asc";
    const { data: entries, count, error } = await entriesQuery
      .order("created_at", { ascending })
      .order("id", { ascending })
      .range(offset, rangeEnd);

    if (error) {
      logger.error("Failed to fetch event entries", {
        requestId,
        eventId,
        error: error.message,
      });
      return res.status(500).json({
        error: "Failed to fetch event entries",
        code: "entries_read_failed",
      });
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.page_size);
    const items = ((entries ?? []) as EventEntryReadRow[]).map((entry) => {
      const item = firstRelated(entry.event_order_item);
      const order = firstRelated(entry.event_order);

      return {
        entry: {
          id: entry.id,
          event_order_id: entry.event_order_id,
          event_order_item_id: entry.event_order_item_id,
          ticket_type_id: entry.event_ticket_type_id,
          ticket_name: item?.ticket_name ?? "",
          sales_unit_type: item?.sales_unit_type ?? "",
          status: entry.status,
          checkin_status: entry.checkin_status,
          unit_price_amount: toFiniteNumber(entry.unit_price_amount),
          currency: entry.currency,
          created_at: entry.created_at,
          used_at: entry.used_at,
        },
        attendee: {
          name: entry.attendee_name,
          last_name: entry.attendee_last_name,
          email: entry.attendee_email,
          phone: entry.attendee_phone,
          document: entry.attendee_document,
        },
        buyer: {
          name: order?.buyer_name ?? "",
          last_name: order?.buyer_last_name ?? "",
          email: order?.buyer_email ?? "",
          phone: order?.buyer_phone ?? "",
          document: order?.buyer_document ?? "",
        },
        order: {
          id: order?.id ?? entry.event_order_id,
          total_amount: toFiniteNumber(order?.total_amount),
          currency: order?.currency ?? "PYG",
          source: order?.source ?? "",
          payment_method: order?.payment_method ?? "",
          payment_status: order?.payment_status ?? "",
          created_at: order?.created_at ?? entry.created_at,
        },
        item: {
          id: item?.id ?? entry.event_order_item_id,
          quantity: toFiniteNumber(item?.quantity),
          entries_per_unit: toFiniteNumber(item?.entries_per_unit),
          total_amount: toFiniteNumber(item?.total_amount),
        },
      };
    });

    return res.status(200).json({
      items,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

panelEventsRouter.get("/:eventId/summary", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId) return;

    const requestId = getRequestId(req);

    const [
      { data: event, error: eventError },
      { data: ticketTypes, error: ticketTypesError },
      { count: ordersCount, error: ordersCountError },
      { data: orderItems, count: orderItemsCount, error: orderItemsError },
      { count: entriesCount, error: entriesCountError },
      { count: usedEntriesCount, error: usedEntriesCountError },
      { count: unusedEntriesCount, error: unusedEntriesCountError },
      { count: voidedEntriesCount, error: voidedEntriesCountError },
    ] = await Promise.all([
      supabase
        .from("events")
        .select("id, slug, title, status, starts_at, ends_at, checkin_valid_from, checkin_valid_to, timezone, location_name, organizer_name")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("event_ticket_types")
        .select("id, name, description, price_amount, currency, stock, active, sort_order, sales_unit_type, entries_per_unit")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("event_orders")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId),
      supabase
        .from("event_order_items")
        .select("total_amount", { count: "exact" })
        .eq("event_id", eventId)
        .range(0, 9999),
      supabase
        .from("event_order_entries")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId),
      supabase
        .from("event_order_entries")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId)
        .eq("checkin_status", "used"),
      supabase
        .from("event_order_entries")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId)
        .eq("status", "issued")
        .eq("checkin_status", "unused"),
      supabase
        .from("event_order_entries")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", eventId)
        .eq("status", "voided"),
    ]);

    const queryError =
      eventError ||
      ticketTypesError ||
      ordersCountError ||
      orderItemsError ||
      entriesCountError ||
      usedEntriesCountError ||
      unusedEntriesCountError ||
      voidedEntriesCountError;

    if (queryError) {
      logger.error("Failed to fetch event summary", {
        requestId,
        eventId,
        error: queryError.message,
      });
      return res.status(500).json({ error: "Failed to fetch event summary" });
    }

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const ticketTypeRows = (ticketTypes ?? []) as EventTicketTypeRow[];
    const catalog = buildCatalogSummary(ticketTypeRows);
    const issuedCommercialAmount = ((orderItems ?? []) as Array<{ total_amount: number | string | null }>).reduce(
      (total, item) => total + toFiniteNumber(item.total_amount),
      0
    );

    return res.status(200).json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        status: event.status,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        checkin_valid_from: event.checkin_valid_from,
        checkin_valid_to: event.checkin_valid_to,
        timezone: event.timezone,
        location_name: event.location_name,
        organizer_name: event.organizer_name,
      },
      catalog,
      operations: {
        orders_count: ordersCount ?? 0,
        order_items_count: orderItemsCount ?? 0,
        entries_count: entriesCount ?? 0,
        used_entries_count: usedEntriesCount ?? 0,
        unused_entries_count: unusedEntriesCount ?? 0,
        voided_entries_count: voidedEntriesCount ?? 0,
        issued_commercial_amount: issuedCommercialAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

panelEventsRouter.get("/:eventId/ticket-types", eventPanelAuth, requireEventRole(["owner", "staff"]), async (req, res, next) => {
  try {
    const eventId = requireEventContext(req, res);
    if (!eventId) return;

    const requestId = getRequestId(req);

    const [
      { data: ticketTypes, error: ticketTypesError },
      { data: orderItems, error: orderItemsError },
      { data: entries, error: entriesError },
    ] = await Promise.all([
      supabase
        .from("event_ticket_types")
        .select("id, name, description, price_amount, currency, stock, active, sort_order, sales_unit_type, entries_per_unit")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("event_order_items")
        .select("event_ticket_type_id, quantity, total_amount")
        .eq("event_id", eventId)
        .range(0, 9999),
      supabase
        .from("event_order_entries")
        .select("event_ticket_type_id")
        .eq("event_id", eventId)
        .range(0, 9999),
    ]);

    const queryError = ticketTypesError || orderItemsError || entriesError;

    if (queryError) {
      logger.error("Failed to fetch event ticket types", {
        requestId,
        eventId,
        error: queryError.message,
      });
      return res.status(500).json({ error: "Failed to fetch event ticket types" });
    }

    const ticketTypeRows = (ticketTypes ?? []) as EventTicketTypeRow[];
    const issuedCommercialUnitsByTicketType = new Map<string, number>();
    for (const item of (orderItems ?? []) as EventOrderItemMetricRow[]) {
      addToMap(
        issuedCommercialUnitsByTicketType,
        item.event_ticket_type_id,
        toFiniteNumber(item.quantity)
      );
    }

    const issuedQrAccessesByTicketType = new Map<string, number>();
    for (const entry of (entries ?? []) as EventOrderEntryMetricRow[]) {
      addToMap(issuedQrAccessesByTicketType, entry.event_ticket_type_id, 1);
    }

    const items = ticketTypeRows.map((ticketType) => {
      const stock = toFiniteNumber(ticketType.stock);
      const priceAmount = toFiniteNumber(ticketType.price_amount);
      const entriesPerUnit = toFiniteNumber(ticketType.entries_per_unit);
      const issuedCommercialUnits = issuedCommercialUnitsByTicketType.get(ticketType.id) ?? 0;

      return {
        id: ticketType.id,
        name: ticketType.name,
        description: ticketType.description,
        price_amount: priceAmount,
        currency: ticketType.currency,
        stock,
        active: ticketType.active,
        sort_order: ticketType.sort_order ?? 0,
        sales_unit_type: ticketType.sales_unit_type,
        entries_per_unit: entriesPerUnit,
        potential_qr_accesses: stock * entriesPerUnit,
        potential_commercial_amount: stock * priceAmount,
        issued_commercial_units: issuedCommercialUnits,
        issued_qr_accesses: issuedQrAccessesByTicketType.get(ticketType.id) ?? 0,
        remaining_commercial_units: stock - issuedCommercialUnits,
      };
    });

    return res.status(200).json({
      items,
      summary: {
        ticket_type_count: items.length,
        potential_qr_accesses: items.reduce((total, item) => total + item.potential_qr_accesses, 0),
        potential_commercial_amount: items.reduce((total, item) => total + item.potential_commercial_amount, 0),
        currency: items.find((item) => item.currency)?.currency ?? "PYG",
      },
    });
  } catch (error) {
    next(error);
  }
});
