import type { SupabaseClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_FULFILLMENT_RPC,
  type AccessEmailPreclaimTerminalFailureErrorCode,
  type AccessFulfillmentRpcName,
  type AccessFulfillmentRpcTransport,
  type AccessFulfillmentRpcTransportRequest,
  type AccessFulfillmentRpcTransportResult,
  createAccessFulfillmentClient,
  parseEmailDeliveryClaimResponse,
  parseEmailDeliveryOutcomeResponse,
  parseEmailPreclaimTerminalFailureResponse,
  parseFulfillmentBatchResponse,
  parseFulfillmentLeaseReleaseResponse,
  parseIssueAccessEntriesResponse,
  parseReconcileFulfillmentResponse,
} from "./accessFulfillment";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const PAYMENT_ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const LEASE_TOKEN = "33333333-3333-4333-8333-333333333333";
const DELIVERY_ATTEMPT_ID = "44444444-4444-4444-8444-444444444444";
const ENTRY_ID_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ENTRY_ID_B = "00000000-0000-4000-8000-000000000000";
const ENTRY_SNAPSHOT_HASH = "a".repeat(64);

const PRECLAIM_TERMINAL_FAILURE_ERROR_CODES = [
  "order_invalid",
  "order_items_invalid",
  "entries_not_found",
  "entries_invalid",
  "entry_count_mismatch",
  "entry_not_deliverable",
  "source_invalid",
  "invalid_recipient",
] as const satisfies readonly AccessEmailPreclaimTerminalFailureErrorCode[];

const EMAIL_PRECLAIM_TERMINAL_FRESH = {
  ok: true,
  status: "manual_review",
  terminal: true,
  order_id: ORDER_ID,
  generation: 1,
  epoch: 7,
  error_code: "invalid_recipient",
  idempotent: false,
};

const PRECLAIM_BUSINESS_ERROR = {
  ok: false,
  error: {
    code: "invalid_request",
    message: "Invalid request",
  },
};

const BUSINESS_ERROR = {
  ok: false,
  error: {
    code: "future_business_code",
    message: "A safe business error",
  },
};

type ServiceRoleClientIsCompatible = SupabaseClient extends AccessFulfillmentRpcTransport
  ? true
  : false;
const SERVICE_ROLE_CLIENT_IS_COMPATIBLE: ServiceRoleClientIsCompatible = true;

const BATCH_SUCCESS = {
  ok: true,
  claimed_count: 1,
  idempotent: false,
  items: [
    {
      order_id: ORDER_ID,
      approved_payment_attempt_id: PAYMENT_ATTEMPT_ID,
      work_type: "issuance",
      issuance_status: "pending",
      email_status: "pending",
      expected_entries: 2,
      issued_entries: 0,
      email_generation: 1,
      reconcile_lease_epoch: 7,
    },
  ],
};

const RECONCILE_SUCCESS = {
  ok: true,
  status: "issued",
  order_id: ORDER_ID,
  payment_attempt_id: PAYMENT_ATTEMPT_ID,
  public_ref: "ACCESS-001",
  expected_entries: 2,
  existing_entries_before: 1,
  inserted_entries: 1,
  total_entries: 2,
  idempotent: false,
};

const EMAIL_CLAIM_PROCESSING = {
  ok: true,
  status: "processing",
  order_id: ORDER_ID,
  delivery_attempt_id: DELIVERY_ATTEMPT_ID,
  generation: 1,
  provider: "resend",
  idempotency_key: "access/order/generation/1",
  entry_ids: [ENTRY_ID_A, ENTRY_ID_B],
  entry_snapshot_hash: ENTRY_SNAPSHOT_HASH,
  template_version: "access-v1",
  epoch: 7,
  idempotent: false,
};

interface RecordedRpcCall {
  name: AccessFulfillmentRpcName;
  parameters: Readonly<Record<string, unknown>>;
}

function createRpcRequest(
  result: PromiseLike<AccessFulfillmentRpcTransportResult>,
  onSignal: (signal: AbortSignal) => void,
): AccessFulfillmentRpcTransportRequest {
  const promise = Promise.resolve(result);

  return {
    abortSignal(signal) {
      onSignal(signal);
      return this;
    },
    then(onfulfilled, onrejected) {
      return promise.then(onfulfilled, onrejected);
    },
  };
}

class QueueTransport implements AccessFulfillmentRpcTransport {
  readonly calls: RecordedRpcCall[] = [];
  readonly signals: Array<AbortSignal | undefined> = [];

  constructor(private readonly results: AccessFulfillmentRpcTransportResult[]) {}

  rpc(
    name: AccessFulfillmentRpcName,
    parameters: Readonly<Record<string, unknown>>,
  ): AccessFulfillmentRpcTransportRequest {
    const callIndex = this.calls.length;
    this.calls.push({ name, parameters });
    this.signals.push(undefined);
    const result = this.results.shift();
    if (!result) {
      throw new Error("Mock response queue exhausted");
    }

    return createRpcRequest(Promise.resolve(result), (signal) => {
      this.signals[callIndex] = signal;
    });
  }
}

describe("access fulfillment response parsers", () => {
  it("matches fresh, replayed, and empty batch idempotency semantics", () => {
    const freshNonEmpty = parseFulfillmentBatchResponse(BATCH_SUCCESS);
    assert.equal(freshNonEmpty.kind, "success");
    if (freshNonEmpty.kind !== "success") {
      assert.fail("expected a successful batch");
    }
    assert.equal(freshNonEmpty.response.items[0]?.work_type, "issuance");

    const lostResponseReplay = parseFulfillmentBatchResponse({
      ...BATCH_SUCCESS,
      idempotent: true,
    });
    assert.equal(lostResponseReplay.kind, "success");

    const freshEmpty = parseFulfillmentBatchResponse({
      ok: true,
      claimed_count: 0,
      idempotent: false,
      items: [],
    });
    assert.equal(freshEmpty.kind, "success");

    const invalidEmptyReplay = parseFulfillmentBatchResponse({
      ok: true,
      claimed_count: 0,
      idempotent: true,
      items: [],
    });
    assert.equal(invalidEmptyReplay.kind, "malformed_response");

    const countMismatch = parseFulfillmentBatchResponse({
      ...BATCH_SUCCESS,
      claimed_count: 2,
    });
    assert.equal(countMismatch.kind, "malformed_response");

    const partial = parseFulfillmentBatchResponse({
      ok: true,
      claimed_count: 1,
      idempotent: false,
    });
    assert.equal(partial.kind, "malformed_response");
    if (partial.kind !== "malformed_response") {
      assert.fail("expected a malformed batch");
    }
    assert.equal(partial.rpc, ACCESS_FULFILLMENT_RPC.claimBatch);
    assert.equal(partial.field.length > 0, true);
    assert.equal(partial.reason.length > 0, true);
  });

  it("preserves unknown business codes and stale lease context", () => {
    const future = parseFulfillmentBatchResponse(BUSINESS_ERROR);
    assert.equal(future.kind, "business_error");
    if (future.kind !== "business_error") {
      assert.fail("expected a business error");
    }
    assert.equal(future.response.error.code, "future_business_code");

    const stale = parseReconcileFulfillmentResponse({
      ok: false,
      retryable: true,
      order_id: ORDER_ID,
      payment_attempt_id: PAYMENT_ATTEMPT_ID,
      error: {
        code: "stale_lease",
        message: "The lease is stale",
      },
    });
    assert.equal(stale.kind, "business_error");
    if (stale.kind !== "business_error") {
      assert.fail("expected a stale-lease business error");
    }
    assert.equal(stale.response.retryable, true);
    assert.equal(stale.response.order_id, ORDER_ID);
    assert.equal(stale.response.error.code, "stale_lease");
  });

  it("parses both reconciliation RPCs and distinguishes unknown status", () => {
    const reconcile = parseReconcileFulfillmentResponse(RECONCILE_SUCCESS);
    const issue = parseIssueAccessEntriesResponse(RECONCILE_SUCCESS);
    assert.equal(reconcile.kind, "success");
    assert.equal(issue.kind, "success");
    assert.equal(reconcile.rpc, ACCESS_FULFILLMENT_RPC.reconcile);
    assert.equal(issue.rpc, ACCESS_FULFILLMENT_RPC.issueEntries);

    const unknown = parseReconcileFulfillmentResponse({
      ...RECONCILE_SUCCESS,
      status: "future_status",
    });
    assert.deepEqual(unknown, {
      kind: "unknown_status",
      rpc: ACCESS_FULFILLMENT_RPC.reconcile,
      field: "status",
      status: "future_status",
    });
  });

  it("validates processing claim provider, snapshot, entry order, and exact fields", () => {
    const processing = parseEmailDeliveryClaimResponse(EMAIL_CLAIM_PROCESSING);
    assert.equal(processing.kind, "success");
    if (processing.kind !== "success" || processing.response.status !== "processing") {
      assert.fail("expected a processing claim");
    }
    assert.deepEqual(processing.response.entry_ids, [ENTRY_ID_A, ENTRY_ID_B]);

    const duplicate = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      entry_ids: [ENTRY_ID_A, ENTRY_ID_A],
    });
    assert.equal(duplicate.kind, "malformed_response");

    const invented = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      provider_call_count: 1,
    });
    assert.equal(invented.kind, "malformed_response");

    const unsupportedProvider = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      provider: "provider-neutral",
    });
    assert.equal(unsupportedProvider.kind, "malformed_response");

    const invalidSnapshotHash = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      entry_snapshot_hash: "sha256:snapshot",
    });
    assert.equal(invalidSnapshotHash.kind, "malformed_response");
  });

  it("parses skipped claims and reports unknown claim status separately", () => {
    const skipped = parseEmailDeliveryClaimResponse({
      ok: true,
      status: "skipped_sent",
      order_id: ORDER_ID,
      generation: 1,
      epoch: 7,
      idempotent: true,
    });
    assert.equal(skipped.kind, "success");

    const unknown = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      status: "future_claim_status",
    });
    assert.equal(unknown.kind, "unknown_status");
  });

  it("accepts every SQL email outcome shape and rejects inconsistent outcomes", () => {
    const accepted = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "accepted",
      accepted: true,
      manual_review: false,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      idempotent: false,
    });
    const failedReplay = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "failed",
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      idempotent: true,
    });
    const ambiguous = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "ambiguous",
      manual_review: false,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      retryable: true,
      idempotent: false,
    });
    const manualReview = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "manual_review",
      manual_review: true,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      retryable: false,
      idempotent: false,
    });

    assert.equal(accepted.kind, "success");
    assert.equal(failedReplay.kind, "success");
    assert.equal(ambiguous.kind, "success");
    assert.equal(manualReview.kind, "success");

    const inconsistent = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "manual_review",
      manual_review: false,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      retryable: true,
      idempotent: false,
    });
    assert.equal(inconsistent.kind, "malformed_response");

    const unknown = parseEmailDeliveryOutcomeResponse({
      ok: true,
      status: "future_outcome",
    });
    assert.equal(unknown.kind, "unknown_status");
  });

  it("parses fresh and replayed pre-claim terminal failures for the closed allowlist", () => {
    for (const errorCode of PRECLAIM_TERMINAL_FAILURE_ERROR_CODES) {
      const fresh = parseEmailPreclaimTerminalFailureResponse({
        ...EMAIL_PRECLAIM_TERMINAL_FRESH,
        error_code: errorCode,
      });
      assert.equal(fresh.kind, "success");
      if (fresh.kind !== "success") {
        assert.fail("expected a fresh pre-claim terminal failure");
      }
      assert.equal(fresh.rpc, ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure);
      assert.equal(fresh.response.error_code, errorCode);
      assert.equal(fresh.response.idempotent, false);
    }

    const replay = parseEmailPreclaimTerminalFailureResponse({
      ...EMAIL_PRECLAIM_TERMINAL_FRESH,
      idempotent: true,
    });
    assert.equal(replay.kind, "success");
    if (replay.kind !== "success") {
      assert.fail("expected a replayed pre-claim terminal failure");
    }
    assert.equal(replay.response.idempotent, true);
  });

  it("rejects malformed pre-claim terminal success responses and separates unknown status", () => {
    const malformedResponses = [
      {
        ok: true,
        status: "manual_review",
        order_id: ORDER_ID,
        generation: 1,
        epoch: 7,
        error_code: "invalid_recipient",
        idempotent: false,
      },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, unexpected: "field" },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, order_id: "not-a-uuid" },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, generation: 0 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, generation: -1 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, generation: 1.5 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, epoch: 0 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, epoch: -1 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, epoch: 1.5 },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, terminal: false },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, error_code: "future_error_code" },
      { ...EMAIL_PRECLAIM_TERMINAL_FRESH, idempotent: "false" },
    ];

    for (const response of malformedResponses) {
      assert.equal(
        parseEmailPreclaimTerminalFailureResponse(response).kind,
        "malformed_response",
      );
    }

    const unknown = parseEmailPreclaimTerminalFailureResponse({
      ...EMAIL_PRECLAIM_TERMINAL_FRESH,
      status: "future_terminal_status",
    });
    assert.deepEqual(unknown, {
      kind: "unknown_status",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      field: "status",
      status: "future_terminal_status",
    });
  });

  it("accepts only the exact pre-claim terminal business-error variants", () => {
    const noOrderCodes = [
      "invalid_request",
      "invalid_error_code",
      "order_not_found",
      "internal_error",
    ] as const;
    const orderCodes = [
      "fulfillment_not_found",
      "stale_lease",
      "generation_mismatch",
      "provider_outcome_required",
      "delivery_state_conflict",
      "email_already_sent",
    ] as const;

    for (const code of noOrderCodes) {
      const parsed = parseEmailPreclaimTerminalFailureResponse({
        ok: false,
        error: { code, message: "Safe business error" },
      });
      assert.equal(parsed.kind, "business_error");
    }

    for (const code of orderCodes) {
      const parsed = parseEmailPreclaimTerminalFailureResponse({
        ok: false,
        order_id: ORDER_ID,
        error: { code, message: "Safe order business error" },
      });
      assert.equal(parsed.kind, "business_error");
    }

    const concurrency = parseEmailPreclaimTerminalFailureResponse({
      ok: false,
      retryable: true,
      error: {
        code: "concurrency_conflict",
        message: "Concurrency conflict",
      },
    });
    assert.equal(concurrency.kind, "business_error");
    if (concurrency.kind !== "business_error") {
      assert.fail("expected a retryable concurrency conflict");
    }
    assert.deepEqual(concurrency.response, {
      ok: false,
      retryable: true,
      error: {
        code: "concurrency_conflict",
        message: "Concurrency conflict",
      },
    });

    const malformedBusinessResponses = [
      {
        ok: false,
        error: { code: "fulfillment_not_found", message: "Missing order context" },
      },
      {
        ok: false,
        order_id: ORDER_ID,
        error: { code: "invalid_request", message: "Unexpected order context" },
      },
      {
        ok: false,
        retryable: false,
        error: { code: "concurrency_conflict", message: "Not retryable" },
      },
      {
        ok: false,
        retryable: true,
        order_id: ORDER_ID,
        error: { code: "concurrency_conflict", message: "Unexpected order context" },
      },
      {
        ok: false,
        error: { code: "future_business_code", message: "Unknown code" },
      },
      {
        ok: false,
        error: { code: "invalid_request", message: "", detail: "invented" },
      },
    ];

    for (const response of malformedBusinessResponses) {
      assert.equal(
        parseEmailPreclaimTerminalFailureResponse(response).kind,
        "malformed_response",
      );
    }
  });

  it("accepts terminal and retryable lease releases", () => {
    const terminal = parseFulfillmentLeaseReleaseResponse({
      ok: true,
      status: "released",
      terminal: true,
      order_id: ORDER_ID,
      epoch: 7,
      retryable: false,
    });
    const retryable = parseFulfillmentLeaseReleaseResponse({
      ok: true,
      status: "released",
      order_id: ORDER_ID,
      epoch: 7,
      retryable: true,
    });

    assert.equal(terminal.kind, "success");
    assert.equal(retryable.kind, "success");

    const unknown = parseFulfillmentLeaseReleaseResponse({
      ok: true,
      status: "future_release",
    });
    assert.equal(unknown.kind, "unknown_status");
  });

  it("does not include response values in malformed diagnostics", () => {
    const secret = "sensitive-response-value";
    const malformed = parseFulfillmentBatchResponse({
      ok: true,
      claimed_count: secret,
      idempotent: false,
      items: [],
    });
    assert.equal(malformed.kind, "malformed_response");
    assert.equal(JSON.stringify(malformed).includes(secret), false);
  });
  it("rejects invalid UUID and epoch fields", () => {
    const invalidBatchUuid = parseFulfillmentBatchResponse({
      ...BATCH_SUCCESS,
      items: [{ ...BATCH_SUCCESS.items[0], order_id: "not-a-uuid" }],
    });
    const invalidClaimEpoch = parseEmailDeliveryClaimResponse({
      ...EMAIL_CLAIM_PROCESSING,
      epoch: 0,
    });
    const invalidReleaseEpoch = parseFulfillmentLeaseReleaseResponse({
      ok: true,
      status: "released",
      order_id: ORDER_ID,
      epoch: 1.5,
      retryable: true,
    });
    const unsafeReleaseEpoch = parseFulfillmentLeaseReleaseResponse({
      ok: true,
      status: "released",
      order_id: ORDER_ID,
      epoch: Number.MAX_SAFE_INTEGER + 1,
      retryable: true,
    });

    assert.equal(invalidBatchUuid.kind, "malformed_response");
    assert.equal(invalidClaimEpoch.kind, "malformed_response");
    assert.equal(invalidReleaseEpoch.kind, "malformed_response");
    assert.equal(unsafeReleaseEpoch.kind, "malformed_response");
  });

  it("retains each RPC family's validated business-error context", () => {
    const claimError = parseEmailDeliveryClaimResponse({
      ...BUSINESS_ERROR,
      retryable: true,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
      generation: 1,
      epoch: 7,
    });
    const outcomeError = parseEmailDeliveryOutcomeResponse({
      ...BUSINESS_ERROR,
      order_id: ORDER_ID,
      delivery_attempt_id: DELIVERY_ATTEMPT_ID,
    });
    const releaseError = parseFulfillmentLeaseReleaseResponse({
      ...BUSINESS_ERROR,
      retryable: true,
      order_id: ORDER_ID,
      epoch: 7,
    });

    assert.equal(claimError.kind, "business_error");
    assert.equal(outcomeError.kind, "business_error");
    assert.equal(releaseError.kind, "business_error");
    if (
      claimError.kind !== "business_error" ||
      outcomeError.kind !== "business_error" ||
      releaseError.kind !== "business_error"
    ) {
      assert.fail("expected validated business errors");
    }
    assert.equal(claimError.response.delivery_attempt_id, DELIVERY_ATTEMPT_ID);
    assert.equal(outcomeError.response.error.code, "future_business_code");
    assert.equal(releaseError.response.retryable, true);
  });
});

describe("createAccessFulfillmentClient", () => {
  it("calls every RPC once with its exact SQL parameter names", async () => {
    assert.equal(SERVICE_ROLE_CLIENT_IS_COMPATIBLE, true);
    assert.equal(
      ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      "record_access_email_preclaim_terminal_failure",
    );
    const transport = new QueueTransport([
      ...Array.from({ length: 4 }, () => ({ data: BUSINESS_ERROR, error: null })),
      { data: PRECLAIM_BUSINESS_ERROR, error: null },
      { data: BUSINESS_ERROR, error: null },
    ]);
    const client = createAccessFulfillmentClient(transport);
    const controller = new AbortController();
    const options = { signal: controller.signal };

    const results = [
      await client.claimFulfillmentBatch({
        reconcileLeaseToken: LEASE_TOKEN,
        limit: 5,
        leaseSeconds: 300,
      }, options),
      await client.reconcileOrderFulfillment(
        {
          orderId: ORDER_ID,
          paymentAttemptId: PAYMENT_ATTEMPT_ID,
          reconcileLeaseToken: LEASE_TOKEN,
          reconcileLeaseEpoch: 7,
        },
        options,
      ),
      await client.claimEmailDelivery(
        {
          orderId: ORDER_ID,
          reconcileLeaseToken: LEASE_TOKEN,
          reconcileLeaseEpoch: 7,
          entryIds: [ENTRY_ID_A, ENTRY_ID_B],
          requestPayloadHash: "sha256:payload",
          templateVersion: "access-v1",
          provider: "provider-neutral",
        },
        options,
      ),
      await client.recordEmailDeliveryOutcome(
        {
          orderId: ORDER_ID,
          deliveryAttemptId: DELIVERY_ATTEMPT_ID,
          reconcileLeaseToken: LEASE_TOKEN,
          reconcileLeaseEpoch: 7,
          outcome: "accepted",
          providerMessageId: "provider-message-1",
          errorCode: null,
          retryAfterSeconds: null,
        },
        options,
      ),
      await client.recordEmailPreclaimTerminalFailure(
        {
          orderId: ORDER_ID,
          reconcileLeaseToken: LEASE_TOKEN,
          reconcileLeaseEpoch: 7,
          emailGeneration: 1,
          errorCode: "invalid_recipient",
        },
        options,
      ),
      await client.releaseFulfillmentLease(
        {
          orderId: ORDER_ID,
          reconcileLeaseToken: LEASE_TOKEN,
          reconcileLeaseEpoch: 7,
          retryAfterSeconds: 60,
          errorCode: "retryable_failure",
        },
        options,
      ),
    ];
    assert.deepEqual(
      results.map((result) => result.kind),
      Array.from({ length: 6 }, () => "business_error"),
    );

    assert.deepEqual(transport.calls, [
      {
        name: ACCESS_FULFILLMENT_RPC.claimBatch,
        parameters: {
          p_reconcile_lease_token: LEASE_TOKEN,
          p_limit: 5,
          p_lease_seconds: 300,
        },
      },
      {
        name: ACCESS_FULFILLMENT_RPC.reconcile,
        parameters: {
          p_order_id: ORDER_ID,
          p_payment_attempt_id: PAYMENT_ATTEMPT_ID,
          p_reconcile_lease_token: LEASE_TOKEN,
          p_reconcile_lease_epoch: 7,
        },
      },
      {
        name: ACCESS_FULFILLMENT_RPC.claimEmail,
        parameters: {
          p_order_id: ORDER_ID,
          p_reconcile_lease_token: LEASE_TOKEN,
          p_reconcile_lease_epoch: 7,
          p_entry_ids: [ENTRY_ID_A, ENTRY_ID_B],
          p_request_payload_hash: "sha256:payload",
          p_template_version: "access-v1",
          p_provider: "provider-neutral",
        },
      },
      {
        name: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
        parameters: {
          p_order_id: ORDER_ID,
          p_delivery_attempt_id: DELIVERY_ATTEMPT_ID,
          p_reconcile_lease_token: LEASE_TOKEN,
          p_reconcile_lease_epoch: 7,
          p_outcome: "accepted",
          p_provider_message_id: "provider-message-1",
          p_error_code: null,
          p_retry_after_seconds: null,
        },
      },
      {
        name: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
        parameters: {
          p_order_id: ORDER_ID,
          p_reconcile_lease_token: LEASE_TOKEN,
          p_reconcile_lease_epoch: 7,
          p_email_generation: 1,
          p_error_code: "invalid_recipient",
        },
      },
      {
        name: ACCESS_FULFILLMENT_RPC.releaseLease,
        parameters: {
          p_order_id: ORDER_ID,
          p_reconcile_lease_token: LEASE_TOKEN,
          p_reconcile_lease_epoch: 7,
          p_retry_after_seconds: 60,
          p_error_code: "retryable_failure",
        },
      },
    ]);
    assert.deepEqual(
      transport.signals,
      Array.from({ length: 6 }, () => controller.signal),
    );
  });

  it("returns parsed success and malformed responses as distinct results", async () => {
    const transport = new QueueTransport([
      { data: BATCH_SUCCESS, error: null },
      { data: { ok: true }, error: null },
    ]);
    const client = createAccessFulfillmentClient(transport);
    const input = {
      reconcileLeaseToken: LEASE_TOKEN,
      limit: 5,
      leaseSeconds: 300,
    };

    const success = await client.claimFulfillmentBatch(input);
    const malformed = await client.claimFulfillmentBatch(input);

    assert.equal(success.kind, "success");
    assert.equal(malformed.kind, "malformed_response");
    assert.equal(transport.calls.length, 2);
    assert.deepEqual(transport.signals, [undefined, undefined]);
  });

  it("passes the exact signal to an abortable request and sanitizes its failure", async () => {
    let observedSignal: AbortSignal | undefined;
    let resolveRequest: (result: AccessFulfillmentRpcTransportResult) => void =
      () => assert.fail("request resolved before the abort listener was installed");
    const pendingRequest = new Promise<AccessFulfillmentRpcTransportResult>((resolve) => {
      resolveRequest = resolve;
    });
    const transport: AccessFulfillmentRpcTransport = {
      rpc() {
        return createRpcRequest(pendingRequest, (signal) => {
          observedSignal = signal;
          signal.addEventListener(
            "abort",
            () =>
              resolveRequest({
                data: { secret: "must-not-escape" },
                error: {
                  code: "ABORT_ERR",
                  message: "sensitive abort transport detail",
                },
              }),
            { once: true },
          );
        });
      },
    };
    const client = createAccessFulfillmentClient(transport);
    const controller = new AbortController();

    const resultPromise = client.claimFulfillmentBatch(
      {
        reconcileLeaseToken: LEASE_TOKEN,
        limit: 5,
        leaseSeconds: 300,
      },
      { signal: controller.signal },
    );

    assert.equal(observedSignal, controller.signal);
    controller.abort();
    const result = await resultPromise;

    assert.deepEqual(result, {
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      code: "ABORT_ERR",
      message: "Supabase RPC transport failed",
    });
    assert.equal(JSON.stringify(result).includes("must-not-escape"), false);
    assert.equal(JSON.stringify(result).includes("sensitive abort transport detail"), false);
  });

  it("separates transport failures from business responses without retrying or leaking data", async () => {
    const transport = new QueueTransport([
      {
        data: { secret: "must-not-escape" },
        error: { code: "PGRST500", message: "raw transport detail" },
      },
    ]);
    const client = createAccessFulfillmentClient(transport);

    const result = await client.claimFulfillmentBatch({
      reconcileLeaseToken: LEASE_TOKEN,
      limit: 5,
      leaseSeconds: 300,
    });

    assert.deepEqual(result, {
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      code: "PGRST500",
      message: "Supabase RPC transport failed",
    });
    assert.equal(transport.calls.length, 1);
    assert.equal(JSON.stringify(result).includes("must-not-escape"), false);
    assert.equal(JSON.stringify(result).includes("raw transport detail"), false);
  });
  it("normalizes thrown transport failures without retrying", async () => {
    let calls = 0;
    const transport: AccessFulfillmentRpcTransport = {
      rpc() {
        calls += 1;
        throw new Error("sensitive thrown transport detail");
      },
    };
    const client = createAccessFulfillmentClient(transport);

    const result = await client.claimFulfillmentBatch({
      reconcileLeaseToken: LEASE_TOKEN,
      limit: 5,
      leaseSeconds: 300,
    });

    assert.deepEqual(result, {
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      message: "Supabase RPC transport failed",
    });
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes("sensitive thrown transport detail"), false);
  });

  it("sanitizes pre-claim terminal transport failures and never retries", async () => {
    const input = {
      orderId: ORDER_ID,
      reconcileLeaseToken: LEASE_TOKEN,
      reconcileLeaseEpoch: 7,
      emailGeneration: 1,
      errorCode: "invalid_recipient",
    } as const;
    const failedTransport = new QueueTransport([
      {
        data: { secret: "must-not-escape" },
        error: { code: "PGRST500", message: "sensitive pre-claim transport detail" },
      },
    ]);
    const failedClient = createAccessFulfillmentClient(failedTransport);

    const failed = await failedClient.recordEmailPreclaimTerminalFailure(input);

    assert.deepEqual(failed, {
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      code: "PGRST500",
      message: "Supabase RPC transport failed",
    });
    assert.equal(failedTransport.calls.length, 1);
    assert.equal(JSON.stringify(failed).includes("must-not-escape"), false);
    assert.equal(JSON.stringify(failed).includes("sensitive pre-claim transport detail"), false);

    let thrownCalls = 0;
    const thrownTransport: AccessFulfillmentRpcTransport = {
      rpc() {
        thrownCalls += 1;
        throw new Error("sensitive thrown pre-claim detail");
      },
    };
    const thrownClient = createAccessFulfillmentClient(thrownTransport);

    const thrown = await thrownClient.recordEmailPreclaimTerminalFailure(input);

    assert.deepEqual(thrown, {
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      message: "Supabase RPC transport failed",
    });
    assert.equal(thrownCalls, 1);
    assert.equal(JSON.stringify(thrown).includes("sensitive thrown pre-claim detail"), false);
  });
});
