import { NextFunction, Request, Response, Router } from "express";
import { eventPanelAuth } from "../middlewares/eventPanelAuth";
import { requireEventRole } from "../middlewares/requireEventRole";
import { eventEntriesReadQuerySchema } from "../schemas/eventEntriesRead";
import { eventManualIssueSchema } from "../schemas/eventManualIssue";
import { getRequestId } from "../middlewares/requestId";
import { sendEventEntryQrEmail } from "../services/eventEmails";
import { generateEventEntryQrPng } from "../services/eventQr";
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
  event_order_item_id: string;
  attendee_name: string;
  attendee_last_name: string;
  attendee_email: string;
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

type EventEntryEmailDeliveryStatus = "sent" | "failed";
type EventEntryEmailDeliveryErrorCode =
  | "entry_not_found"
  | "entry_not_issuable"
  | "attendee_email_unavailable"
  | "event_entry_email_failed"
  | "email_context_failed"
  | "email_send_failed"
  | "email_update_failed";

type EventEntryEmailDeliveryResult = {
  entry_id: string;
  to: string | null;
  status: EventEntryEmailDeliveryStatus;
  email_sent_at: string | null;
  error_code: EventEntryEmailDeliveryErrorCode | null;
};

type EventAutomaticEmailDeliverySummary = {
  mode: "automatic_best_effort";
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  status: "sent" | "partial_failed" | "failed" | "skipped";
  reason: "no_entries" | "too_many_entries_for_sync_email" | null;
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
const AUTOMATIC_EMAIL_MAX_CONCURRENCY = 3;
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
const EVENT_CHECKIN_SENSITIVE_RESPONSE_KEYS = new Set([
  "checkin_token",
  "checkintoken",
  "qr_payload",
  "qrpayload",
  "qr_base64",
  "qrbase64",
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
  "auth_user_id",
  "authUserId",
  "p_actor_auth_user_id",
  "actor",
  "actor_auth_user_id",
  "actorAuthUserId",
  "entry",
  "entry_id",
  "entryId",
  "attendee",
  "status",
  "checkin_status",
  "checkinStatus",
  "metadata",
  "token",
  "p_token",
  "checkin_token",
  "checkinToken",
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

function hasForbiddenEventCheckinInputKeys(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.keys(value as Record<string, unknown>).some((key) =>
    EVENT_CHECKIN_FORBIDDEN_INPUT_KEYS.has(key)
  );
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

function toAutomaticEmailErrorCode(errorCode: EventEntryEmailDeliveryErrorCode | null): EventEntryEmailDeliveryErrorCode | null {
  if (!errorCode) return null;

  if (errorCode === "email_send_failed" || errorCode === "email_update_failed") {
    return errorCode;
  }

  return "email_context_failed";
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
    to: string | null = null
  ): EventEntryEmailDeliveryResult => ({
    entry_id: input.entryId,
    to,
    status: "failed",
    email_sent_at: null,
    error_code: errorCode,
  });

  const { data: entry, error: entryError } = await supabase
    .from("event_order_entries")
    .select("id, event_id, event_order_item_id, status, checkin_token, attendee_name, attendee_last_name, attendee_email")
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
  if (eventEntry.status !== "issued") {
    return failed("entry_not_issuable");
  }

  const attendeeEmail = eventEntry.attendee_email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(attendeeEmail)) {
    return failed("attendee_email_unavailable");
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
    return failed("event_entry_email_failed", attendeeEmail);
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
    return failed("event_entry_email_failed", attendeeEmail);
  }

  const eventRow = event as EventEntryEmailEventRow;
  const itemRow = orderItem as EventEntryEmailItemRow;
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
    return failed("email_send_failed", attendeeEmail);
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
    return failed("email_update_failed", attendeeEmail);
  }

  return {
    entry_id: updatedEntry.id,
    to: attendeeEmail,
    status: "sent",
    email_sent_at: updatedEntry.email_sent_at,
    error_code: null,
  };
}

function summarizeAutomaticEmailDelivery(
  results: EventEntryEmailDeliveryResult[],
  skipped: number,
  reason: EventAutomaticEmailDeliverySummary["reason"]
): EventAutomaticEmailDeliverySummary {
  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const attempted = results.length;
  const status =
    attempted === 0
      ? "skipped"
      : sent === attempted
        ? "sent"
        : sent > 0 && failed > 0
          ? "partial_failed"
          : "failed";

  return {
    mode: "automatic_best_effort",
    attempted,
    sent,
    failed,
    skipped,
    status,
    reason,
    results,
  };
}

async function buildManualIssueEmailDelivery(input: {
  eventId: string;
  orderId: string | null;
  entries: Array<Record<string, unknown>>;
  requestId: string | undefined;
}): Promise<EventAutomaticEmailDeliverySummary> {
  if (input.entries.length === 0) {
    return summarizeAutomaticEmailDelivery([], 0, "no_entries");
  }

  if (input.entries.length > AUTOMATIC_EMAIL_MAX_ENTRIES) {
    return summarizeAutomaticEmailDelivery(
      [],
      input.entries.length,
      "too_many_entries_for_sync_email"
    );
  }

  const results = await mapWithConcurrency(
    input.entries,
    AUTOMATIC_EMAIL_MAX_CONCURRENCY,
    async (entry) => {
      const entryId = getManualIssueEntryId(entry);
      if (!entryId) {
        return {
          entry_id: "",
          to: null,
          status: "failed",
          email_sent_at: null,
          error_code: "email_context_failed",
        } satisfies EventEntryEmailDeliveryResult;
      }

      const result = await sendEventEntryQrEmailForEntry({
        eventId: input.eventId,
        entryId,
        requestId: input.requestId,
        orderId: input.orderId,
      });

      return {
        ...result,
        error_code: toAutomaticEmailErrorCode(result.error_code),
      };
    }
  );

  return summarizeAutomaticEmailDelivery(results, 0, null);
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
      entries: result.data.entries,
      requestId,
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

      if (Object.keys(req.query).length > 0 || hasForbiddenEventCheckinInputKeys(req.body)) {
        return res.status(400).json({
          error: "Invalid check-in input",
          code: "invalid_checkin_input",
        });
      }

      const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
      if (!UUID_PATTERN.test(token)) {
        return res.status(400).json({
          error: "Invalid check-in token",
          code: "invalid_checkin_token",
        });
      }

      const requestId = getRequestId(req);
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
