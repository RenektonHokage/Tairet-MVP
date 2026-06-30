import { apiGetWithAuth, apiPostWithAuth } from "./api";

export type AccessEntryStatusFilter = "issued" | "voided";
export type AccessEntryCheckinStatusFilter = "unused" | "used";
export type AccessEntryEmailStatus = "not_sent" | "sent" | "failed";

export interface AccessEntryListItem {
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
  email_status: AccessEntryEmailStatus | string;
  created_at: string;
}

export interface AccessEntriesResponse {
  ok: true;
  entries: AccessEntryListItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface UseAccessEntryResponse {
  ok: true;
  entry: AccessEntryListItem;
}

export interface GetAccessEntriesParams {
  date?: string;
  entryStatus?: AccessEntryStatusFilter | "";
  checkinStatus?: AccessEntryCheckinStatusFilter | "";
  q?: string;
  limit?: number;
  offset?: number;
}

function appendStringParam(params: URLSearchParams, key: string, value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) {
    params.set(key, normalized);
  }
}

function appendNumberParam(params: URLSearchParams, key: string, value: number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    params.set(key, String(value));
  }
}

export async function getAccessEntries(
  input: GetAccessEntriesParams = {}
): Promise<AccessEntriesResponse> {
  const params = new URLSearchParams();

  appendStringParam(params, "date", input.date);
  appendStringParam(params, "entry_status", input.entryStatus || undefined);
  appendStringParam(params, "checkin_status", input.checkinStatus || undefined);
  appendStringParam(params, "q", input.q);
  appendNumberParam(params, "limit", input.limit);
  appendNumberParam(params, "offset", input.offset);

  const query = params.toString();
  return apiGetWithAuth<AccessEntriesResponse>(
    `/panel/access/entries${query ? `?${query}` : ""}`
  );
}

export async function useAccessEntry(entryId: string): Promise<UseAccessEntryResponse> {
  const normalizedEntryId = entryId.trim().toLowerCase();
  if (!normalizedEntryId) {
    throw new Error("entryId is required");
  }

  return apiPostWithAuth<UseAccessEntryResponse>(
    `/panel/access/entries/${encodeURIComponent(normalizedEntryId)}/use`,
    {}
  );
}
