import type { SupabaseClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_FULFILLMENT_RPC,
  type AccessFulfillmentRpcName,
  type AccessFulfillmentRpcTransport,
  type AccessFulfillmentRpcTransportResult,
  createAccessFulfillmentClient,
  parseEmailDeliveryClaimResponse,
  parseEmailDeliveryOutcomeResponse,
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

class QueueTransport implements AccessFulfillmentRpcTransport {
  readonly calls: RecordedRpcCall[] = [];

  constructor(private readonly results: AccessFulfillmentRpcTransportResult[]) {}

  async rpc(
    name: AccessFulfillmentRpcName,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<AccessFulfillmentRpcTransportResult> {
    this.calls.push({ name, parameters });
    const result = this.results.shift();
    if (!result) {
      throw new Error("Mock response queue exhausted");
    }
    return result;
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
    const transport = new QueueTransport(
      Array.from({ length: 5 }, () => ({ data: BUSINESS_ERROR, error: null })),
    );
    const client = createAccessFulfillmentClient(transport);

    const results = [
      await client.claimFulfillmentBatch({
        reconcileLeaseToken: LEASE_TOKEN,
        limit: 5,
        leaseSeconds: 300,
      }),
      await client.reconcileOrderFulfillment({
        orderId: ORDER_ID,
        paymentAttemptId: PAYMENT_ATTEMPT_ID,
        reconcileLeaseToken: LEASE_TOKEN,
        reconcileLeaseEpoch: 7,
      }),
      await client.claimEmailDelivery({
        orderId: ORDER_ID,
        reconcileLeaseToken: LEASE_TOKEN,
        reconcileLeaseEpoch: 7,
        entryIds: [ENTRY_ID_A, ENTRY_ID_B],
        requestPayloadHash: "sha256:payload",
        templateVersion: "access-v1",
        provider: "provider-neutral",
      }),
      await client.recordEmailDeliveryOutcome({
        orderId: ORDER_ID,
        deliveryAttemptId: DELIVERY_ATTEMPT_ID,
        reconcileLeaseToken: LEASE_TOKEN,
        reconcileLeaseEpoch: 7,
        outcome: "accepted",
        providerMessageId: "provider-message-1",
        errorCode: null,
        retryAfterSeconds: null,
      }),
      await client.releaseFulfillmentLease({
        orderId: ORDER_ID,
        reconcileLeaseToken: LEASE_TOKEN,
        reconcileLeaseEpoch: 7,
        retryAfterSeconds: 60,
        errorCode: "retryable_failure",
      }),
    ];
    assert.deepEqual(
      results.map((result) => result.kind),
      Array.from({ length: 5 }, () => "business_error"),
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
      async rpc() {
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
});
