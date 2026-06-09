import {
  ApiError,
  apiGetWithAuth,
  apiPostWithAuth,
  getApiBase,
  getAuthHeaders,
} from "./api";

export type EventEntryStatus = "issued" | "voided";
export type EventEntryCheckinStatus = "unused" | "used";
export type EventEntrySalesUnitType = "single_entry" | "package" | (string & {});
export type EventEntriesSort = "created_at_desc" | "created_at_asc";
export type EventEntryBadgeVariant = "neutral" | "success" | "warn" | "danger";

export interface EventEntry {
  id: string;
  event_order_id: string;
  event_order_item_id: string;
  ticket_type_id: string;
  ticket_name: string;
  sales_unit_type: EventEntrySalesUnitType;
  status: EventEntryStatus;
  checkin_status: EventEntryCheckinStatus;
  unit_price_amount: number;
  currency: string;
  created_at: string;
  used_at: string | null;
}

export interface EventEntryAttendee {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document: string;
}

export interface EventEntryBuyer {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document: string;
}

export interface EventEntryOrder {
  id: string;
  total_amount: number;
  currency: string;
  source: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export interface EventEntryItem {
  id: string;
  quantity: number;
  entries_per_unit: number;
  total_amount: number;
}

export interface EventEntryListItem {
  entry: EventEntry;
  attendee: EventEntryAttendee;
  buyer: EventEntryBuyer;
  order: EventEntryOrder;
  item: EventEntryItem;
}

export interface EventEntriesPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface EventEntriesResponse {
  items: EventEntryListItem[];
  pagination: EventEntriesPagination;
}

export interface GetEventEntriesInput {
  eventId: string;
  q?: string | null;
  ticketTypeId?: string | null;
  status?: EventEntryStatus | null;
  checkinStatus?: EventEntryCheckinStatus | null;
  page?: number | null;
  pageSize?: number | null;
  sort?: EventEntriesSort | null;
}

export interface SendEventEntryQrEmailInput {
  eventId: string;
  entryId: string;
}

export interface SendEventEntryQrEmailResponse {
  ok: boolean;
  entry: {
    id: string;
    email_sent_at: string | null;
  };
  email: {
    status: "sent" | (string & {});
    to?: string | null;
  };
}

export interface EventEntryQrInput {
  eventId: string;
  entryId: string;
}

export const EVENT_ENTRY_STATUS_LABELS: Record<EventEntryStatus, string> = {
  issued: "Emitida",
  voided: "Anulada",
};

export const EVENT_ENTRY_CHECKIN_STATUS_LABELS: Record<EventEntryCheckinStatus, string> = {
  unused: "No usada",
  used: "Usada",
};

export const EVENT_ENTRY_PAYMENT_STATUS_LABELS: Record<string, string> = {
  confirmed_externally: "Confirmada externamente",
};

export const EVENT_ENTRY_SOURCE_LABELS: Record<string, string> = {
  manual_issue: "Emisión manual",
};

export const EVENT_ENTRY_SALES_UNIT_TYPE_LABELS: Record<string, string> = {
  single_entry: "Entrada",
  package: "Paquete/Mesa",
};

const EVENT_ENTRY_STATUS_BADGE_VARIANTS: Record<EventEntryStatus, EventEntryBadgeVariant> = {
  issued: "success",
  voided: "danger",
};

const EVENT_ENTRY_CHECKIN_STATUS_BADGE_VARIANTS: Record<
  EventEntryCheckinStatus,
  EventEntryBadgeVariant
> = {
  unused: "neutral",
  used: "success",
};

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

function appendSearchQuery(params: URLSearchParams, value: string | null | undefined) {
  if (value === null || value === undefined) {
    return;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length < 2) {
    return;
  }

  params.set("q", normalizedValue);
}

function requireNormalizedId(value: string, fieldName: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  return normalizedValue;
}

function getErrorMessage(details: unknown, fallbackMessage: string): string {
  if (
    details &&
    typeof details === "object" &&
    "error" in details &&
    typeof (details as { error?: unknown }).error === "string"
  ) {
    return (details as { error: string }).error;
  }

  return fallbackMessage;
}

async function throwQrApiError(response: Response): Promise<never> {
  const details = await response.json().catch(() => null);
  throw new ApiError(
    response.status,
    getErrorMessage(details, `API Error: ${response.statusText}`),
    details
  );
}

function getKnownLabel(labels: Record<string, string>, value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return labels[value] ?? value;
}

export function getEventEntryStatusLabel(status: EventEntryStatus): string {
  return EVENT_ENTRY_STATUS_LABELS[status] ?? status;
}

export function getEventEntryCheckinStatusLabel(status: EventEntryCheckinStatus): string {
  return EVENT_ENTRY_CHECKIN_STATUS_LABELS[status] ?? status;
}

export function getEventEntryPaymentStatusLabel(status: string | null | undefined): string {
  return getKnownLabel(EVENT_ENTRY_PAYMENT_STATUS_LABELS, status);
}

export function getEventEntrySourceLabel(source: string | null | undefined): string {
  return getKnownLabel(EVENT_ENTRY_SOURCE_LABELS, source);
}

export function getEventEntrySalesUnitTypeLabel(
  salesUnitType: EventEntrySalesUnitType | null | undefined
): string {
  return getKnownLabel(EVENT_ENTRY_SALES_UNIT_TYPE_LABELS, salesUnitType);
}

export function getEventEntryStatusBadgeVariant(
  status: EventEntryStatus
): EventEntryBadgeVariant {
  return EVENT_ENTRY_STATUS_BADGE_VARIANTS[status] ?? "neutral";
}

export function getEventEntryCheckinStatusBadgeVariant(
  status: EventEntryCheckinStatus
): EventEntryBadgeVariant {
  return EVENT_ENTRY_CHECKIN_STATUS_BADGE_VARIANTS[status] ?? "neutral";
}

export async function getEventEntries(
  input: GetEventEntriesInput
): Promise<EventEntriesResponse> {
  const eventId = requireNormalizedId(input.eventId, "eventId");
  const params = new URLSearchParams();

  appendSearchQuery(params, input.q);
  appendSearchParam(params, "ticket_type_id", input.ticketTypeId);
  appendSearchParam(params, "status", input.status);
  appendSearchParam(params, "checkin_status", input.checkinStatus);
  appendSearchParam(params, "page", input.page);
  appendSearchParam(params, "page_size", input.pageSize);
  appendSearchParam(params, "sort", input.sort);

  const query = params.toString();
  const path = `/panel/events/${encodeURIComponent(eventId)}/entries${
    query ? `?${query}` : ""
  }`;

  return apiGetWithAuth<EventEntriesResponse>(path);
}

export async function sendEventEntryQrEmail(
  input: SendEventEntryQrEmailInput
): Promise<SendEventEntryQrEmailResponse> {
  const eventId = requireNormalizedId(input.eventId, "eventId");
  const entryId = requireNormalizedId(input.entryId, "entryId");
  const path = `/panel/events/${encodeURIComponent(eventId)}/entries/${encodeURIComponent(
    entryId
  )}/send-email`;

  return apiPostWithAuth<SendEventEntryQrEmailResponse>(path, {});
}

export async function getEventEntryQrBlob(input: EventEntryQrInput): Promise<Blob> {
  const eventId = requireNormalizedId(input.eventId, "eventId");
  const entryId = requireNormalizedId(input.entryId, "entryId");
  const path = `/panel/events/${encodeURIComponent(eventId)}/entries/${encodeURIComponent(
    entryId
  )}/qr`;
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "GET",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    await throwQrApiError(response);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/png")) {
    throw new ApiError(500, "Unexpected QR image response", {
      content_type: contentType,
    });
  }

  return response.blob();
}
