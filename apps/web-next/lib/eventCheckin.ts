import { apiPatchWithAuth } from "./api";

export const EVENT_CHECKIN_STATUSES = [
  "valid",
  "already_used",
  "invalid",
  "outside_window",
  "voided",
  "not_valid_status",
  "event_not_operable",
] as const;

export type EventCheckinStatus = (typeof EVENT_CHECKIN_STATUSES)[number];
export type EventCheckinBadgeVariant = "neutral" | "success" | "warn" | "danger";

export interface EventCheckinEntry {
  id: string;
  ticket_name: string | null;
  status?: string | null;
  checkin_status: string | null;
  used_at: string | null;
}

export interface EventCheckinAttendee {
  name: string | null;
  last_name: string | null;
  document: string | null;
}

export interface EventCheckinEvent {
  id: string;
  title: string | null;
  status?: string | null;
}

export interface EventCheckinError {
  code?: string;
  message?: string;
}

export interface EventCheckinResponse {
  ok: boolean;
  status?: EventCheckinStatus;
  entry: EventCheckinEntry | null;
  attendee: EventCheckinAttendee | null;
  event: EventCheckinEvent | null;
  error?: EventCheckinError;
}

export interface CheckInEventEntryByTokenInput {
  eventId: string;
  token: string;
}

export interface CheckInEventEntryManuallyInput {
  eventId: string;
  entryId: string;
}

export type ParseEventCheckinTokenResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      error: "empty_input" | "invalid_token";
    };

export const EVENT_CHECKIN_STATUS_LABELS: Record<EventCheckinStatus, string> = {
  valid: "Entrada validada",
  already_used: "Entrada ya utilizada",
  invalid: "QR inválido",
  outside_window: "Fuera de la ventana de validación",
  voided: "Entrada anulada",
  not_valid_status: "Entrada no válida para check-in",
  event_not_operable: "Evento no habilitado para check-in",
};

const EVENT_CHECKIN_STATUS_VARIANTS: Record<
  EventCheckinStatus,
  EventCheckinBadgeVariant
> = {
  valid: "success",
  already_used: "warn",
  invalid: "danger",
  outside_window: "warn",
  voided: "danger",
  not_valid_status: "warn",
  event_not_operable: "warn",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN_INPUT_LENGTH = 512;

function requireNormalizedId(value: string, fieldName: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  return normalizedValue;
}

function normalizeUuid(value: string): string | null {
  const normalizedValue = value.trim();
  if (!UUID_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizedValue.toLowerCase();
}

function looksLikeUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function extractTokenCandidateFromUrl(value: string): string | null {
  try {
    const parsedUrl = new URL(value);
    const lastPathSegment = parsedUrl.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .at(-1);

    return lastPathSegment ?? null;
  } catch {
    return null;
  }
}

function hasUnsafeTokenInputShape(value: string): boolean {
  return (
    value.length > MAX_TOKEN_INPUT_LENGTH ||
    value.startsWith("{") ||
    value.startsWith("[") ||
    /\s/.test(value)
  );
}

export function parseEventCheckinToken(input: string): ParseEventCheckinTokenResult {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return {
      ok: false,
      error: "empty_input",
    };
  }

  if (hasUnsafeTokenInputShape(normalizedInput)) {
    return {
      ok: false,
      error: "invalid_token",
    };
  }

  const tokenCandidate = looksLikeUrl(normalizedInput)
    ? extractTokenCandidateFromUrl(normalizedInput)
    : normalizedInput;
  if (!tokenCandidate) {
    return {
      ok: false,
      error: "invalid_token",
    };
  }

  const token = normalizeUuid(tokenCandidate);
  if (!token) {
    return {
      ok: false,
      error: "invalid_token",
    };
  }

  return {
    ok: true,
    token,
  };
}

export function getEventCheckinStatusLabel(status: EventCheckinStatus): string {
  return EVENT_CHECKIN_STATUS_LABELS[status];
}

export function getEventCheckinStatusVariant(
  status: EventCheckinStatus
): EventCheckinBadgeVariant {
  return EVENT_CHECKIN_STATUS_VARIANTS[status];
}

export async function checkInEventEntryByToken(
  input: CheckInEventEntryByTokenInput
): Promise<EventCheckinResponse> {
  const eventId = requireNormalizedId(input.eventId, "eventId");
  const token = normalizeUuid(input.token);
  if (!token) {
    throw new Error("token must be a valid UUID");
  }

  const path = `/panel/events/${encodeURIComponent(eventId)}/checkin/${encodeURIComponent(
    token
  )}`;

  return apiPatchWithAuth<EventCheckinResponse>(path);
}

export async function checkInEventEntryManually(
  input: CheckInEventEntryManuallyInput
): Promise<EventCheckinResponse> {
  const eventId = requireNormalizedId(input.eventId, "eventId");
  const entryId = normalizeUuid(input.entryId);
  if (!entryId) {
    throw new Error("entryId must be a valid UUID");
  }

  const path = `/panel/events/${encodeURIComponent(eventId)}/entries/${encodeURIComponent(
    entryId
  )}/use`;

  return apiPatchWithAuth<EventCheckinResponse>(path);
}
