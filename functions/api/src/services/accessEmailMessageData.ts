import { z } from "zod";

import {
  canonicalizeAccessEntriesEmailEntries,
  type AccessEntriesEmailEntry,
} from "./accessEmailMessage";

const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const nonEmptyStringSchema = z.string().refine(
  (value) => value.trim().length > 0,
  "required string must not be empty",
);
const accessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidAccessDate(value: string): boolean {
  const match = accessDatePattern.exec(value);
  if (!match) return false;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (year < 1 || month < 1 || month > 12) return false;

  const isLeapYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return day >= 1 && day <= daysInMonth;
}

const accessDateSchema = z
  .string()
  .refine(isValidAccessDate, "invalid access date");
const positiveIntegerSchema = z.number().int().safe().positive();

export interface AccessEmailOrderRow {
  readonly id: string;
  readonly public_ref: string;
  readonly source_type: "local" | "event";
  readonly local_id: string | null;
  readonly event_id: string | null;
  readonly access_date: string;
  readonly buyer_name: string;
  readonly buyer_last_name: string;
  readonly buyer_email: string;
  readonly status:
    | "pending_payment"
    | "paid"
    | "cancelled"
    | "expired"
    | "manual_review";
}

export interface AccessEmailOrderItemRow {
  readonly id: string;
  readonly order_id: string;
  readonly access_ticket_type_id: string;
  readonly name_snapshot: string;
  readonly quantity: number;
  readonly entries_per_unit: number;
}

export interface AccessEmailEntryRow {
  readonly id: string;
  readonly order_id: string;
  readonly order_item_id: string;
  readonly access_ticket_type_id: string;
  readonly unit_index: number;
  readonly checkin_token: string;
  readonly attendee_name: string;
  readonly attendee_last_name: string;
  readonly access_date: string;
  readonly status: "issued" | "voided";
  readonly checkin_status: "unused" | "used";
}

export interface AccessEmailLocalRow {
  readonly name: string;
}

export interface AccessEmailEventRow {
  readonly title: string;
}

const orderRowSchema: z.ZodType<AccessEmailOrderRow> = z
  .object({
    id: uuidSchema,
    public_ref: nonEmptyStringSchema,
    source_type: z.enum(["local", "event"]),
    local_id: uuidSchema.nullable(),
    event_id: uuidSchema.nullable(),
    access_date: accessDateSchema,
    buyer_name: nonEmptyStringSchema,
    buyer_last_name: nonEmptyStringSchema,
    buyer_email: nonEmptyStringSchema,
    status: z.enum([
      "pending_payment",
      "paid",
      "cancelled",
      "expired",
      "manual_review",
    ]),
  })
  .strict();

const orderItemRowSchema: z.ZodType<AccessEmailOrderItemRow> = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    access_ticket_type_id: uuidSchema,
    name_snapshot: nonEmptyStringSchema,
    quantity: positiveIntegerSchema,
    entries_per_unit: positiveIntegerSchema,
  })
  .strict();

const entryRowSchema: z.ZodType<AccessEmailEntryRow> = z
  .object({
    id: uuidSchema,
    order_id: uuidSchema,
    order_item_id: uuidSchema,
    access_ticket_type_id: uuidSchema,
    unit_index: positiveIntegerSchema,
    checkin_token: uuidSchema,
    attendee_name: nonEmptyStringSchema,
    attendee_last_name: nonEmptyStringSchema,
    access_date: accessDateSchema,
    status: z.enum(["issued", "voided"]),
    checkin_status: z.enum(["unused", "used"]),
  })
  .strict();

const localRowSchema: z.ZodType<AccessEmailLocalRow> = z
  .object({ name: z.string() })
  .strict();
const eventRowSchema: z.ZodType<AccessEmailEventRow> = z
  .object({ title: z.string() })
  .strict();

export type AccessEmailMessageDataParseResult<Value> =
  | Readonly<{ ok: true; data: Value }>
  | Readonly<{ ok: false }>;

function parseObject<Row>(
  schema: z.ZodType<Row>,
  input: unknown,
): AccessEmailMessageDataParseResult<Readonly<Row>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return Object.freeze({ ok: false });
  return Object.freeze({
    ok: true,
    data: Object.freeze(parsed.data),
  });
}

function parseNullableObject<Row>(
  schema: z.ZodType<Row>,
  input: unknown,
): AccessEmailMessageDataParseResult<Readonly<Row> | null> {
  if (input === null) {
    return Object.freeze({ ok: true, data: null });
  }
  return parseObject(schema, input);
}

function parseArray<Row>(
  schema: z.ZodType<Row>,
  input: unknown,
): AccessEmailMessageDataParseResult<readonly Readonly<Row>[]> {
  const parsed = z.array(schema).safeParse(input);
  if (!parsed.success) return Object.freeze({ ok: false });
  const rows = Object.freeze(
    parsed.data.map((row) => Object.freeze(row)),
  );
  return Object.freeze({ ok: true, data: rows });
}

export function parseAccessEmailOrderRow(
  input: unknown,
): AccessEmailMessageDataParseResult<AccessEmailOrderRow | null> {
  return parseNullableObject(orderRowSchema, input);
}

export function parseAccessEmailOrderItemRows(
  input: unknown,
): AccessEmailMessageDataParseResult<readonly AccessEmailOrderItemRow[]> {
  return parseArray(orderItemRowSchema, input);
}

export function parseAccessEmailEntryRows(
  input: unknown,
): AccessEmailMessageDataParseResult<readonly AccessEmailEntryRow[]> {
  return parseArray(entryRowSchema, input);
}

export function parseAccessEmailLocalRow(
  input: unknown,
): AccessEmailMessageDataParseResult<AccessEmailLocalRow | null> {
  return parseNullableObject(localRowSchema, input);
}

export function parseAccessEmailEventRow(
  input: unknown,
): AccessEmailMessageDataParseResult<AccessEmailEventRow | null> {
  return parseNullableObject(eventRowSchema, input);
}

export type AccessEmailMessageDataReadResult<Value> =
  | Readonly<{ kind: "success"; data: Value }>
  | Readonly<{ kind: "invalid_data" }>
  | Readonly<{ kind: "transport_error" }>
  | Readonly<{ kind: "aborted" }>;

export interface AccessEmailMessageDataReadOptions {
  readonly signal?: AbortSignal;
}

export interface AccessEmailMessageDataReader {
  readOrder(
    orderId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataReadResult<AccessEmailOrderRow | null>>;
  readOrderItems(
    orderId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataReadResult<readonly AccessEmailOrderItemRow[]>>;
  readEntries(
    orderId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataReadResult<readonly AccessEmailEntryRow[]>>;
  readLocal(
    localId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataReadResult<AccessEmailLocalRow | null>>;
  readEvent(
    eventId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataReadResult<AccessEmailEventRow | null>>;
}

export interface AccessEmailMessageData {
  readonly buyerEmail: string;
  readonly buyerName: string;
  readonly publicRef: string;
  readonly sourceName: string;
  readonly accessDate: string;
  readonly entries: readonly AccessEntriesEmailEntry[];
}

export type AccessEmailMessageDataErrorCode =
  | "email_message_data_load_aborted"
  | "order_read_failed"
  | "order_not_found"
  | "order_not_paid"
  | "order_invalid"
  | "order_items_read_failed"
  | "order_items_invalid"
  | "entries_read_failed"
  | "entries_not_found"
  | "entries_invalid"
  | "entry_count_mismatch"
  | "entry_not_deliverable"
  | "source_read_failed"
  | "source_invalid";

export type AccessEmailMessageDataLoadResult =
  | Readonly<{
      kind: "success";
      orderId: string;
      data: AccessEmailMessageData;
    }>
  | Readonly<{
      kind: "retryable_error";
      errorCode: AccessEmailMessageDataErrorCode;
    }>
  | Readonly<{
      kind: "terminal_error";
      errorCode: AccessEmailMessageDataErrorCode;
    }>
  | Readonly<{
      kind: "aborted";
      errorCode: "email_message_data_load_aborted";
    }>;

const ABORTED_RESULT: AccessEmailMessageDataLoadResult = Object.freeze({
  kind: "aborted",
  errorCode: "email_message_data_load_aborted",
});

function retryableError(
  errorCode: AccessEmailMessageDataErrorCode,
): AccessEmailMessageDataLoadResult {
  return Object.freeze({ kind: "retryable_error", errorCode });
}

function terminalError(
  errorCode: AccessEmailMessageDataErrorCode,
): AccessEmailMessageDataLoadResult {
  return Object.freeze({ kind: "terminal_error", errorCode });
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

type ReaderInvocation<Value> =
  | Readonly<{
      kind: "completed";
      result: AccessEmailMessageDataReadResult<Value>;
    }>
  | Readonly<{ kind: "aborted" }>;

async function invokeReader<Value>(
  signal: AbortSignal | undefined,
  operation: () => Promise<AccessEmailMessageDataReadResult<Value>>,
): Promise<ReaderInvocation<Value>> {
  if (isAborted(signal)) return Object.freeze({ kind: "aborted" });

  try {
    const result = await operation();
    if (isAborted(signal)) return Object.freeze({ kind: "aborted" });
    return Object.freeze({ kind: "completed", result });
  } catch {
    if (isAborted(signal)) return Object.freeze({ kind: "aborted" });
    return Object.freeze({
      kind: "completed",
      result: Object.freeze({ kind: "transport_error" }),
    });
  }
}

function parseSuccessfulRead<Value>(
  result: AccessEmailMessageDataReadResult<Value>,
  parse: (input: unknown) => AccessEmailMessageDataParseResult<Value>,
): AccessEmailMessageDataReadResult<Value> {
  if (result.kind !== "success") return result;
  const parsed = parse(result.data);
  return parsed.ok
    ? Object.freeze({ kind: "success", data: parsed.data })
    : Object.freeze({ kind: "invalid_data" });
}

interface ValidatedOrderItems {
  readonly itemById: ReadonlyMap<string, AccessEmailOrderItemRow>;
  readonly expectedByItemId: ReadonlyMap<string, number>;
  readonly totalExpectedEntries: number;
}

function validateOrderItems(
  orderId: string,
  items: readonly AccessEmailOrderItemRow[],
): ValidatedOrderItems | null {
  if (items.length === 0) return null;

  const itemById = new Map<string, AccessEmailOrderItemRow>();
  const expectedByItemId = new Map<string, number>();
  const ticketTypeIds = new Set<string>();
  let totalExpectedEntries = 0;

  for (const item of items) {
    if (
      item.order_id !== orderId ||
      itemById.has(item.id) ||
      ticketTypeIds.has(item.access_ticket_type_id)
    ) {
      return null;
    }

    const expected = item.quantity * item.entries_per_unit;
    if (!Number.isSafeInteger(expected) || expected <= 0) return null;

    const nextTotal = totalExpectedEntries + expected;
    if (!Number.isSafeInteger(nextTotal) || nextTotal <= 0) return null;

    itemById.set(item.id, item);
    expectedByItemId.set(item.id, expected);
    ticketTypeIds.add(item.access_ticket_type_id);
    totalExpectedEntries = nextTotal;
  }

  return Object.freeze({
    itemById,
    expectedByItemId,
    totalExpectedEntries,
  });
}

type EntryValidationResult =
  | Readonly<{
      ok: true;
      entries: readonly AccessEntriesEmailEntry[];
    }>
  | Readonly<{
      ok: false;
      errorCode:
        | "entries_invalid"
        | "entry_count_mismatch"
        | "entry_not_deliverable";
    }>;

function validateEntries(
  orderId: string,
  accessDate: string,
  rows: readonly AccessEmailEntryRow[],
  items: ValidatedOrderItems,
): EntryValidationResult {
  if (rows.length !== items.totalExpectedEntries) {
    return Object.freeze({
      ok: false,
      errorCode: "entry_count_mismatch",
    });
  }

  const entryIds = new Set<string>();
  const checkinTokens = new Set<string>();
  const positionsByItemId = new Map<string, Set<number>>();
  const mappedEntries: AccessEntriesEmailEntry[] = [];

  for (const row of rows) {
    const item = items.itemById.get(row.order_item_id);
    if (
      row.order_id !== orderId ||
      !item ||
      row.access_ticket_type_id !== item.access_ticket_type_id ||
      row.access_date !== accessDate
    ) {
      return Object.freeze({ ok: false, errorCode: "entries_invalid" });
    }

    if (row.status !== "issued" || row.checkin_status !== "unused") {
      return Object.freeze({
        ok: false,
        errorCode: "entry_not_deliverable",
      });
    }

    if (entryIds.has(row.id) || checkinTokens.has(row.checkin_token)) {
      return Object.freeze({ ok: false, errorCode: "entries_invalid" });
    }
    entryIds.add(row.id);
    checkinTokens.add(row.checkin_token);

    const positions = positionsByItemId.get(item.id) ?? new Set<number>();
    if (positions.has(row.unit_index)) {
      return Object.freeze({ ok: false, errorCode: "entries_invalid" });
    }
    positions.add(row.unit_index);
    positionsByItemId.set(item.id, positions);

    mappedEntries.push({
      id: row.id,
      orderItemId: row.order_item_id,
      unitIndex: row.unit_index,
      ticketName: item.name_snapshot,
      attendeeName: row.attendee_name,
      attendeeLastName: row.attendee_last_name,
      checkinToken: row.checkin_token,
    });
  }

  for (const [itemId, expected] of items.expectedByItemId) {
    const positions = positionsByItemId.get(itemId);
    if (!positions || positions.size !== expected) {
      return Object.freeze({
        ok: false,
        errorCode: "entry_count_mismatch",
      });
    }
    for (let unitIndex = 1; unitIndex <= expected; unitIndex += 1) {
      if (!positions.has(unitIndex)) {
        return Object.freeze({
          ok: false,
          errorCode: "entry_count_mismatch",
        });
      }
    }
  }

  try {
    return Object.freeze({
      ok: true,
      entries: canonicalizeAccessEntriesEmailEntries(mappedEntries),
    });
  } catch {
    return Object.freeze({ ok: false, errorCode: "entries_invalid" });
  }
}

function validateOrderSource(order: AccessEmailOrderRow): string | null {
  if (
    order.source_type === "local" &&
    order.local_id !== null &&
    order.event_id === null
  ) {
    return order.local_id;
  }
  if (
    order.source_type === "event" &&
    order.event_id !== null &&
    order.local_id === null
  ) {
    return order.event_id;
  }
  return null;
}

/**
 * These PostgREST reads are deliberately separate and are not a transactional
 * snapshot. This loader neither claims delivery nor computes snapshot/payload
 * hashes. The future claim_access_email_delivery call remains the authoritative
 * fence and revalidates entry IDs, snapshot, payload hash and template version
 * before any provider call.
 */
export async function loadAccessEmailMessageData(
  reader: AccessEmailMessageDataReader,
  orderId: string,
  options?: AccessEmailMessageDataReadOptions,
): Promise<AccessEmailMessageDataLoadResult> {
  const signal = options?.signal;
  if (isAborted(signal)) return ABORTED_RESULT;

  const parsedOrderId = uuidSchema.safeParse(orderId);
  if (!parsedOrderId.success) return terminalError("order_invalid");
  const normalizedOrderId = parsedOrderId.data;
  const readOptions = signal ? Object.freeze({ signal }) : undefined;

  const orderInvocation = await invokeReader(
    signal,
    () => reader.readOrder(normalizedOrderId, readOptions),
  );
  if (orderInvocation.kind === "aborted") return ABORTED_RESULT;
  const orderRead = parseSuccessfulRead(
    orderInvocation.result,
    parseAccessEmailOrderRow,
  );
  if (orderRead.kind === "aborted") return ABORTED_RESULT;
  if (orderRead.kind === "transport_error") {
    return retryableError("order_read_failed");
  }
  if (orderRead.kind === "invalid_data") {
    return terminalError("order_invalid");
  }
  const order = orderRead.data;
  if (!order) return terminalError("order_not_found");
  if (order.id !== normalizedOrderId) return terminalError("order_invalid");
  if (order.status !== "paid") return terminalError("order_not_paid");
  const sourceId = validateOrderSource(order);
  if (!sourceId) return terminalError("order_invalid");

  const itemsInvocation = await invokeReader(
    signal,
    () => reader.readOrderItems(normalizedOrderId, readOptions),
  );
  if (itemsInvocation.kind === "aborted") return ABORTED_RESULT;
  const itemsRead = parseSuccessfulRead(
    itemsInvocation.result,
    parseAccessEmailOrderItemRows,
  );
  if (itemsRead.kind === "aborted") return ABORTED_RESULT;
  if (itemsRead.kind === "transport_error") {
    return retryableError("order_items_read_failed");
  }
  if (itemsRead.kind === "invalid_data") {
    return terminalError("order_items_invalid");
  }
  const validatedItems = validateOrderItems(normalizedOrderId, itemsRead.data);
  if (!validatedItems) return terminalError("order_items_invalid");

  const entriesInvocation = await invokeReader(
    signal,
    () => reader.readEntries(normalizedOrderId, readOptions),
  );
  if (entriesInvocation.kind === "aborted") return ABORTED_RESULT;
  const entriesRead = parseSuccessfulRead(
    entriesInvocation.result,
    parseAccessEmailEntryRows,
  );
  if (entriesRead.kind === "aborted") return ABORTED_RESULT;
  if (entriesRead.kind === "transport_error") {
    return retryableError("entries_read_failed");
  }
  if (entriesRead.kind === "invalid_data") {
    return terminalError("entries_invalid");
  }
  if (entriesRead.data.length === 0) {
    return terminalError("entries_not_found");
  }
  const validatedEntries = validateEntries(
    normalizedOrderId,
    order.access_date,
    entriesRead.data,
    validatedItems,
  );
  if (!validatedEntries.ok) {
    return terminalError(validatedEntries.errorCode);
  }

  const sourceInvocation =
    order.source_type === "local"
      ? await invokeReader(
          signal,
          () => reader.readLocal(sourceId, readOptions),
        )
      : await invokeReader(
          signal,
          () => reader.readEvent(sourceId, readOptions),
        );
  if (sourceInvocation.kind === "aborted") return ABORTED_RESULT;
  if (sourceInvocation.result.kind === "aborted") return ABORTED_RESULT;
  if (sourceInvocation.result.kind === "transport_error") {
    return retryableError("source_read_failed");
  }
  if (sourceInvocation.result.kind === "invalid_data") {
    return terminalError("source_invalid");
  }

  let sourceName: string;
  if (order.source_type === "local") {
    const parsedSource = parseAccessEmailLocalRow(sourceInvocation.result.data);
    if (!parsedSource.ok) return terminalError("source_invalid");
    sourceName = parsedSource.data?.name.trim() || "Tairet";
  } else {
    const parsedSource = parseAccessEmailEventRow(sourceInvocation.result.data);
    if (!parsedSource.ok) return terminalError("source_invalid");
    sourceName = parsedSource.data?.title.trim() || "Tairet";
  }

  if (isAborted(signal)) return ABORTED_RESULT;

  const buyerName =
    `${order.buyer_name} ${order.buyer_last_name}`.trim() || "Cliente";
  const data: AccessEmailMessageData = Object.freeze({
    buyerEmail: order.buyer_email,
    buyerName,
    publicRef: order.public_ref,
    sourceName,
    accessDate: order.access_date,
    entries: validatedEntries.entries,
  });
  return Object.freeze({
    kind: "success",
    orderId: normalizedOrderId,
    data,
  });
}
