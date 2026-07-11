import { apiGetWithAuth, apiPostWithAuth } from "./api";

export const ACCESS_PAID_CHECKIN_STATUSES = [
  "valid",
  "used",
  "too_early",
  "expired_window",
  "already_used",
  "voided",
  "not_paid",
  "not_valid_status",
] as const;

export type AccessPaidCheckinStatus = (typeof ACCESS_PAID_CHECKIN_STATUSES)[number];
export type AccessPaidCheckinWarning = "date_warning";

export interface AccessPaidCheckinEntry {
  status: string;
  checkin_status: string;
  used_at?: string | null;
  access_date: string;
  unit_index: number;
  ticket_name: string;
}

export interface AccessPaidCheckinResponse {
  ok: true;
  status: AccessPaidCheckinStatus;
  entry: AccessPaidCheckinEntry;
  attendee: {
    name: string;
    last_name: string;
  };
  order: {
    public_ref: string;
  };
  warnings: AccessPaidCheckinWarning[];
}

export type ParseAccessPaidCheckinTokenResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      error: "empty_input" | "invalid_token";
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCESS_CHECKIN_ROUTE_PATTERN =
  /(?:^|[#/])access\/checkin\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|[/?#])/i;
const MAX_TOKEN_INPUT_LENGTH = 1024;

function normalizeUuid(value: string): string | null {
  const normalized = value.trim();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function extractTokenCandidate(input: string): string | null {
  const directToken = normalizeUuid(input);
  if (directToken) {
    return directToken;
  }

  const routeMatch = input.match(ACCESS_CHECKIN_ROUTE_PATTERN);
  if (routeMatch?.[1]) {
    return normalizeUuid(routeMatch[1]);
  }

  return null;
}

export function parseAccessPaidCheckinToken(input: string): ParseAccessPaidCheckinTokenResult {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return {
      ok: false,
      error: "empty_input",
    };
  }

  if (
    normalizedInput.length > MAX_TOKEN_INPUT_LENGTH ||
    normalizedInput.startsWith("{") ||
    normalizedInput.startsWith("[") ||
    /\s/.test(normalizedInput)
  ) {
    return {
      ok: false,
      error: "invalid_token",
    };
  }

  const token = extractTokenCandidate(normalizedInput);
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

export function getAccessPaidCheckinStatusLabel(status: AccessPaidCheckinStatus): string {
  switch (status) {
    case "valid":
      return "Lista para validar";
    case "used":
      return "Entrada validada correctamente";
    case "too_early":
      return "Esta entrada todavía no está habilitada";
    case "expired_window":
      return "La ventana de validación ya finalizó";
    case "already_used":
      return "Esta entrada ya fue utilizada";
    case "voided":
      return "Esta entrada fue anulada";
    case "not_paid":
      return "El pago de esta entrada no está confirmado";
    case "not_valid_status":
      return "Esta entrada no está disponible para validación";
  }
}

export async function lookupAccessEntryByToken(
  token: string
): Promise<AccessPaidCheckinResponse> {
  const normalizedToken = normalizeUuid(token);
  if (!normalizedToken) {
    throw new Error("token must be a valid UUID");
  }

  return apiGetWithAuth<AccessPaidCheckinResponse>(
    `/panel/access/checkin/${encodeURIComponent(normalizedToken)}`
  );
}

export async function useAccessEntryByToken(
  token: string
): Promise<AccessPaidCheckinResponse> {
  const normalizedToken = normalizeUuid(token);
  if (!normalizedToken) {
    throw new Error("token must be a valid UUID");
  }

  return apiPostWithAuth<AccessPaidCheckinResponse>(
    `/panel/access/checkin/${encodeURIComponent(normalizedToken)}/use`,
    {}
  );
}
