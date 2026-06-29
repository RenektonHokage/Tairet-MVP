import { getApiBase } from "@/lib/api";

export type AccessBancardSingleBuyErrorCode =
  | "invalid_request"
  | "quantity_limit_exceeded"
  | "idempotency_conflict"
  | "checkout_in_progress"
  | "checkout_failed"
  | "stock_unconfigured"
  | "sold_out"
  | "bancard_config_missing"
  | "bancard_http_error"
  | "bancard_timeout"
  | "bancard_ambiguous"
  | "internal_error";

export interface AccessBancardSingleBuyRequest {
  source_type: "local";
  local_id: string;
  event_id: null;
  access_date: string;
  buyer: {
    name: string;
    last_name: string;
    email: string;
    phone: string;
    document: string;
  };
  items: Array<{
    access_ticket_type_id: string;
    quantity: number;
  }>;
  idempotency_key: string;
}

export interface AccessBancardSingleBuySuccess {
  ok: true;
  public_ref: string;
  expires_at: string;
  amount_gs: number;
  currency: "PYG";
  provider_amount_text: string;
  provider: "bancard";
  provider_operation: "single_buy";
  shop_process_id: string;
  process_id: string;
  iframe: {
    public_key: string;
    process_id: string;
  };
}

interface AccessBancardSingleBuyErrorBody {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
}

export class AccessBancardSingleBuyError extends Error {
  code: AccessBancardSingleBuyErrorCode;
  status: number;

  constructor(code: AccessBancardSingleBuyErrorCode, status: number) {
    super(code);
    this.name = "AccessBancardSingleBuyError";
    this.code = code;
    this.status = status;
  }
}

const ACCESS_BANCARD_ERROR_CODES = new Set<AccessBancardSingleBuyErrorCode>([
  "invalid_request",
  "quantity_limit_exceeded",
  "idempotency_conflict",
  "checkout_in_progress",
  "checkout_failed",
  "stock_unconfigured",
  "sold_out",
  "bancard_config_missing",
  "bancard_http_error",
  "bancard_timeout",
  "bancard_ambiguous",
  "internal_error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isAccessBancardSingleBuySuccess(value: unknown): value is AccessBancardSingleBuySuccess {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.iframe)) {
    return false;
  }

  return (
    typeof value.public_ref === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.amount_gs === "number" &&
    value.currency === "PYG" &&
    typeof value.provider_amount_text === "string" &&
    value.provider === "bancard" &&
    value.provider_operation === "single_buy" &&
    typeof value.shop_process_id === "string" &&
    typeof value.process_id === "string" &&
    typeof value.iframe.public_key === "string" &&
    typeof value.iframe.process_id === "string"
  );
}

function readAccessBancardErrorCode(value: unknown): AccessBancardSingleBuyErrorCode {
  if (!isRecord(value)) return "internal_error";

  const payload = value as AccessBancardSingleBuyErrorBody;
  const code = payload.error?.code;
  if (code && ACCESS_BANCARD_ERROR_CODES.has(code as AccessBancardSingleBuyErrorCode)) {
    return code as AccessBancardSingleBuyErrorCode;
  }

  return "internal_error";
}

export function getAccessBancardSingleBuyErrorMessage(
  code: AccessBancardSingleBuyErrorCode
): string {
  switch (code) {
    case "sold_out":
      return "Ya no quedan entradas disponibles para esta selección.";
    case "stock_unconfigured":
      return "Esta entrada todavía no está disponible para compra online.";
    case "quantity_limit_exceeded":
      return "La cantidad seleccionada supera el límite permitido.";
    case "checkout_in_progress":
      return "Ya hay un intento de pago en curso. Esperá unos segundos e intentá nuevamente.";
    case "bancard_timeout":
    case "bancard_ambiguous":
      return "No pudimos confirmar el inicio del checkout. Si el problema continúa, intentá nuevamente.";
    default:
      return "No pudimos iniciar el pago. Intentá nuevamente.";
  }
}

export async function createAccessBancardSingleBuy(
  input: AccessBancardSingleBuyRequest
): Promise<AccessBancardSingleBuySuccess> {
  const response = await fetch(`${getApiBase()}/payments/access/bancard/single-buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new AccessBancardSingleBuyError(readAccessBancardErrorCode(payload), response.status);
  }

  if (!isAccessBancardSingleBuySuccess(payload)) {
    throw new AccessBancardSingleBuyError("internal_error", response.status);
  }

  return payload;
}
