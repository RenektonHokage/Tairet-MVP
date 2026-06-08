import { apiGetWithAuth } from "./api";

export const EVENT_ACTIVITY_ACTIONS = [
  "event_order_manual_issued",
  "event_entry_issued",
  "event_entry_email_sent",
  "event_entry_email_failed",
  "event_entry_checked_in",
  "event_entry_already_used_attempt",
  "event_entry_outside_window_attempt",
  "event_entry_voided_attempt",
  "event_entry_invalid_token_attempt",
] as const;

export type EventActivityAction = (typeof EVENT_ACTIVITY_ACTIONS)[number];

export const EVENT_ACTIVITY_SOURCES = [
  "manual",
  "qr",
  "automatic_email",
  "manual_email",
  "system",
] as const;

export type EventActivitySource = (typeof EVENT_ACTIVITY_SOURCES)[number];

export const EVENT_ACTIVITY_ENTITY_TYPES = [
  "event_order",
  "event_order_entry",
  "event_email",
  "event_checkin",
] as const;

export type EventActivityEntityType = (typeof EVENT_ACTIVITY_ENTITY_TYPES)[number];

export type EventActivitySort = "created_at_desc" | "created_at_asc";

export type EventActivityCategory =
  | "emision"
  | "email"
  | "checkin"
  | "intento_rechazo"
  | "sistema";

export type EventActivityBadgeVariant = "neutral" | "success" | "warn" | "danger";

export interface EventActivityActor {
  type: "event_panel_user" | "system" | (string & {});
  role: "owner" | "staff" | null;
  label: string;
}

export interface EventActivityRelations {
  event_order_id: string | null;
  event_order_item_id: string | null;
  event_order_entry_id: string | null;
  event_ticket_type_id: string | null;
}

export type EventActivityMetadataKey =
  | "reason_code"
  | "previous_status"
  | "next_status"
  | "previous_checkin_status"
  | "next_checkin_status"
  | "email_status"
  | "email_error_code"
  | "delivery_mode"
  | "email_attempts"
  | "bundle_entries_count"
  | "entries_count"
  | "sent_count"
  | "failed_count"
  | "skipped_count"
  | "ticket_name"
  | "sales_unit_type"
  | "entries_per_unit"
  | "currency"
  | "total_amount";

export type EventActivityMetadataValue = string | number | boolean | null;

export type EventActivityMetadata = Partial<
  Record<EventActivityMetadataKey, EventActivityMetadataValue>
>;

export interface EventActivityItem {
  id: string;
  created_at: string;
  action: EventActivityAction;
  source: EventActivitySource | null;
  entity_type: EventActivityEntityType;
  entity_id: string | null;
  message: string;
  actor: EventActivityActor;
  relations: EventActivityRelations;
  metadata: EventActivityMetadata;
}

export interface EventActivityPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface EventActivityResponse {
  items: EventActivityItem[];
  pagination: EventActivityPagination;
}

export interface GetEventActivityInput {
  eventId: string;
  action?: EventActivityAction | null;
  source?: EventActivitySource | null;
  entityType?: EventActivityEntityType | null;
  eventOrderId?: string | null;
  eventOrderEntryId?: string | null;
  eventTicketTypeId?: string | null;
  page?: number | null;
  pageSize?: number | null;
  sort?: EventActivitySort | null;
}

export const EVENT_ACTIVITY_ACTION_LABELS: Record<EventActivityAction, string> = {
  event_order_manual_issued: "Orden manual emitida",
  event_entry_issued: "Entrada emitida",
  event_entry_email_sent: "Email de QR enviado",
  event_entry_email_failed: "Fallo al enviar email de QR",
  event_entry_checked_in: "Entrada validada",
  event_entry_already_used_attempt: "Intento sobre entrada ya usada",
  event_entry_outside_window_attempt: "Intento fuera de ventana",
  event_entry_voided_attempt: "Intento sobre entrada anulada",
  event_entry_invalid_token_attempt: "Intento con QR inválido",
};

export const EVENT_ACTIVITY_SOURCE_LABELS: Record<EventActivitySource, string> = {
  manual: "Manual",
  qr: "QR",
  automatic_email: "Email automático",
  manual_email: "Email manual",
  system: "Sistema",
};

export const EVENT_ACTIVITY_ENTITY_TYPE_LABELS: Record<EventActivityEntityType, string> = {
  event_order: "Orden",
  event_order_entry: "Entrada",
  event_email: "Email",
  event_checkin: "Check-in",
};

export const EVENT_ACTIVITY_CATEGORY_LABELS: Record<EventActivityCategory, string> = {
  emision: "Emisión",
  email: "Email",
  checkin: "Check-in",
  intento_rechazo: "Intento/rechazo",
  sistema: "Sistema",
};

const EVENT_ACTIVITY_ACTION_CATEGORIES: Record<EventActivityAction, EventActivityCategory> = {
  event_order_manual_issued: "emision",
  event_entry_issued: "emision",
  event_entry_email_sent: "email",
  event_entry_email_failed: "email",
  event_entry_checked_in: "checkin",
  event_entry_already_used_attempt: "intento_rechazo",
  event_entry_outside_window_attempt: "intento_rechazo",
  event_entry_voided_attempt: "intento_rechazo",
  event_entry_invalid_token_attempt: "intento_rechazo",
};

const EVENT_ACTIVITY_CATEGORY_BADGE_VARIANTS: Record<
  EventActivityCategory,
  EventActivityBadgeVariant
> = {
  emision: "neutral",
  email: "success",
  checkin: "success",
  intento_rechazo: "warn",
  sistema: "neutral",
};

export function getEventActivityActionLabel(action: EventActivityAction): string {
  return EVENT_ACTIVITY_ACTION_LABELS[action];
}

export function getEventActivitySourceLabel(source: EventActivitySource | null): string {
  return source ? EVENT_ACTIVITY_SOURCE_LABELS[source] : "Sistema";
}

export function getEventActivityEntityTypeLabel(
  entityType: EventActivityEntityType
): string {
  return EVENT_ACTIVITY_ENTITY_TYPE_LABELS[entityType];
}

export function getEventActivityCategory(
  action: EventActivityAction,
  source?: EventActivitySource | null
): EventActivityCategory {
  if (source === "system") {
    return "sistema";
  }

  return EVENT_ACTIVITY_ACTION_CATEGORIES[action];
}

export function getEventActivityCategoryLabel(category: EventActivityCategory): string {
  return EVENT_ACTIVITY_CATEGORY_LABELS[category];
}

export function getEventActivityBadgeVariant(
  action: EventActivityAction,
  source?: EventActivitySource | null
): EventActivityBadgeVariant {
  if (action === "event_entry_email_failed") {
    return "danger";
  }

  return EVENT_ACTIVITY_CATEGORY_BADGE_VARIANTS[
    getEventActivityCategory(action, source)
  ];
}

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) {
    return;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return;
  }

  params.set(key, normalizedValue);
}

export async function getEventActivity(
  input: GetEventActivityInput
): Promise<EventActivityResponse> {
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required");
  }

  const params = new URLSearchParams();
  appendSearchParam(params, "action", input.action);
  appendSearchParam(params, "source", input.source);
  appendSearchParam(params, "entity_type", input.entityType);
  appendSearchParam(params, "event_order_id", input.eventOrderId);
  appendSearchParam(params, "event_order_entry_id", input.eventOrderEntryId);
  appendSearchParam(params, "event_ticket_type_id", input.eventTicketTypeId);
  appendSearchParam(params, "page", input.page);
  appendSearchParam(params, "page_size", input.pageSize);
  appendSearchParam(params, "sort", input.sort);

  const query = params.toString();
  const path = `/panel/events/${encodeURIComponent(eventId)}/activity${
    query ? `?${query}` : ""
  }`;

  return apiGetWithAuth<EventActivityResponse>(path);
}
