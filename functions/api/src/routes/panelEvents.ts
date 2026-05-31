import { Request, Response, Router } from "express";
import { eventPanelAuth } from "../middlewares/eventPanelAuth";
import { requireEventRole } from "../middlewares/requireEventRole";
import { eventManualIssueSchema } from "../schemas/eventManualIssue";
import { getRequestId } from "../middlewares/requestId";
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

    return res.status(201).json(result.data);
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
