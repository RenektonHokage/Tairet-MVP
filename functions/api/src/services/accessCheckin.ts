import { createHash } from "node:crypto";
import { supabase } from "./supabase";

export type AccessCheckinBusinessStatus = "valid" | "already_used" | "voided" | "not_paid" | "not_valid_status";
export type AccessCheckinUseBusinessStatus = "used" | "already_used" | "voided" | "not_paid" | "not_valid_status";
export type AccessCheckinWarning = "date_warning";

interface AccessEntryRow {
  order_id: string;
  order_item_id: string;
  status: string;
  checkin_status: string;
  access_date: string;
  unit_index: number;
  attendee_name: string;
  attendee_last_name: string;
}

interface AccessOrderRow {
  public_ref: string;
  source_type: string;
  local_id: string | null;
  status: string;
}

interface AccessOrderItemRow {
  name_snapshot: string;
}

export interface AccessCheckinPanelUser {
  userId: string;
  localId: string;
  role: string;
}

export interface AccessCheckinLogContext {
  tokenHash: string;
  publicRef?: string;
  sourceType?: string;
  localId?: string | null;
  status?: string;
  checkinStatus?: string;
  usedAt?: string | null;
  panelUserId: string;
  role: string;
  errorCode?: string;
}

export interface AccessCheckinEntryResponse {
  status: string;
  checkin_status: string;
  used_at?: string | null;
  access_date: string;
  unit_index: number;
  ticket_name: string;
}

export interface AccessCheckinLookupSuccess {
  ok: true;
  status: AccessCheckinBusinessStatus;
  entry: AccessCheckinEntryResponse;
  attendee: {
    name: string;
    last_name: string;
  };
  order: {
    public_ref: string;
  };
  warnings: AccessCheckinWarning[];
  logContext: AccessCheckinLogContext;
}

export interface AccessCheckinLookupFailure {
  ok: false;
  statusCode: 404 | 500;
  error: {
    code: "entry_not_found" | "checkin_lookup_failed";
    message: string;
  };
  logContext: AccessCheckinLogContext;
}

export type AccessCheckinLookupResult = AccessCheckinLookupSuccess | AccessCheckinLookupFailure;

export interface AccessCheckinUseSuccess {
  ok: true;
  status: AccessCheckinUseBusinessStatus;
  entry: AccessCheckinEntryResponse;
  attendee: {
    name: string;
    last_name: string;
  };
  order: {
    public_ref: string;
  };
  warnings: AccessCheckinWarning[];
  logContext: AccessCheckinLogContext;
}

export interface AccessCheckinUseFailure {
  ok: false;
  statusCode: 400 | 403 | 404 | 500;
  error: {
    code: "invalid_request" | "forbidden" | "entry_not_found" | "checkin_use_failed";
    message: string;
  };
  logContext: AccessCheckinLogContext;
}

export type AccessCheckinUseResult = AccessCheckinUseSuccess | AccessCheckinUseFailure;

function formatAsuncionDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function accessCheckinTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function buildAccessCheckinWarnings(accessDate: string, now?: Date): AccessCheckinWarning[] {
  return accessDate !== formatAsuncionDate(now ?? new Date()) ? ["date_warning"] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readNestedErrorCode(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.error)) return null;
  return typeof data.error.code === "string" ? data.error.code : null;
}

function readNestedErrorMessage(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.error)) return null;
  return typeof data.error.message === "string" ? data.error.message : null;
}

const ACCESS_CHECKIN_USE_STATUSES: readonly AccessCheckinUseBusinessStatus[] = [
  "used",
  "already_used",
  "voided",
  "not_paid",
  "not_valid_status",
];

function isAccessCheckinUseStatus(value: unknown): value is AccessCheckinUseBusinessStatus {
  return (
    typeof value === "string" &&
    ACCESS_CHECKIN_USE_STATUSES.includes(value as AccessCheckinUseBusinessStatus)
  );
}

function readAccessCheckinEntryResponse(value: unknown): AccessCheckinEntryResponse | null {
  if (!isRecord(value)) return null;

  const { status, checkin_status, used_at, access_date, unit_index, ticket_name } = value;
  if (
    typeof status !== "string" ||
    typeof checkin_status !== "string" ||
    typeof access_date !== "string" ||
    typeof unit_index !== "number" ||
    typeof ticket_name !== "string"
  ) {
    return null;
  }

  if (used_at !== undefined && used_at !== null && typeof used_at !== "string") {
    return null;
  }

  return {
    status,
    checkin_status,
    used_at: used_at ?? null,
    access_date,
    unit_index,
    ticket_name,
  };
}

function readAccessCheckinAttendee(value: unknown): { name: string; last_name: string } | null {
  if (!isRecord(value)) return null;
  const { name, last_name } = value;
  if (typeof name !== "string" || typeof last_name !== "string") return null;
  return { name, last_name };
}

function readAccessCheckinOrder(value: unknown): { public_ref: string } | null {
  if (!isRecord(value)) return null;
  const { public_ref } = value;
  if (typeof public_ref !== "string") return null;
  return { public_ref };
}

function buildNotFoundResult(
  token: string,
  panelUser: AccessCheckinPanelUser,
  context?: Partial<AccessCheckinLogContext>
): AccessCheckinLookupFailure {
  return {
    ok: false,
    statusCode: 404,
    error: {
      code: "entry_not_found",
      message: "Access entry not found",
    },
    logContext: {
      tokenHash: accessCheckinTokenHash(token),
      panelUserId: panelUser.userId,
      role: panelUser.role,
      errorCode: "entry_not_found",
      ...context,
    },
  };
}

function deriveAccessCheckinStatus(entry: AccessEntryRow, order: AccessOrderRow): AccessCheckinBusinessStatus {
  if (entry.status === "voided") {
    return "voided";
  }

  if (order.status !== "paid") {
    return "not_paid";
  }

  if (entry.status === "issued" && entry.checkin_status === "unused") {
    return "valid";
  }

  if (entry.status === "issued" && entry.checkin_status === "used") {
    return "already_used";
  }

  return "not_valid_status";
}

export async function lookupAccessCheckinByToken(input: {
  token: string;
  panelUser: AccessCheckinPanelUser;
  now?: Date;
}): Promise<AccessCheckinLookupResult> {
  const { token, panelUser } = input;
  const baseLogContext: AccessCheckinLogContext = {
    tokenHash: accessCheckinTokenHash(token),
    localId: panelUser.localId,
    panelUserId: panelUser.userId,
    role: panelUser.role,
  };

  const { data: entryData, error: entryError } = await supabase
    .from("access_entries")
    .select(
      "order_id, order_item_id, status, checkin_status, access_date, unit_index, attendee_name, attendee_last_name"
    )
    .eq("checkin_token", token)
    .maybeSingle();

  if (entryError) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_lookup_failed",
        message: "Access check-in lookup failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode: "entry_lookup_failed",
      },
    };
  }

  const entry = entryData as AccessEntryRow | null;
  if (!entry) {
    return buildNotFoundResult(token, panelUser);
  }

  const { data: orderData, error: orderError } = await supabase
    .from("access_orders")
    .select("public_ref, source_type, local_id, status")
    .eq("id", entry.order_id)
    .maybeSingle();

  if (orderError) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_lookup_failed",
        message: "Access check-in lookup failed",
      },
      logContext: {
        ...baseLogContext,
        status: entry.status,
        checkinStatus: entry.checkin_status,
        errorCode: "order_lookup_failed",
      },
    };
  }

  const order = orderData as AccessOrderRow | null;
  if (!order) {
    return buildNotFoundResult(token, panelUser, {
      status: entry.status,
      checkinStatus: entry.checkin_status,
    });
  }

  const orderLogContext: Partial<AccessCheckinLogContext> = {
    publicRef: order.public_ref,
    sourceType: order.source_type,
    localId: order.local_id,
    status: entry.status,
    checkinStatus: entry.checkin_status,
  };

  if (order.source_type !== "local" || order.local_id !== panelUser.localId) {
    return buildNotFoundResult(token, panelUser, orderLogContext);
  }

  const { data: orderItemData, error: orderItemError } = await supabase
    .from("access_order_items")
    .select("name_snapshot")
    .eq("id", entry.order_item_id)
    .maybeSingle();

  if (orderItemError || !orderItemData) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_lookup_failed",
        message: "Access check-in lookup failed",
      },
      logContext: {
        ...baseLogContext,
        ...orderLogContext,
        errorCode: "order_item_lookup_failed",
      },
    };
  }

  const orderItem = orderItemData as AccessOrderItemRow;
  const status = deriveAccessCheckinStatus(entry, order);
  const warnings: AccessCheckinWarning[] =
    entry.access_date !== formatAsuncionDate(input.now ?? new Date()) ? ["date_warning"] : [];

  return {
    ok: true,
    status,
    entry: {
      status: entry.status,
      checkin_status: entry.checkin_status,
      access_date: entry.access_date,
      unit_index: entry.unit_index,
      ticket_name: orderItem.name_snapshot,
    },
    attendee: {
      name: entry.attendee_name,
      last_name: entry.attendee_last_name,
    },
    order: {
      public_ref: order.public_ref,
    },
    warnings,
    logContext: {
      ...baseLogContext,
      ...orderLogContext,
      errorCode: undefined,
    },
  };
}

export async function checkInAccessEntryByToken(input: {
  token: string;
  panelUser: AccessCheckinPanelUser;
  now?: Date;
}): Promise<AccessCheckinUseResult> {
  const { token, panelUser } = input;
  const baseLogContext: AccessCheckinLogContext = {
    tokenHash: accessCheckinTokenHash(token),
    localId: panelUser.localId,
    panelUserId: panelUser.userId,
    role: panelUser.role,
  };

  const { data, error } = await supabase.rpc("check_in_access_entry_by_token", {
    p_checkin_token: token,
    p_actor_auth_user_id: panelUser.userId,
    p_local_id: panelUser.localId,
  });

  if (error) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_use_failed",
        message: "Access check-in failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode: error.code ?? "checkin_rpc_failed",
      },
    };
  }

  if (!isRecord(data)) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_use_failed",
        message: "Access check-in failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode: "invalid_rpc_response",
      },
    };
  }

  if (data.ok !== true) {
    const errorCode = readNestedErrorCode(data) ?? "checkin_use_failed";
    const statusCode =
      errorCode === "invalid_request"
        ? 400
        : errorCode === "forbidden"
          ? 403
          : errorCode === "entry_not_found"
            ? 404
            : 500;

    return {
      ok: false,
      statusCode,
      error: {
        code:
          errorCode === "invalid_request" ||
          errorCode === "forbidden" ||
          errorCode === "entry_not_found"
            ? errorCode
            : "checkin_use_failed",
        message: readNestedErrorMessage(data) ?? "Access check-in failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode,
      },
    };
  }

  if (!isAccessCheckinUseStatus(data.status)) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_use_failed",
        message: "Access check-in failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode: "unexpected_business_status",
      },
    };
  }

  const entry = readAccessCheckinEntryResponse(data.entry);
  const attendee = readAccessCheckinAttendee(data.attendee);
  const order = readAccessCheckinOrder(data.order);
  if (!entry || !attendee || !order) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "checkin_use_failed",
        message: "Access check-in failed",
      },
      logContext: {
        ...baseLogContext,
        errorCode: "invalid_rpc_response",
      },
    };
  }

  return {
    ok: true,
    status: data.status,
    entry,
    attendee,
    order,
    warnings: buildAccessCheckinWarnings(entry.access_date, input.now),
    logContext: {
      ...baseLogContext,
      publicRef: order.public_ref,
      sourceType: "local",
      localId: panelUser.localId,
      status: entry.status,
      checkinStatus: entry.checkin_status,
      usedAt: entry.used_at ?? null,
      errorCode: undefined,
    },
  };
}
