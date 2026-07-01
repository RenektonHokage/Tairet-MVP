import { ApiError, apiGetWithAuth, apiPatchWithAuth, apiPostWithAuth, getApiBase, getAuthHeaders } from "./api";

export type AccessStockMode = "unlimited" | "limited";
export type AccessStockStatus = "unconfigured" | "configured" | "sold_out";

export interface AccessTicketType {
  id: string;
  name: string;
  description: string | null;
  price_gs: number;
  currency: "PYG" | string;
  payment_kind: "paid" | string;
  entries_per_unit: number;
  active: boolean;
  sort_order: number;
  has_sales: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccessStockLimit {
  id: string | null;
  access_ticket_type_id: string;
  ticket_name: string;
  access_date: string;
  stock_mode: AccessStockMode | null;
  capacity: number | null;
  sold_or_reserved_count: number;
  available_count: number | null;
  status: AccessStockStatus;
}

export interface AccessDateRange {
  from: string;
  to: string;
}

export interface AccessTicketTypesResponse {
  ok: true;
  ticketTypes: AccessTicketType[];
}

export interface AccessTicketTypeResponse {
  ok: true;
  ticketType: AccessTicketType;
}

export interface AccessStockLimitsResponse {
  ok: true;
  stockLimits: AccessStockLimit[];
  dateRange: AccessDateRange;
}

export interface AccessStockLimitResponse {
  ok: true;
  stockLimit: AccessStockLimit;
}

export interface CreateAccessTicketTypeInput {
  name: string;
  description?: string | null;
  price_gs: number;
  active: boolean;
  sort_order?: number;
}

export interface UpdateAccessTicketTypeInput {
  name?: string;
  description?: string | null;
  price_gs?: number;
  active?: boolean;
  sort_order?: number;
}

export interface GetAccessStockLimitsParams {
  date?: string;
  from?: string;
  to?: string;
}

export interface UpsertAccessStockLimitInput {
  access_ticket_type_id: string;
  access_date: string;
  stock_mode: AccessStockMode;
  capacity: number | null;
}

function appendStringParam(params: URLSearchParams, key: string, value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) {
    params.set(key, normalized);
  }
}

async function apiPutWithAuth<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "PUT",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message =
      details &&
      typeof details === "object" &&
      "error" in details &&
      typeof (details as { error?: unknown }).error === "string"
        ? (details as { error: string }).error
        : `API Error: ${response.statusText}`;

    throw new ApiError(response.status, message, details);
  }

  return response.json();
}

export async function getAccessTicketTypes(): Promise<AccessTicketTypesResponse> {
  return apiGetWithAuth<AccessTicketTypesResponse>("/panel/access/ticket-types");
}

export async function createAccessTicketType(
  input: CreateAccessTicketTypeInput
): Promise<AccessTicketTypeResponse> {
  return apiPostWithAuth<AccessTicketTypeResponse>("/panel/access/ticket-types", input);
}

export async function updateAccessTicketType(
  id: string,
  input: UpdateAccessTicketTypeInput
): Promise<AccessTicketTypeResponse> {
  const normalizedId = id.trim().toLowerCase();
  if (!normalizedId) {
    throw new Error("id is required");
  }

  return apiPatchWithAuth<AccessTicketTypeResponse>(
    `/panel/access/ticket-types/${encodeURIComponent(normalizedId)}`,
    input
  );
}

export async function getAccessStockLimits(
  input: GetAccessStockLimitsParams = {}
): Promise<AccessStockLimitsResponse> {
  const params = new URLSearchParams();
  appendStringParam(params, "date", input.date);
  appendStringParam(params, "from", input.from);
  appendStringParam(params, "to", input.to);

  const query = params.toString();
  return apiGetWithAuth<AccessStockLimitsResponse>(
    `/panel/access/stock-limits${query ? `?${query}` : ""}`
  );
}

export async function upsertAccessStockLimit(
  input: UpsertAccessStockLimitInput
): Promise<AccessStockLimitResponse> {
  return apiPutWithAuth<AccessStockLimitResponse>("/panel/access/stock-limits", input);
}
