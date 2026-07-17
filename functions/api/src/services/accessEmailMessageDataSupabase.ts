import {
  parseAccessEmailEntryRows,
  parseAccessEmailEventRow,
  parseAccessEmailLocalRow,
  parseAccessEmailOrderItemRows,
  parseAccessEmailOrderRow,
  type AccessEmailMessageDataParseResult,
  type AccessEmailMessageDataReadOptions,
  type AccessEmailMessageDataReader,
  type AccessEmailMessageDataReadResult,
} from "./accessEmailMessageData";

export const ACCESS_EMAIL_MESSAGE_DATA_SELECT = Object.freeze({
  order:
    "id, public_ref, source_type, local_id, event_id, access_date, buyer_name, buyer_last_name, buyer_email, status",
  orderItems:
    "id, order_id, access_ticket_type_id, name_snapshot, quantity, entries_per_unit",
  entries:
    "id, order_id, order_item_id, access_ticket_type_id, unit_index, checkin_token, attendee_name, attendee_last_name, access_date, status, checkin_status",
  local: "name",
  event: "title",
});

interface AccessEmailMessageDataPostgrestResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface AccessEmailMessageDataPostgrestRequest
  extends PromiseLike<AccessEmailMessageDataPostgrestResult> {
  eq(column: string, value: string): AccessEmailMessageDataPostgrestRequest;
  abortSignal(signal: AbortSignal): AccessEmailMessageDataPostgrestRequest;
  maybeSingle(): PromiseLike<AccessEmailMessageDataPostgrestResult>;
}

interface AccessEmailMessageDataPostgrestTable {
  select(columns: string): AccessEmailMessageDataPostgrestRequest;
}

export interface AccessEmailMessageDataSupabaseClient {
  from(table: string): AccessEmailMessageDataPostgrestTable;
}

function success<Value>(
  data: Value,
): AccessEmailMessageDataReadResult<Value> {
  return Object.freeze({ kind: "success", data });
}

const INVALID_DATA = Object.freeze({
  kind: "invalid_data" as const,
});
const TRANSPORT_ERROR = Object.freeze({
  kind: "transport_error" as const,
});
const ABORTED_READ = Object.freeze({
  kind: "aborted" as const,
});

async function executeQuery<Value>(
  createRequest: () => AccessEmailMessageDataPostgrestRequest,
  parse: (
    input: unknown,
  ) => AccessEmailMessageDataParseResult<Value>,
  options?: AccessEmailMessageDataReadOptions,
  maybeSingle = false,
): Promise<AccessEmailMessageDataReadResult<Value>> {
  const signal = options?.signal;
  if (signal?.aborted) return ABORTED_READ;

  try {
    const request = createRequest();
    if (signal?.aborted) return ABORTED_READ;
    const signaledRequest = signal ? request.abortSignal(signal) : request;
    if (signal?.aborted) return ABORTED_READ;
    const result = await (maybeSingle
      ? signaledRequest.maybeSingle()
      : signaledRequest);
    if (signal?.aborted) return ABORTED_READ;
    const error = result.error;
    if (signal?.aborted) return ABORTED_READ;
    if (error !== null) return TRANSPORT_ERROR;
    const data = result.data;
    if (signal?.aborted) return ABORTED_READ;
    const parsed = parse(data);
    if (signal?.aborted) return ABORTED_READ;
    return parsed.ok ? success(parsed.data) : INVALID_DATA;
  } catch {
    return signal?.aborted ? ABORTED_READ : TRANSPORT_ERROR;
  }
}

export function createAccessEmailMessageDataSupabaseReader(
  client: AccessEmailMessageDataSupabaseClient,
): AccessEmailMessageDataReader {
  const reader: AccessEmailMessageDataReader = {
    readOrder(orderId, options) {
      return executeQuery(
        () =>
          client
            .from("access_orders")
            .select(ACCESS_EMAIL_MESSAGE_DATA_SELECT.order)
            .eq("id", orderId),
        parseAccessEmailOrderRow,
        options,
        true,
      );
    },

    readOrderItems(orderId, options) {
      return executeQuery(
        () =>
          client
            .from("access_order_items")
            .select(ACCESS_EMAIL_MESSAGE_DATA_SELECT.orderItems)
            .eq("order_id", orderId),
        parseAccessEmailOrderItemRows,
        options,
      );
    },

    readEntries(orderId, options) {
      return executeQuery(
        () =>
          client
            .from("access_entries")
            .select(ACCESS_EMAIL_MESSAGE_DATA_SELECT.entries)
            .eq("order_id", orderId),
        parseAccessEmailEntryRows,
        options,
      );
    },

    readLocal(localId, options) {
      return executeQuery(
        () =>
          client
            .from("locals")
            .select(ACCESS_EMAIL_MESSAGE_DATA_SELECT.local)
            .eq("id", localId),
        parseAccessEmailLocalRow,
        options,
        true,
      );
    },

    readEvent(eventId, options) {
      return executeQuery(
        () =>
          client
            .from("events")
            .select(ACCESS_EMAIL_MESSAGE_DATA_SELECT.event)
            .eq("id", eventId),
        parseAccessEmailEventRow,
        options,
        true,
      );
    },
  };
  return Object.freeze(reader);
}
