import { z } from "zod";

export const ACCESS_FULFILLMENT_RPC = {
  claimBatch: "claim_access_fulfillment_batch",
  reconcile: "reconcile_access_order_fulfillment",
  issueEntries: "issue_access_entries_for_paid_order",
  claimEmail: "claim_access_email_delivery",
  recordEmailOutcome: "record_access_email_delivery_outcome",
  recordEmailPreclaimTerminalFailure: "record_access_email_preclaim_terminal_failure",
  releaseLease: "release_access_fulfillment_lease",
} as const;

export type AccessFulfillmentRpcName =
  (typeof ACCESS_FULFILLMENT_RPC)[keyof typeof ACCESS_FULFILLMENT_RPC];

const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().min(1);
const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/);
const nonNegativeIntegerSchema = z.number().int().safe().nonnegative();
const positiveIntegerSchema = z.number().int().safe().positive();

export const ACCESS_EMAIL_PRECLAIM_TERMINAL_FAILURE_ERROR_CODES = [
  "order_invalid",
  "order_items_invalid",
  "entries_not_found",
  "entries_invalid",
  "entry_count_mismatch",
  "entry_not_deliverable",
  "source_invalid",
  "invalid_recipient",
] as const;

export type AccessEmailPreclaimTerminalFailureErrorCode =
  (typeof ACCESS_EMAIL_PRECLAIM_TERMINAL_FAILURE_ERROR_CODES)[number];

const accessEmailPreclaimTerminalFailureErrorCodeSchema = z.enum(
  ACCESS_EMAIL_PRECLAIM_TERMINAL_FAILURE_ERROR_CODES,
);

const rpcErrorSchema = z
  .object({
    code: nonEmptyStringSchema,
    message: nonEmptyStringSchema,
  })
  .strict();

const claimBatchSuccessSchema = z
  .object({
    ok: z.literal(true),
    claimed_count: nonNegativeIntegerSchema,
    idempotent: z.boolean(),
    items: z.array(
      z
        .object({
          order_id: uuidSchema,
          approved_payment_attempt_id: uuidSchema,
          work_type: z.enum(["issuance", "email"]),
          issuance_status: z.enum(["pending", "partial", "complete", "manual_review"]),
          email_status: z.enum(["pending", "processing", "failed", "sent", "manual_review"]),
          expected_entries: nonNegativeIntegerSchema,
          issued_entries: nonNegativeIntegerSchema,
          email_generation: positiveIntegerSchema,
          reconcile_lease_epoch: positiveIntegerSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.claimed_count !== value.items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claimed_count"],
        message: "must equal the number of returned items",
      });
    }

    if (value.idempotent && value.claimed_count === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idempotent"],
        message: "cannot be true when claimed_count is zero",
      });
    }
  });

const claimBatchErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.boolean().optional(),
    error: rpcErrorSchema,
  })
  .strict();

const reconcileSuccessSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("issued"),
    order_id: uuidSchema,
    payment_attempt_id: uuidSchema,
    public_ref: nonEmptyStringSchema,
    expected_entries: nonNegativeIntegerSchema,
    existing_entries_before: nonNegativeIntegerSchema,
    inserted_entries: nonNegativeIntegerSchema,
    total_entries: nonNegativeIntegerSchema,
    idempotent: z.boolean(),
  })
  .strict();

const reconcileErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.boolean().optional(),
    order_id: uuidSchema.optional(),
    payment_attempt_id: uuidSchema.optional(),
    public_ref: nonEmptyStringSchema.optional(),
    expected_entries: nonNegativeIntegerSchema.optional(),
    existing_entries_before: nonNegativeIntegerSchema.optional(),
    inserted_entries: nonNegativeIntegerSchema.optional(),
    total_entries: nonNegativeIntegerSchema.optional(),
    idempotent: z.boolean().optional(),
    error: rpcErrorSchema,
  })
  .strict();

const emailClaimProcessingShape = {
  ok: z.literal(true),
  status: z.literal("processing"),
  order_id: uuidSchema,
  delivery_attempt_id: uuidSchema,
  generation: positiveIntegerSchema,
  provider: z.literal("resend"),
  idempotency_key: nonEmptyStringSchema,
  entry_ids: z.array(uuidSchema).min(1),
  entry_snapshot_hash: sha256HexSchema,
  template_version: nonEmptyStringSchema,
  epoch: positiveIntegerSchema,
  idempotent: z.boolean(),
} as const;

function validateUniqueEmailClaimEntryIds(
  value: { entry_ids: string[] },
  context: z.RefinementCtx,
): void {
  if (new Set(value.entry_ids).size !== value.entry_ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entry_ids"],
      message: "must not contain duplicate entry IDs",
    });
  }
}

// Migration 046 never returns provider_call_count; strict parsing rejects that invented field.
const legacyEmailClaimProcessingSchema = z
  .object(emailClaimProcessingShape)
  .strict()
  .superRefine(validateUniqueEmailClaimEntryIds);

const correlatedEmailClaimProcessingSchema = z
  .object({
    ...emailClaimProcessingShape,
    entry_count: positiveIntegerSchema,
    request_payload_hash: sha256HexSchema,
    idempotency_remaining_ms: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateUniqueEmailClaimEntryIds(value, context);

    if (value.entry_count !== value.entry_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entry_count"],
        message: "must equal the number of returned entry IDs",
      });
    }

    if (value.idempotency_key !== `access-email-delivery/${value.delivery_attempt_id}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idempotency_key"],
        message: "must correlate to delivery_attempt_id",
      });
    }
  });

export type LegacyEmailDeliveryProcessingResponse = z.infer<
  typeof legacyEmailClaimProcessingSchema
>;

export type CorrelatedEmailDeliveryProcessingResponse = z.infer<
  typeof correlatedEmailClaimProcessingSchema
>;

export type EmailDeliveryProcessingResponse =
  | LegacyEmailDeliveryProcessingResponse
  | CorrelatedEmailDeliveryProcessingResponse;

export function isCorrelatedEmailDeliveryProcessingResponse(
  response: unknown,
): response is CorrelatedEmailDeliveryProcessingResponse {
  return correlatedEmailClaimProcessingSchema.safeParse(response).success;
}

const emailClaimSkippedSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("skipped_sent"),
    order_id: uuidSchema,
    generation: positiveIntegerSchema,
    epoch: positiveIntegerSchema,
    idempotent: z.literal(true),
  })
  .strict();

const emailClaimErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.boolean().optional(),
    order_id: uuidSchema.optional(),
    delivery_attempt_id: uuidSchema.nullable().optional(),
    generation: positiveIntegerSchema.optional(),
    epoch: positiveIntegerSchema.optional(),
    error: rpcErrorSchema,
  })
  .strict()
  .transform(({ delivery_attempt_id: deliveryAttemptId, ...response }) => ({
    ...response,
    ...(deliveryAttemptId === null || deliveryAttemptId === undefined
      ? {}
      : { delivery_attempt_id: deliveryAttemptId }),
  }));

const acceptedEmailOutcomeSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("accepted"),
    accepted: z.literal(true),
    manual_review: z.boolean(),
    order_id: uuidSchema,
    delivery_attempt_id: uuidSchema,
    idempotent: z.boolean(),
  })
  .strict();

const replayedEmailOutcomeSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["failed", "ambiguous"]),
    order_id: uuidSchema,
    delivery_attempt_id: uuidSchema,
    idempotent: z.literal(true),
  })
  .strict();

const recordedEmailOutcomeSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["failed", "ambiguous", "manual_review"]),
    manual_review: z.boolean(),
    order_id: uuidSchema,
    delivery_attempt_id: uuidSchema,
    retryable: z.boolean(),
    idempotent: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedManualReview = value.status === "manual_review";
    if (value.manual_review !== expectedManualReview) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manual_review"],
        message: "is inconsistent with status",
      });
    }

    if (value.retryable === expectedManualReview) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retryable"],
        message: "is inconsistent with status",
      });
    }
  });

const emailOutcomeErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.boolean().optional(),
    order_id: uuidSchema.optional(),
    delivery_attempt_id: uuidSchema.optional(),
    error: rpcErrorSchema,
  })
  .strict();

const freshEmailPreclaimTerminalFailureSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("manual_review"),
    terminal: z.literal(true),
    order_id: uuidSchema,
    generation: positiveIntegerSchema,
    epoch: positiveIntegerSchema,
    error_code: accessEmailPreclaimTerminalFailureErrorCodeSchema,
    idempotent: z.literal(false),
  })
  .strict();

const replayedEmailPreclaimTerminalFailureSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("manual_review"),
    terminal: z.literal(true),
    order_id: uuidSchema,
    generation: positiveIntegerSchema,
    epoch: positiveIntegerSchema,
    error_code: accessEmailPreclaimTerminalFailureErrorCodeSchema,
    idempotent: z.literal(true),
  })
  .strict();

const emailPreclaimTerminalFailureNoOrderErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum([
          "invalid_request",
          "invalid_error_code",
          "order_not_found",
          "internal_error",
        ]),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

const emailPreclaimTerminalFailureOrderErrorSchema = z
  .object({
    ok: z.literal(false),
    order_id: uuidSchema,
    error: z
      .object({
        code: z.enum([
          "fulfillment_not_found",
          "stale_lease",
          "generation_mismatch",
          "provider_outcome_required",
          "delivery_state_conflict",
          "email_already_sent",
        ]),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

const emailPreclaimTerminalFailureConcurrencyErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.literal(true),
    error: z
      .object({
        code: z.literal("concurrency_conflict"),
        message: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

const terminalLeaseReleaseSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("released"),
    terminal: z.literal(true),
    order_id: uuidSchema,
    epoch: positiveIntegerSchema,
    retryable: z.literal(false),
  })
  .strict();

const retryableLeaseReleaseSchema = z
  .object({
    ok: z.literal(true),
    status: z.literal("released"),
    order_id: uuidSchema,
    epoch: positiveIntegerSchema,
    retryable: z.literal(true),
  })
  .strict();

const leaseReleaseErrorSchema = z
  .object({
    ok: z.literal(false),
    retryable: z.boolean().optional(),
    order_id: uuidSchema.optional(),
    epoch: positiveIntegerSchema.optional(),
    error: rpcErrorSchema,
  })
  .strict();

const responseDiscriminatorSchema = z
  .object({
    ok: z.unknown().optional(),
    status: z.unknown().optional(),
  })
  .passthrough();

export interface MalformedRpcResponse {
  kind: "malformed_response";
  rpc: AccessFulfillmentRpcName;
  field: string;
  reason: string;
}

export interface UnknownRpcStatus {
  kind: "unknown_status";
  rpc: AccessFulfillmentRpcName;
  field: "status";
  status: string;
}

export interface TransportRpcError {
  kind: "transport_error";
  rpc: AccessFulfillmentRpcName;
  code?: string;
  message: "Supabase RPC transport failed";
}

export interface SuccessfulRpcResponse<Response> {
  kind: "success";
  rpc: AccessFulfillmentRpcName;
  response: Response;
}

export interface BusinessRpcError<Response> {
  kind: "business_error";
  rpc: AccessFulfillmentRpcName;
  response: Response;
}

export type ClaimFulfillmentBatchResponse =
  | SuccessfulRpcResponse<z.infer<typeof claimBatchSuccessSchema>>
  | BusinessRpcError<z.infer<typeof claimBatchErrorSchema>>
  | MalformedRpcResponse;

export type ReconcileFulfillmentResponse =
  | SuccessfulRpcResponse<z.infer<typeof reconcileSuccessSchema>>
  | BusinessRpcError<z.infer<typeof reconcileErrorSchema>>
  | MalformedRpcResponse
  | UnknownRpcStatus;

export type EmailDeliveryClaimResponse =
  | SuccessfulRpcResponse<
      EmailDeliveryProcessingResponse | z.infer<typeof emailClaimSkippedSchema>
    >
  | BusinessRpcError<z.infer<typeof emailClaimErrorSchema>>
  | MalformedRpcResponse
  | UnknownRpcStatus;

export type EmailDeliveryOutcomeResponse =
  | SuccessfulRpcResponse<
      | z.infer<typeof acceptedEmailOutcomeSchema>
      | z.infer<typeof replayedEmailOutcomeSchema>
      | z.infer<typeof recordedEmailOutcomeSchema>
    >
  | BusinessRpcError<z.infer<typeof emailOutcomeErrorSchema>>
  | MalformedRpcResponse
  | UnknownRpcStatus;

export type EmailPreclaimTerminalFailureResponse =
  | SuccessfulRpcResponse<
      | z.infer<typeof freshEmailPreclaimTerminalFailureSchema>
      | z.infer<typeof replayedEmailPreclaimTerminalFailureSchema>
    >
  | BusinessRpcError<
      | z.infer<typeof emailPreclaimTerminalFailureNoOrderErrorSchema>
      | z.infer<typeof emailPreclaimTerminalFailureOrderErrorSchema>
      | z.infer<typeof emailPreclaimTerminalFailureConcurrencyErrorSchema>
    >
  | MalformedRpcResponse
  | UnknownRpcStatus;

export type FulfillmentLeaseReleaseResponse =
  | SuccessfulRpcResponse<
      z.infer<typeof terminalLeaseReleaseSchema> | z.infer<typeof retryableLeaseReleaseSchema>
    >
  | BusinessRpcError<z.infer<typeof leaseReleaseErrorSchema>>
  | MalformedRpcResponse
  | UnknownRpcStatus;

function malformedResponse(
  rpc: AccessFulfillmentRpcName,
  error: z.ZodError,
): MalformedRpcResponse {
  const issue = error.issues[0];
  return {
    kind: "malformed_response",
    rpc,
    field: issue?.path.length ? issue.path.join(".") : "$",
    reason: issue?.message ?? "response does not match the RPC contract",
  };
}

function unknownStatus(
  rpc: AccessFulfillmentRpcName,
  input: unknown,
  knownStatuses: ReadonlySet<string>,
): UnknownRpcStatus | undefined {
  const discriminator = responseDiscriminatorSchema.safeParse(input);
  if (
    discriminator.success &&
    discriminator.data.ok === true &&
    typeof discriminator.data.status === "string" &&
    !knownStatuses.has(discriminator.data.status)
  ) {
    return {
      kind: "unknown_status",
      rpc,
      field: "status",
      status: discriminator.data.status,
    };
  }

  return undefined;
}

export function parseFulfillmentBatchResponse(input: unknown): ClaimFulfillmentBatchResponse {
  const success = claimBatchSuccessSchema.safeParse(input);
  if (success.success) {
    return { kind: "success", rpc: ACCESS_FULFILLMENT_RPC.claimBatch, response: success.data };
  }

  const businessError = claimBatchErrorSchema.safeParse(input);
  if (businessError.success) {
    return {
      kind: "business_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      response: businessError.data,
    };
  }

  return malformedResponse(ACCESS_FULFILLMENT_RPC.claimBatch, success.error);
}

function parseReconcileResponse(
  input: unknown,
  rpc: typeof ACCESS_FULFILLMENT_RPC.reconcile | typeof ACCESS_FULFILLMENT_RPC.issueEntries,
): ReconcileFulfillmentResponse {
  const success = reconcileSuccessSchema.safeParse(input);
  if (success.success) {
    return { kind: "success", rpc, response: success.data };
  }

  const businessError = reconcileErrorSchema.safeParse(input);
  if (businessError.success) {
    return { kind: "business_error", rpc, response: businessError.data };
  }

  const statusError = unknownStatus(rpc, input, new Set(["issued"]));
  return statusError ?? malformedResponse(rpc, success.error);
}

export function parseReconcileFulfillmentResponse(input: unknown): ReconcileFulfillmentResponse {
  return parseReconcileResponse(input, ACCESS_FULFILLMENT_RPC.reconcile);
}

export function parseIssueAccessEntriesResponse(input: unknown): ReconcileFulfillmentResponse {
  return parseReconcileResponse(input, ACCESS_FULFILLMENT_RPC.issueEntries);
}

export function parseEmailDeliveryClaimResponse(input: unknown): EmailDeliveryClaimResponse {
  const success = z
    .union([
      correlatedEmailClaimProcessingSchema,
      legacyEmailClaimProcessingSchema,
      emailClaimSkippedSchema,
    ])
    .safeParse(input);
  if (success.success) {
    return { kind: "success", rpc: ACCESS_FULFILLMENT_RPC.claimEmail, response: success.data };
  }

  const businessError = emailClaimErrorSchema.safeParse(input);
  if (businessError.success) {
    return {
      kind: "business_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
      response: businessError.data,
    };
  }

  const statusError = unknownStatus(
    ACCESS_FULFILLMENT_RPC.claimEmail,
    input,
    new Set(["processing", "skipped_sent"]),
  );
  return statusError ?? malformedResponse(ACCESS_FULFILLMENT_RPC.claimEmail, success.error);
}

export function parseEmailDeliveryOutcomeResponse(input: unknown): EmailDeliveryOutcomeResponse {
  const success = z
    .union([acceptedEmailOutcomeSchema, replayedEmailOutcomeSchema, recordedEmailOutcomeSchema])
    .safeParse(input);
  if (success.success) {
    return {
      kind: "success",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
      response: success.data,
    };
  }

  const businessError = emailOutcomeErrorSchema.safeParse(input);
  if (businessError.success) {
    return {
      kind: "business_error",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
      response: businessError.data,
    };
  }

  const statusError = unknownStatus(
    ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
    input,
    new Set(["accepted", "failed", "ambiguous", "manual_review"]),
  );
  return statusError ?? malformedResponse(ACCESS_FULFILLMENT_RPC.recordEmailOutcome, success.error);
}

export function parseEmailPreclaimTerminalFailureResponse(
  input: unknown,
): EmailPreclaimTerminalFailureResponse {
  const success = z
    .union([
      freshEmailPreclaimTerminalFailureSchema,
      replayedEmailPreclaimTerminalFailureSchema,
    ])
    .safeParse(input);
  if (success.success) {
    return {
      kind: "success",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      response: success.data,
    };
  }

  const businessError = z
    .union([
      emailPreclaimTerminalFailureNoOrderErrorSchema,
      emailPreclaimTerminalFailureOrderErrorSchema,
      emailPreclaimTerminalFailureConcurrencyErrorSchema,
    ])
    .safeParse(input);
  if (businessError.success) {
    return {
      kind: "business_error",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      response: businessError.data,
    };
  }

  const statusError = unknownStatus(
    ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
    input,
    new Set(["manual_review"]),
  );
  return (
    statusError ??
    malformedResponse(ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure, success.error)
  );
}

export function parseFulfillmentLeaseReleaseResponse(
  input: unknown,
): FulfillmentLeaseReleaseResponse {
  const success = z.union([terminalLeaseReleaseSchema, retryableLeaseReleaseSchema]).safeParse(input);
  if (success.success) {
    return { kind: "success", rpc: ACCESS_FULFILLMENT_RPC.releaseLease, response: success.data };
  }

  const businessError = leaseReleaseErrorSchema.safeParse(input);
  if (businessError.success) {
    return {
      kind: "business_error",
      rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
      response: businessError.data,
    };
  }

  const statusError = unknownStatus(
    ACCESS_FULFILLMENT_RPC.releaseLease,
    input,
    new Set(["released"]),
  );
  return statusError ?? malformedResponse(ACCESS_FULFILLMENT_RPC.releaseLease, success.error);
}

export interface AccessFulfillmentRpcTransportError {
  code?: string;
  message: string;
}

export interface AccessFulfillmentRpcTransportResult {
  data: unknown;
  error: AccessFulfillmentRpcTransportError | null;
}

export interface AccessFulfillmentRpcTransportRequest
  extends PromiseLike<AccessFulfillmentRpcTransportResult> {
  abortSignal(signal: AbortSignal): this;
}

export interface AccessFulfillmentRpcTransport {
  rpc(
    name: AccessFulfillmentRpcName,
    parameters: Readonly<Record<string, unknown>>,
  ): AccessFulfillmentRpcTransportRequest;
}

export interface AccessFulfillmentRpcCallOptions {
  readonly signal?: AbortSignal;
}

export interface ClaimFulfillmentBatchInput {
  reconcileLeaseToken: string;
  limit: number;
  leaseSeconds: number;
}

export interface ReconcileOrderFulfillmentInput {
  orderId: string;
  paymentAttemptId: string;
  reconcileLeaseToken: string | null;
  reconcileLeaseEpoch: number | null;
}

export interface ClaimEmailDeliveryInput {
  orderId: string;
  reconcileLeaseToken: string;
  reconcileLeaseEpoch: number;
  entryIds: readonly string[];
  requestPayloadHash: string;
  templateVersion: string;
  provider: string;
}

export type EmailDeliveryOutcome = "accepted" | "failed" | "ambiguous";

export interface RecordEmailDeliveryOutcomeInput {
  orderId: string;
  deliveryAttemptId: string;
  reconcileLeaseToken: string;
  reconcileLeaseEpoch: number;
  outcome: EmailDeliveryOutcome;
  providerMessageId: string | null;
  errorCode: string | null;
  retryAfterSeconds: number | null;
}

export interface RecordEmailPreclaimTerminalFailureInput {
  readonly orderId: string;
  readonly reconcileLeaseToken: string;
  readonly reconcileLeaseEpoch: number;
  readonly emailGeneration: number;
  readonly errorCode: AccessEmailPreclaimTerminalFailureErrorCode;
}

export interface ReleaseFulfillmentLeaseInput {
  orderId: string;
  reconcileLeaseToken: string;
  reconcileLeaseEpoch: number;
  retryAfterSeconds: number | null;
  errorCode: string | null;
}

export type ClaimFulfillmentBatchResult = ClaimFulfillmentBatchResponse | TransportRpcError;
export type ReconcileOrderFulfillmentResult = ReconcileFulfillmentResponse | TransportRpcError;
export type ClaimEmailDeliveryResult = EmailDeliveryClaimResponse | TransportRpcError;
export type RecordEmailDeliveryOutcomeResult = EmailDeliveryOutcomeResponse | TransportRpcError;
export type RecordEmailPreclaimTerminalFailureResult =
  | EmailPreclaimTerminalFailureResponse
  | TransportRpcError;
export type ReleaseFulfillmentLeaseResult = FulfillmentLeaseReleaseResponse | TransportRpcError;

function toTransportError(
  rpc: AccessFulfillmentRpcName,
  error: AccessFulfillmentRpcTransportError,
): TransportRpcError {
  const code = error.code?.trim();
  return {
    kind: "transport_error",
    rpc,
    ...(code ? { code } : {}),
    message: "Supabase RPC transport failed",
  };
}

async function invokeRpc<Response>(
  transport: AccessFulfillmentRpcTransport,
  rpc: AccessFulfillmentRpcName,
  parameters: Readonly<Record<string, unknown>>,
  parse: (input: unknown) => Response,
  options?: AccessFulfillmentRpcCallOptions,
): Promise<Response | TransportRpcError> {
  try {
    const request = transport.rpc(rpc, parameters);
    const result = await (options?.signal
      ? request.abortSignal(options.signal)
      : request);
    return result.error ? toTransportError(rpc, result.error) : parse(result.data);
  } catch {
    return toTransportError(rpc, { message: "RPC invocation threw" });
  }
}

export interface AccessFulfillmentClient {
  claimFulfillmentBatch(
    input: ClaimFulfillmentBatchInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ClaimFulfillmentBatchResult>;
  reconcileOrderFulfillment(
    input: ReconcileOrderFulfillmentInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ReconcileOrderFulfillmentResult>;
  claimEmailDelivery(
    input: ClaimEmailDeliveryInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ClaimEmailDeliveryResult>;
  recordEmailDeliveryOutcome(
    input: RecordEmailDeliveryOutcomeInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<RecordEmailDeliveryOutcomeResult>;
  recordEmailPreclaimTerminalFailure(
    input: RecordEmailPreclaimTerminalFailureInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<RecordEmailPreclaimTerminalFailureResult>;
  releaseFulfillmentLease(
    input: ReleaseFulfillmentLeaseInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ReleaseFulfillmentLeaseResult>;
}

export function createAccessFulfillmentClient(
  transport: AccessFulfillmentRpcTransport,
): AccessFulfillmentClient {
  return {
    claimFulfillmentBatch(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.claimBatch,
        {
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_limit: input.limit,
          p_lease_seconds: input.leaseSeconds,
        },
        parseFulfillmentBatchResponse,
        options,
      );
    },

    reconcileOrderFulfillment(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.reconcile,
        {
          p_order_id: input.orderId,
          p_payment_attempt_id: input.paymentAttemptId,
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_reconcile_lease_epoch: input.reconcileLeaseEpoch,
        },
        parseReconcileFulfillmentResponse,
        options,
      );
    },

    claimEmailDelivery(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.claimEmail,
        {
          p_order_id: input.orderId,
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_reconcile_lease_epoch: input.reconcileLeaseEpoch,
          p_entry_ids: input.entryIds,
          p_request_payload_hash: input.requestPayloadHash,
          p_template_version: input.templateVersion,
          p_provider: input.provider,
        },
        parseEmailDeliveryClaimResponse,
        options,
      );
    },

    recordEmailDeliveryOutcome(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
        {
          p_order_id: input.orderId,
          p_delivery_attempt_id: input.deliveryAttemptId,
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_reconcile_lease_epoch: input.reconcileLeaseEpoch,
          p_outcome: input.outcome,
          p_provider_message_id: input.providerMessageId,
          p_error_code: input.errorCode,
          p_retry_after_seconds: input.retryAfterSeconds,
        },
        parseEmailDeliveryOutcomeResponse,
        options,
      );
    },

    recordEmailPreclaimTerminalFailure(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
        {
          p_order_id: input.orderId,
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_reconcile_lease_epoch: input.reconcileLeaseEpoch,
          p_email_generation: input.emailGeneration,
          p_error_code: input.errorCode,
        },
        parseEmailPreclaimTerminalFailureResponse,
        options,
      );
    },

    releaseFulfillmentLease(input, options) {
      return invokeRpc(
        transport,
        ACCESS_FULFILLMENT_RPC.releaseLease,
        {
          p_order_id: input.orderId,
          p_reconcile_lease_token: input.reconcileLeaseToken,
          p_reconcile_lease_epoch: input.reconcileLeaseEpoch,
          p_retry_after_seconds: input.retryAfterSeconds,
          p_error_code: input.errorCode,
        },
        parseFulfillmentLeaseReleaseResponse,
        options,
      );
    },
  };
}
