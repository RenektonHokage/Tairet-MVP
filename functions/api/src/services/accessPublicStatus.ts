import { z } from "zod";

export const ACCESS_PUBLIC_STATUS_SELECT =
  "public_ref, status, source_type, local_id, event_id, access_date, amount_gs, currency, expires_at, fulfillment:access_order_fulfillments(issuance_status, issuance_review_status, expected_entries, issued_entries, email_status, email_next_attempt_at, email_sent_at), entries:access_entries!access_entries_order_id_fkey(email_status, email_sent_at)";

export type PublicAccessOrderStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "manual_review"
  | "expired";

export type PublicAccessFulfillmentStatus =
  | "not_started"
  | "pending"
  | "issued"
  | "manual_review";

export type PublicAccessEmailStatus =
  | "not_started"
  | "pending"
  | "retry_scheduled"
  | "sent"
  | "manual_review";

export interface PublicAccessStatusOrder {
  readonly ref: string;
  readonly status: PublicAccessOrderStatus;
  readonly source_type: "local" | "event";
  readonly access_date: string;
  readonly amount_gs: number;
  readonly currency: string;
  readonly expires_at: string | null;
  readonly fulfillment: Readonly<{
    status: PublicAccessFulfillmentStatus;
  }>;
  readonly email: Readonly<{
    status: PublicAccessEmailStatus;
  }>;
}

export type AccessPublicStatusVenueLookup =
  | Readonly<{ kind: "local"; id: string | null }>
  | Readonly<{ kind: "event"; id: string | null }>;

export type AccessPublicStatusReadResult =
  | Readonly<{
      kind: "found";
      order: PublicAccessStatusOrder;
      venue: AccessPublicStatusVenueLookup;
    }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{
      kind: "read_error";
      errorCode: "access_public_status_read_error";
    }>
  | Readonly<{
      kind: "invalid_snapshot";
      errorCode: "access_public_status_invalid_snapshot";
    }>;

interface AccessPublicStatusPostgrestResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface AccessPublicStatusPostgrestRequest
  extends PromiseLike<AccessPublicStatusPostgrestResult> {
  eq(column: string, value: string): AccessPublicStatusPostgrestRequest;
  limit(count: number): AccessPublicStatusPostgrestRequest;
}

interface AccessPublicStatusPostgrestTable {
  select(columns: string): AccessPublicStatusPostgrestRequest;
}

export interface AccessPublicStatusSupabaseClient {
  from(table: string): AccessPublicStatusPostgrestTable;
}

export interface AccessPublicStatusReader {
  read(publicRef: string): Promise<AccessPublicStatusReadResult>;
}

const timestampSchema = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "invalid timestamp",
);

const fulfillmentSchema = z
  .object({
    issuance_status: z.enum([
      "pending",
      "partial",
      "complete",
      "manual_review",
    ]),
    issuance_review_status: z.enum(["none", "manual_review"]),
    expected_entries: z.number().int().safe().nonnegative(),
    issued_entries: z.number().int().safe().nonnegative(),
    email_status: z.enum([
      "pending",
      "processing",
      "failed",
      "sent",
      "manual_review",
    ]),
    email_next_attempt_at: timestampSchema.nullable(),
    email_sent_at: timestampSchema.nullable(),
  })
  .strict();

const entrySchema = z
  .object({
    email_status: z.enum(["not_sent", "sent", "failed"]),
    email_sent_at: timestampSchema.nullable(),
  })
  .strict();

const snapshotSchema = z
  .object({
    public_ref: z.string().min(1),
    status: z.enum([
      "pending_payment",
      "paid",
      "cancelled",
      "manual_review",
      "expired",
    ]),
    source_type: z.enum(["local", "event"]),
    local_id: z.string().min(1).nullable(),
    event_id: z.string().min(1).nullable(),
    access_date: z.string().min(1),
    amount_gs: z.union([z.number(), z.string()]),
    currency: z.string().min(1),
    expires_at: timestampSchema.nullable(),
    fulfillment: fulfillmentSchema.nullable(),
    entries: z.array(entrySchema),
  })
  .strict();

type AccessPublicStatusSnapshot = z.infer<typeof snapshotSchema>;
type AccessPublicStatusFulfillment = z.infer<typeof fulfillmentSchema>;
type AccessPublicStatusEntry = z.infer<typeof entrySchema>;

type EntryProjection =
  | "empty"
  | "complete_sent_projection"
  | "clean_unsent_projection"
  | "failed_unsent_projection"
  | "conflict_projection";

const NOT_FOUND = Object.freeze({ kind: "not_found" as const });
const READ_ERROR = Object.freeze({
  kind: "read_error" as const,
  errorCode: "access_public_status_read_error" as const,
});
const INVALID_SNAPSHOT = Object.freeze({
  kind: "invalid_snapshot" as const,
  errorCode: "access_public_status_invalid_snapshot" as const,
});

function normalizeAmountGs(value: number | string): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function normalizePaymentStatus(
  status: AccessPublicStatusSnapshot["status"],
  expiresAt: string | null,
  nowMs: number,
): PublicAccessOrderStatus {
  if (status === "pending_payment" && expiresAt) {
    if (Date.parse(expiresAt) < nowMs) return "expired";
  }
  return status;
}

function classifyEntryProjection(
  entries: readonly AccessPublicStatusEntry[],
): EntryProjection | null {
  if (entries.length === 0) return "empty";

  let sentCount = 0;
  let failedCount = 0;
  for (const entry of entries) {
    if (entry.email_status === "sent") {
      if (entry.email_sent_at === null) return null;
      sentCount += 1;
      continue;
    }

    if (entry.email_sent_at !== null) return null;
    if (entry.email_status === "failed") failedCount += 1;
  }

  if (sentCount === entries.length) return "complete_sent_projection";
  if (sentCount > 0) return "conflict_projection";
  if (failedCount > 0) return "failed_unsent_projection";
  return "clean_unsent_projection";
}

function hasValidCompleteEmailTimestamps(
  fulfillment: AccessPublicStatusFulfillment,
): boolean {
  switch (fulfillment.email_status) {
    case "pending":
      return fulfillment.email_next_attempt_at !== null
        && fulfillment.email_sent_at === null;
    case "processing":
      return fulfillment.email_next_attempt_at === null
        && fulfillment.email_sent_at === null;
    case "failed":
      return fulfillment.email_next_attempt_at !== null
        && fulfillment.email_sent_at === null;
    case "sent":
      return fulfillment.email_next_attempt_at === null
        && fulfillment.email_sent_at !== null;
    case "manual_review":
      return fulfillment.email_next_attempt_at === null
        && fulfillment.email_sent_at === null;
  }
}

function mapCompleteEmailStatus(
  fulfillment: AccessPublicStatusFulfillment,
  projection: EntryProjection,
): PublicAccessEmailStatus | null {
  if (!hasValidCompleteEmailTimestamps(fulfillment)) return null;

  switch (fulfillment.email_status) {
    case "sent":
      return projection === "complete_sent_projection"
        ? "sent"
        : "manual_review";
    case "pending":
      if (projection === "complete_sent_projection") return "sent";
      return projection === "clean_unsent_projection" || projection === "empty"
        ? "pending"
        : "manual_review";
    case "processing":
      return projection === "clean_unsent_projection" || projection === "empty"
        ? "pending"
        : "manual_review";
    case "failed":
      return projection === "clean_unsent_projection"
        || projection === "failed_unsent_projection"
        || projection === "empty"
        ? "retry_scheduled"
        : "manual_review";
    case "manual_review":
      return "manual_review";
  }
}

function mapPaidFulfillment(
  fulfillment: AccessPublicStatusFulfillment,
  entries: readonly AccessPublicStatusEntry[],
): Readonly<{
  fulfillmentStatus: PublicAccessFulfillmentStatus;
  emailStatus: PublicAccessEmailStatus;
}> | null {
  const projection = classifyEntryProjection(entries);
  if (projection === null) return null;

  if (fulfillment.issuance_status !== "complete"
    && fulfillment.issuance_review_status !== "none") {
    return null;
  }

  switch (fulfillment.issuance_status) {
    case "pending":
      if (
        fulfillment.expected_entries <= 0
        || fulfillment.issued_entries !== 0
        || entries.length !== 0
        || fulfillment.email_status !== "pending"
        || fulfillment.email_next_attempt_at !== null
        || fulfillment.email_sent_at !== null
      ) {
        return null;
      }
      return Object.freeze({
        fulfillmentStatus: "pending",
        emailStatus: "not_started",
      });

    case "partial":
      if (
        fulfillment.expected_entries <= 0
        || fulfillment.issued_entries <= 0
        || fulfillment.issued_entries >= fulfillment.expected_entries
        || entries.length !== fulfillment.issued_entries
        || projection !== "clean_unsent_projection"
        || fulfillment.email_status !== "pending"
        || fulfillment.email_next_attempt_at !== null
        || fulfillment.email_sent_at !== null
      ) {
        return null;
      }
      return Object.freeze({
        fulfillmentStatus: "pending",
        emailStatus: "not_started",
      });

    case "manual_review":
      if (
        entries.length !== fulfillment.issued_entries
        || (projection !== "empty" && projection !== "clean_unsent_projection")
        || fulfillment.email_status !== "pending"
        || fulfillment.email_next_attempt_at !== null
        || fulfillment.email_sent_at !== null
      ) {
        return null;
      }
      return Object.freeze({
        fulfillmentStatus: "manual_review",
        emailStatus: "not_started",
      });

    case "complete": {
      if (
        fulfillment.expected_entries <= 0
        || entries.length !== fulfillment.issued_entries
      ) {
        return null;
      }

      const reviewStatus = fulfillment.issuance_review_status;
      if (reviewStatus === "none") {
        if (
          fulfillment.issued_entries !== fulfillment.expected_entries
          || entries.length === 0
        ) {
          return null;
        }
      } else if (fulfillment.issued_entries !== 0 && entries.length === 0) {
        return null;
      }

      if (projection === "empty"
        && !(reviewStatus === "manual_review" && fulfillment.issued_entries === 0)) {
        return null;
      }

      const emailStatus = mapCompleteEmailStatus(fulfillment, projection);
      if (emailStatus === null) return null;
      return Object.freeze({
        fulfillmentStatus:
          reviewStatus === "manual_review" ? "manual_review" : "issued",
        emailStatus,
      });
    }
  }
}

function found(
  snapshot: AccessPublicStatusSnapshot,
  status: PublicAccessOrderStatus,
  amountGs: number,
  fulfillmentStatus: PublicAccessFulfillmentStatus,
  emailStatus: PublicAccessEmailStatus,
): AccessPublicStatusReadResult {
  const order: PublicAccessStatusOrder = Object.freeze({
    ref: snapshot.public_ref,
    status,
    source_type: snapshot.source_type,
    access_date: snapshot.access_date,
    amount_gs: amountGs,
    currency: snapshot.currency,
    expires_at: snapshot.expires_at,
    fulfillment: Object.freeze({ status: fulfillmentStatus }),
    email: Object.freeze({ status: emailStatus }),
  });
  const venue: AccessPublicStatusVenueLookup = snapshot.source_type === "local"
    ? Object.freeze({ kind: "local", id: snapshot.local_id })
    : Object.freeze({ kind: "event", id: snapshot.event_id });
  return Object.freeze({ kind: "found", order, venue });
}

export function mapAccessPublicStatusSnapshot(
  input: unknown,
  expectedPublicRef: string,
  nowMs: number,
): AccessPublicStatusReadResult {
  if (!Number.isFinite(nowMs)) return INVALID_SNAPSHOT;
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success || parsed.data.public_ref !== expectedPublicRef) {
    return INVALID_SNAPSHOT;
  }

  const snapshot = parsed.data;
  const amountGs = normalizeAmountGs(snapshot.amount_gs);
  if (amountGs === null) return INVALID_SNAPSHOT;
  const status = normalizePaymentStatus(snapshot.status, snapshot.expires_at, nowMs);

  if (snapshot.status !== "paid") {
    if (snapshot.fulfillment !== null || snapshot.entries.length !== 0) {
      return INVALID_SNAPSHOT;
    }
    return found(snapshot, status, amountGs, "not_started", "not_started");
  }

  if (snapshot.fulfillment === null) {
    if (snapshot.entries.length !== 0) return INVALID_SNAPSHOT;
    return found(snapshot, status, amountGs, "pending", "not_started");
  }

  const mapped = mapPaidFulfillment(snapshot.fulfillment, snapshot.entries);
  if (mapped === null) return INVALID_SNAPSHOT;
  return found(
    snapshot,
    status,
    amountGs,
    mapped.fulfillmentStatus,
    mapped.emailStatus,
  );
}

export function createAccessPublicStatusReader(
  client: AccessPublicStatusSupabaseClient,
  now: () => number = Date.now,
): AccessPublicStatusReader {
  const reader: AccessPublicStatusReader = {
    async read(publicRef) {
      try {
        const result = await client
          .from("access_orders")
          .select(ACCESS_PUBLIC_STATUS_SELECT)
          .eq("public_ref", publicRef)
          .limit(2);
        if (result.error !== null) return READ_ERROR;
        if (!Array.isArray(result.data)) return INVALID_SNAPSHOT;
        if (result.data.length === 0) return NOT_FOUND;
        if (result.data.length !== 1) return INVALID_SNAPSHOT;
        return mapAccessPublicStatusSnapshot(result.data[0], publicRef, now());
      } catch {
        return READ_ERROR;
      }
    },
  };
  return Object.freeze(reader);
}
