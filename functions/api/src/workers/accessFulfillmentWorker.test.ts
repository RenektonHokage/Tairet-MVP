import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_FULFILLMENT_RPC,
  type AccessFulfillmentRpcCallOptions,
  type ClaimEmailDeliveryInput,
  type ClaimEmailDeliveryResult,
  type ClaimFulfillmentBatchInput,
  type ClaimFulfillmentBatchResult,
  type RecordEmailDeliveryOutcomeInput,
  type RecordEmailDeliveryOutcomeResult,
  type RecordEmailPreclaimTerminalFailureInput,
  type RecordEmailPreclaimTerminalFailureResult,
  type ReconcileOrderFulfillmentInput,
  type ReconcileOrderFulfillmentResult,
  type ReleaseFulfillmentLeaseInput,
  type ReleaseFulfillmentLeaseResult,
} from "../services/accessFulfillment";
import {
  ACCESS_ENTRIES_EMAIL_SUBJECT,
  ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
  AccessEmailMessageError,
  calculateAccessEmailRequestPayloadHash,
  type BuiltAccessEntriesEmailMessage,
} from "../services/accessEmailMessage";
import type {
  AccessEmailMessageData,
  AccessEmailMessageDataLoadResult,
} from "../services/accessEmailMessageData";
import type { AccessEmailProviderOutcome } from "../services/accessEmailProvider";
import {
  createAbortDeadline,
  type AbortDeadlineScheduler,
} from "../services/abortDeadline";
import {
  ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH,
  type AccessFulfillmentEmailCapability,
  type AccessFulfillmentWorkerClient,
  type AccessFulfillmentWorkerConfig,
  type AccessFulfillmentWorkerDeadlineFactory,
  type AccessFulfillmentWorkerLogger,
  accessFulfillmentClaimRetryDelayMs,
  accessFulfillmentCorrelationHash,
  createAccessFulfillmentWorker,
} from "./accessFulfillmentWorker";
import {
  type AccessFulfillmentEmailRuntime,
  type AccessFulfillmentRuntimeSupabaseClient,
  registerAccessFulfillmentWorkerSignalHandlers,
  runAccessFulfillmentWorkerMain,
} from "./accessFulfillmentWorkerMain";

const TOKEN_A = "11111111-1111-4111-8111-111111111111";
const TOKEN_B = "22222222-2222-4222-8222-222222222222";
const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ORDER_E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PAYMENT_A = "10000000-0000-4000-8000-000000000001";
const PAYMENT_B = "20000000-0000-4000-8000-000000000002";

const WORKER_CONFIG: AccessFulfillmentWorkerConfig = {
  batchSize: 5,
  pollIntervalMs: 5_000,
  leaseSeconds: 300,
  concurrency: 2,
  rpcTimeoutMs: 10_000,
  durableEmailDeliveryEnabled: false,
  emailProviderTimeoutMs: 15_000,
};

const ACTIVE_ENV = {
  ACCESS_FULFILLMENT_WORKER_ENABLED: "true",
  ACCESS_FULFILLMENT_WORKER_DRY_RUN: "false",
  ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "false",
  ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
} as const;

const DRY_RUN_ENV = {
  ...ACTIVE_ENV,
  ACCESS_FULFILLMENT_WORKER_DRY_RUN: "true",
} as const;

const DURABLE_ENV = {
  ACCESS_FULFILLMENT_WORKER_ENABLED: "true",
  ACCESS_FULFILLMENT_WORKER_DRY_RUN: "false",
  ACCESS_DURABLE_EMAIL_DELIVERY_ENABLED: "true",
  ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "false",
  EMAIL_ENABLED: "true",
  RESEND_API_KEY: "synthetic-resend-secret",
  EMAIL_FROM_ADDRESS: "synthetic@example.test",
} as const;

type BatchSuccess = Extract<ClaimFulfillmentBatchResult, { kind: "success" }>;
type BatchItem = BatchSuccess["response"]["items"][number];

function claimedItem(
  orderId: string,
  workType: "issuance" | "email" = "issuance",
  epoch = 1,
): BatchItem {
  return {
    order_id: orderId,
    approved_payment_attempt_id: PAYMENT_A,
    work_type: workType,
    issuance_status: workType === "issuance" ? "pending" : "complete",
    email_status: "pending",
    expected_entries: 2,
    issued_entries: workType === "issuance" ? 0 : 2,
    email_generation: 1,
    reconcile_lease_epoch: epoch,
  };
}

function batchSuccess(
  items: readonly BatchItem[],
  idempotent = false,
): ClaimFulfillmentBatchResult {
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
    response: {
      ok: true,
      claimed_count: items.length,
      idempotent,
      items: [...items],
    },
  };
}

function reconcileSuccess(
  input: ReconcileOrderFulfillmentInput,
): Extract<ReconcileOrderFulfillmentResult, { kind: "success" }> {
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.reconcile,
    response: {
      ok: true,
      status: "issued",
      order_id: input.orderId,
      payment_attempt_id: input.paymentAttemptId,
      public_ref: "ACCESS-TEST",
      expected_entries: 2,
      existing_entries_before: 0,
      inserted_entries: 2,
      total_entries: 2,
      idempotent: false,
    },
  };
}

function releaseSuccess(
  input: ReleaseFulfillmentLeaseInput,
): ReleaseFulfillmentLeaseResult {
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
    response: {
      ok: true,
      status: "released",
      order_id: input.orderId,
      epoch: input.reconcileLeaseEpoch,
      retryable: true,
    },
  };
}

function reconcileBusinessError(
  code: string,
  retryable?: boolean,
): ReconcileOrderFulfillmentResult {
  return {
    kind: "business_error",
    rpc: ACCESS_FULFILLMENT_RPC.reconcile,
    response: {
      ok: false,
      ...(retryable === undefined ? {} : { retryable }),
      error: { code, message: "Sanitized test error" },
    },
  };
}

function releaseBusinessError(code: string): ReleaseFulfillmentLeaseResult {
  return {
    kind: "business_error",
    rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
    response: {
      ok: false,
      error: { code, message: "Sanitized test error" },
    },
  };
}

const EMAIL_ENTRY_A = "30000000-0000-4000-8000-000000000001";
const EMAIL_ENTRY_B = "40000000-0000-4000-8000-000000000002";
const EMAIL_CHECKIN_A = "8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const EMAIL_CHECKIN_B = "8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const EMAIL_CHECKIN_LOG = "90000000-0000-4000-8000-000000000001";
const EMAIL_ORDER_ITEM_A = "50000000-0000-4000-8000-000000000001";
const EMAIL_ORDER_ITEM_B = "60000000-0000-4000-8000-000000000002";
const EMAIL_ATTEMPT_A = "70000000-0000-4000-8000-000000000001";
const EMAIL_PROVIDER_MESSAGE_A = "synthetic-provider-message";
const EMAIL_SNAPSHOT_HASH = "a".repeat(64);

function canonicalEmailData(): AccessEmailMessageData {
  return Object.freeze({
    buyerEmail: "buyer@example.test",
    buyerName: "Synthetic Buyer",
    publicRef: "ACCESS-SYNTHETIC",
    sourceName: "Synthetic Source",
    accessDate: "2026-07-19",
    entries: Object.freeze([
      Object.freeze({
        id: EMAIL_ENTRY_A,
        orderItemId: EMAIL_ORDER_ITEM_A,
        unitIndex: 1,
        ticketName: "General",
        attendeeName: "Synthetic",
        attendeeLastName: "One",
        checkinToken: EMAIL_CHECKIN_A,
      }),
      Object.freeze({
        id: EMAIL_ENTRY_B,
        orderItemId: EMAIL_ORDER_ITEM_B,
        unitIndex: 1,
        ticketName: "General",
        attendeeName: "Synthetic",
        attendeeLastName: "Two",
        checkinToken: EMAIL_CHECKIN_B,
      }),
    ]),
  });
}

function canonicalBuiltMessage(
  data: AccessEmailMessageData = canonicalEmailData(),
): BuiltAccessEntriesEmailMessage {
  const message = Object.freeze({
    from: "Tairet <access@example.test>",
    to: Object.freeze([data.buyerEmail]),
    subject: ACCESS_ENTRIES_EMAIL_SUBJECT,
    html: "<p>Synthetic durable access message</p>",
    attachments: Object.freeze([
      Object.freeze({
        filename: "entrada-1.png",
        content: "AQID",
        contentType: "image/png",
        contentId: "access-entry-qr-1",
      }),
      Object.freeze({
        filename: "entrada-2.png",
        content: "BAUG",
        contentType: "image/png",
        contentId: "access-entry-qr-2",
      }),
    ]),
  });
  const requestPayloadHash = calculateAccessEmailRequestPayloadHash({
    templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
    message,
  });
  return Object.freeze({
    templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
    entryIds: Object.freeze(data.entries.map((entry) => entry.id)),
    message,
    requestPayloadHash,
  });
}

type EmailProviderSend = AccessFulfillmentEmailCapability["provider"]["send"];
type EmailProviderInput = Parameters<EmailProviderSend>[0];
type EmailProviderOptions = Parameters<EmailProviderSend>[1];
type EmailProviderHandler = (
  input: EmailProviderInput,
  options?: EmailProviderOptions,
) => Promise<AccessEmailProviderOutcome> | AccessEmailProviderOutcome;

class RecordingEmailCapability implements AccessFulfillmentEmailCapability {
  readonly loadCalls: Array<{
    orderId: string;
    signal: AbortSignal | undefined;
  }> = [];
  readonly buildCalls: AccessEmailMessageData[] = [];
  readonly providerCalls: Array<{
    input: EmailProviderInput;
    signal: AbortSignal | undefined;
  }> = [];

  loadHandler: AccessFulfillmentEmailCapability["load"] = async (orderId) => ({
    kind: "success",
    orderId,
    data: canonicalEmailData(),
  });
  buildHandler: AccessFulfillmentEmailCapability["build"] = async (data) =>
    canonicalBuiltMessage(data);
  providerHandler: EmailProviderHandler = async () => ({
    kind: "accepted",
    providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
  });

  readonly provider: AccessFulfillmentEmailCapability["provider"] = {
    send: async (input, options) => {
      this.providerCalls.push({ input, signal: options?.signal });
      return this.providerHandler(input, options);
    },
  };

  async load(
    orderId: string,
    options?: { readonly signal?: AbortSignal },
  ): Promise<AccessEmailMessageDataLoadResult> {
    this.loadCalls.push({ orderId, signal: options?.signal });
    return this.loadHandler(orderId, options);
  }

  async build(
    data: AccessEmailMessageData,
  ): Promise<BuiltAccessEntriesEmailMessage> {
    this.buildCalls.push(data);
    return this.buildHandler(data);
  }
}

type CorrelatedProcessingResponse = Extract<
  Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
  { status: "processing"; entry_count: number }
>;
type LegacyProcessingResponse = Exclude<
  Extract<
    Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
    { status: "processing" }
  >,
  CorrelatedProcessingResponse
>;

function correlatedEmailClaimSuccess(
  input: ClaimEmailDeliveryInput,
  overrides: Partial<CorrelatedProcessingResponse> = {},
): ClaimEmailDeliveryResult {
  const response: CorrelatedProcessingResponse = {
    ok: true,
    status: "processing",
    order_id: input.orderId,
    delivery_attempt_id: EMAIL_ATTEMPT_A,
    generation: 1,
    provider: "resend",
    idempotency_key: "access-email-delivery/" + EMAIL_ATTEMPT_A,
    entry_ids: [...input.entryIds],
    entry_count: input.entryIds.length,
    entry_snapshot_hash: EMAIL_SNAPSHOT_HASH,
    request_payload_hash: input.requestPayloadHash,
    template_version: input.templateVersion,
    idempotency_remaining_ms: 120_000,
    epoch: input.reconcileLeaseEpoch,
    idempotent: false,
    ...overrides,
  };
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
    response,
  };
}

function legacyEmailClaimSuccess(
  input: ClaimEmailDeliveryInput,
  overrides: Partial<LegacyProcessingResponse> = {},
): ClaimEmailDeliveryResult {
  const response: LegacyProcessingResponse = {
    ok: true,
    status: "processing",
    order_id: input.orderId,
    delivery_attempt_id: EMAIL_ATTEMPT_A,
    generation: 1,
    provider: "resend",
    idempotency_key: "access-email-delivery/" + EMAIL_ATTEMPT_A,
    entry_ids: [...input.entryIds],
    entry_snapshot_hash: EMAIL_SNAPSHOT_HASH,
    template_version: input.templateVersion,
    epoch: input.reconcileLeaseEpoch,
    idempotent: false,
    ...overrides,
  };
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
    response,
  };
}

function emailOutcomeSuccess(
  input: RecordEmailDeliveryOutcomeInput,
  options: {
    idempotent?: boolean;
    manualReview?: boolean;
    retryable?: boolean;
  } = {},
): RecordEmailDeliveryOutcomeResult {
  const idempotent = options.idempotent ?? false;
  const manualReview = options.manualReview ?? false;
  if (input.outcome === "accepted") {
    return {
      kind: "success",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
      response: {
        ok: true,
        status: "accepted",
        accepted: true,
        manual_review: manualReview,
        order_id: input.orderId,
        delivery_attempt_id: input.deliveryAttemptId,
        idempotent,
      },
    };
  }
  if (idempotent) {
    return {
      kind: "success",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
      response: {
        ok: true,
        status: input.outcome,
        order_id: input.orderId,
        delivery_attempt_id: input.deliveryAttemptId,
        idempotent: true,
      },
    };
  }
  const retryable = options.retryable ?? !manualReview;
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
    response: {
      ok: true,
      status: manualReview ? "manual_review" : input.outcome,
      manual_review: manualReview,
      order_id: input.orderId,
      delivery_attempt_id: input.deliveryAttemptId,
      retryable,
      idempotent: false,
    },
  };
}

function emailTerminalSuccess(
  input: RecordEmailPreclaimTerminalFailureInput,
  idempotent = false,
): RecordEmailPreclaimTerminalFailureResult {
  return {
    kind: "success",
    rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
    response: {
      ok: true,
      status: "manual_review",
      terminal: true,
      order_id: input.orderId,
      generation: input.emailGeneration,
      epoch: input.reconcileLeaseEpoch,
      error_code: input.errorCode,
      idempotent,
    },
  };
}

function transportEmailClaim(): ClaimEmailDeliveryResult {
  return {
    kind: "transport_error",
    rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
    message: "Supabase RPC transport failed",
  };
}

function transportEmailOutcome(): RecordEmailDeliveryOutcomeResult {
  return {
    kind: "transport_error",
    rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
    message: "Supabase RPC transport failed",
  };
}


class MemoryLogger implements AccessFulfillmentWorkerLogger {
  readonly entries: Array<{
    level: "info" | "warn" | "error";
    event: string;
    metadata?: Record<string, unknown>;
  }> = [];

  constructor(private readonly throwAfterRecord = false) {}

  private failIfConfigured(): void {
    if (this.throwAfterRecord) {
      throw new Error("Synthetic logger failure");
    }
  }

  info(event: string, metadata?: Record<string, unknown>): void {
    this.entries.push({ level: "info", event, ...(metadata ? { metadata } : {}) });
    this.failIfConfigured();
  }

  warn(event: string, metadata?: Record<string, unknown>): void {
    this.entries.push({ level: "warn", event, ...(metadata ? { metadata } : {}) });
    this.failIfConfigured();
  }

  error(event: string, metadata?: Record<string, unknown>): void {
    this.entries.push({ level: "error", event, ...(metadata ? { metadata } : {}) });
    this.failIfConfigured();
  }
}

interface ControlledDeadlineEntry {
  callback: () => void;
  timeoutMs: number;
  cancelled: boolean;
  cancelCalls: number;
}

class ControlledDeadlineScheduler {
  readonly entries: ControlledDeadlineEntry[] = [];

  readonly schedule: AbortDeadlineScheduler = (callback, timeoutMs) => {
    const entry: ControlledDeadlineEntry = {
      callback,
      timeoutMs,
      cancelled: false,
      cancelCalls: 0,
    };
    this.entries.push(entry);
    return () => {
      entry.cancelled = true;
      entry.cancelCalls += 1;
    };
  };

  fire(index: number): void {
    const entry = this.entries[index];
    assert.ok(entry, "missing controlled deadline " + index);
    assert.equal(entry.cancelled, false, "controlled deadline was cancelled");
    entry.callback();
  }
}

function controlledDeadlineFactory(
  scheduler: ControlledDeadlineScheduler,
): AccessFulfillmentWorkerDeadlineFactory {
  return (timeoutMs, externalSignal) =>
    createAbortDeadline(timeoutMs, externalSignal, scheduler.schedule);
}

class ManualMonotonicClock {
  constructor(private currentMs = 0) {}

  readonly now = (): number => this.currentMs;

  set(value: number): void {
    assert.ok(value >= this.currentMs, "test clock must remain monotonic");
    this.currentMs = value;
  }
}

class ScriptedMonotonicClock {
  calls = 0;

  constructor(
    private readonly readings: Array<number | Error>,
    private readonly fallback = 100,
  ) {}

  readonly now = (): number => {
    const reading = this.readings[this.calls] ?? this.fallback;
    this.calls += 1;
    if (reading instanceof Error) {
      throw reading;
    }
    return reading;
  };
}

type ClaimHandler = (
  input: ClaimFulfillmentBatchInput,
  options?: AccessFulfillmentRpcCallOptions,
) => Promise<ClaimFulfillmentBatchResult> | ClaimFulfillmentBatchResult;
type ReconcileHandler = (
  input: ReconcileOrderFulfillmentInput,
  options?: AccessFulfillmentRpcCallOptions,
) => Promise<ReconcileOrderFulfillmentResult> | ReconcileOrderFulfillmentResult;
type ReleaseHandler = (
  input: ReleaseFulfillmentLeaseInput,
  options?: AccessFulfillmentRpcCallOptions,
) => Promise<ReleaseFulfillmentLeaseResult> | ReleaseFulfillmentLeaseResult;

type EmailClaimHandler = (
  input: ClaimEmailDeliveryInput,
  options?: AccessFulfillmentRpcCallOptions,
) => Promise<ClaimEmailDeliveryResult> | ClaimEmailDeliveryResult;
type EmailOutcomeHandler = (
  input: RecordEmailDeliveryOutcomeInput,
  options?: AccessFulfillmentRpcCallOptions,
) => Promise<RecordEmailDeliveryOutcomeResult> | RecordEmailDeliveryOutcomeResult;
type EmailTerminalHandler = (
  input: RecordEmailPreclaimTerminalFailureInput,
  options?: AccessFulfillmentRpcCallOptions,
) =>
  | Promise<RecordEmailPreclaimTerminalFailureResult>
  | RecordEmailPreclaimTerminalFailureResult;

class RecordingWorkerClient implements AccessFulfillmentWorkerClient {
  readonly claimCalls: ClaimFulfillmentBatchInput[] = [];
  readonly reconcileCalls: ReconcileOrderFulfillmentInput[] = [];
  readonly releaseCalls: ReleaseFulfillmentLeaseInput[] = [];
  readonly claimSignals: Array<AbortSignal | undefined> = [];
  readonly emailClaimCalls: ClaimEmailDeliveryInput[] = [];
  readonly emailOutcomeCalls: RecordEmailDeliveryOutcomeInput[] = [];
  readonly emailTerminalCalls: RecordEmailPreclaimTerminalFailureInput[] = [];
  readonly emailClaimSignals: Array<AbortSignal | undefined> = [];
  readonly emailOutcomeSignals: Array<AbortSignal | undefined> = [];
  readonly emailTerminalSignals: Array<AbortSignal | undefined> = [];

  readonly reconcileSignals: Array<AbortSignal | undefined> = [];
  readonly releaseSignals: Array<AbortSignal | undefined> = [];

  claimHandler: ClaimHandler = () => batchSuccess([]);
  reconcileHandler: ReconcileHandler = reconcileSuccess;
  releaseHandler: ReleaseHandler = releaseSuccess;
  emailClaimHandler: EmailClaimHandler = () => {
    throw new Error("Unexpected email claim");
  };
  emailOutcomeHandler: EmailOutcomeHandler = () => {
    throw new Error("Unexpected email outcome");
  };
  emailTerminalHandler: EmailTerminalHandler = () => {
    throw new Error("Unexpected email terminal record");
  };

  async claimFulfillmentBatch(
    input: ClaimFulfillmentBatchInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ClaimFulfillmentBatchResult> {
    this.claimCalls.push(input);
    this.claimSignals.push(options?.signal);
    return this.claimHandler(input, options);
  }

  async reconcileOrderFulfillment(
    input: ReconcileOrderFulfillmentInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ReconcileOrderFulfillmentResult> {
    this.reconcileCalls.push(input);
    this.reconcileSignals.push(options?.signal);
    return this.reconcileHandler(input, options);
  }

  async releaseFulfillmentLease(
    input: ReleaseFulfillmentLeaseInput,
    options?: AccessFulfillmentRpcCallOptions,

  ): Promise<ReleaseFulfillmentLeaseResult> {
    this.releaseCalls.push(input);
    this.releaseSignals.push(options?.signal);
    return this.releaseHandler(input, options);
  }
  async claimEmailDelivery(
    input: ClaimEmailDeliveryInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<ClaimEmailDeliveryResult> {
    this.emailClaimCalls.push(input);
    this.emailClaimSignals.push(options?.signal);
    return this.emailClaimHandler(input, options);
  }

  async recordEmailDeliveryOutcome(
    input: RecordEmailDeliveryOutcomeInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<RecordEmailDeliveryOutcomeResult> {
    this.emailOutcomeCalls.push(input);
    this.emailOutcomeSignals.push(options?.signal);
    return this.emailOutcomeHandler(input, options);
  }

  async recordEmailPreclaimTerminalFailure(
    input: RecordEmailPreclaimTerminalFailureInput,
    options?: AccessFulfillmentRpcCallOptions,
  ): Promise<RecordEmailPreclaimTerminalFailureResult> {
    this.emailTerminalCalls.push(input);
    this.emailTerminalSignals.push(options?.signal);
    return this.emailTerminalHandler(input, options);
  }

}

function createWorkerHarness(
  client: RecordingWorkerClient,
  options: {
    tokens?: string[];
    config?: Partial<AccessFulfillmentWorkerConfig>;
    now?: () => number;
    sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    logger?: MemoryLogger;
    createDeadline?: AccessFulfillmentWorkerDeadlineFactory;
    emailCapability?: AccessFulfillmentEmailCapability;
  } = {},
) {
  const logger = options.logger ?? new MemoryLogger();
  const tokens = [...(options.tokens ?? [TOKEN_A])];
  let generatedTokens = 0;
  let clock = 0;
  const sleepCalls: number[] = [];
  const worker = createAccessFulfillmentWorker({
    client,
    config: { ...WORKER_CONFIG, ...options.config },
    generateToken: () => {
      const token = tokens[generatedTokens];
      generatedTokens += 1;
      if (!token) {
        throw new Error("Test token queue exhausted");
      }
      return token;
    },
    now:
      options.now ??
      (() => {
        clock += 1;
        return clock;
      }),
    sleep:
      options.sleep ??
      (async (milliseconds) => {
        sleepCalls.push(milliseconds);
      }),
    logger,
    createDeadline: options.createDeadline,
    emailCapability: options.emailCapability,
  });
  return {
    worker,
    logger,
    sleepCalls,
    generatedTokenCount: () => generatedTokens,
  };
}

function createDurableWorkerHarness(
  options: {
    client?: RecordingWorkerClient;
    capability?: RecordingEmailCapability;
    items?: readonly BatchItem[];
    config?: Partial<AccessFulfillmentWorkerConfig>;
    now?: () => number;
    createDeadline?: AccessFulfillmentWorkerDeadlineFactory;
    logger?: MemoryLogger;
  } = {},
) {
  const client = options.client ?? new RecordingWorkerClient();
  const capability = options.capability ?? new RecordingEmailCapability();
  const items = options.items ?? [claimedItem(ORDER_A, "email")];
  client.claimHandler = () => batchSuccess(items);
  client.emailClaimHandler = (input) => correlatedEmailClaimSuccess(input);
  client.emailOutcomeHandler = (input) => emailOutcomeSuccess(input);
  const harness = createWorkerHarness(client, {
    config: {
      durableEmailDeliveryEnabled: true,
      emailProviderTimeoutMs: 5_000,
      ...options.config,
    },
    now: options.now,
    createDeadline: options.createDeadline,
    logger: options.logger,
    emailCapability: capability,
  });
  return { ...harness, client, capability };
}

function assertUniversalEmailInvariants(
  client: RecordingWorkerClient,
  capability: RecordingEmailCapability,
  options: { allowTerminalRelease?: boolean } = {},
): void {
  assert.ok(
    capability.providerCalls.length <= 1,
    "provider must be called at most once per single-item execution",
  );
  if (client.emailOutcomeCalls.length > 0 && !options.allowTerminalRelease) {
    assert.equal(
      client.releaseCalls.length,
      0,
      "outcome authority prohibits release",
    );
  }
  for (const calls of [
    client.emailClaimCalls,
    client.emailTerminalCalls,
    client.emailOutcomeCalls,
  ]) {
    for (let index = 1; index < calls.length; index += 1) {
      assert.equal(calls[index], calls[0], "recovery must reuse object identity");
      assert.deepEqual(calls[index], calls[0], "recovery request must be exact");
    }
  }
}


function deferred<Value>() {
  let resolvePromise: (value: Value) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail("Timed out waiting for deterministic test condition");
}

describe("access fulfillment worker startup", () => {
  it("keeps default-disabled mode free of Supabase imports and RPCs", async () => {
    const logger = new MemoryLogger();
    let loadCalls = 0;
    let loadSupabaseCalls = 0;
    let loadEmailRuntimeCalls = 0;
    let factoryCalls = 0;
    let signalCalls = 0;
    const result = await runAccessFulfillmentWorkerMain({
      env: {},
      logger,
      loadClient: async () => {
        loadCalls += 1;
        return new RecordingWorkerClient();
      },
      loadSupabaseClient: async () => {
        loadSupabaseCalls += 1;
        throw new Error("disabled mode must not load Supabase");
      },
      loadEmailRuntime: async () => {
        loadEmailRuntimeCalls += 1;
        throw new Error("disabled mode must not load email runtime");
      },
      createWorker: () => {
        factoryCalls += 1;
        throw new Error("disabled mode must not create a worker");
      },
      registerSignalHandlers: () => {
        signalCalls += 1;
        throw new Error("disabled mode must not register handlers");
      },
    });

    assert.deepEqual(result, { kind: "disabled", exitCode: 0 });
    assert.equal(loadCalls, 0);
    assert.equal(loadSupabaseCalls, 0);
    assert.equal(loadEmailRuntimeCalls, 0);
    assert.equal(factoryCalls, 0);
    assert.equal(signalCalls, 0);
    assert.equal(logger.entries[0]?.event, "access_fulfillment_worker_disabled");
  });

  it("keeps durable worker-off mode free of runtime side effects", async () => {
    let sideEffectCalls = 0;
    const result = await runAccessFulfillmentWorkerMain({
      env: {
        ...DURABLE_ENV,
        ACCESS_FULFILLMENT_WORKER_ENABLED: "false",
      },
      logger: new MemoryLogger(),
      loadClient: async () => {
        sideEffectCalls += 1;
        throw new Error("worker-off mode must not load a client");
      },
      loadSupabaseClient: async () => {
        sideEffectCalls += 1;
        throw new Error("worker-off mode must not load Supabase");
      },
      loadEmailRuntime: async () => {
        sideEffectCalls += 1;
        throw new Error("worker-off mode must not load email runtime");
      },
      createWorker: () => {
        sideEffectCalls += 1;
        throw new Error("worker-off mode must not create a worker");
      },
      registerSignalHandlers: () => {
        sideEffectCalls += 1;
        throw new Error("worker-off mode must not register handlers");
      },
    });

    assert.deepEqual(result, { kind: "disabled", exitCode: 0 });
    assert.equal(sideEffectCalls, 0);
  });

  it("keeps valid durable dry-run mode free of runtime side effects", async () => {
    let loadCalls = 0;
    let loadSupabaseCalls = 0;
    let loadEmailRuntimeCalls = 0;
    let signalCalls = 0;
    const logger = new MemoryLogger();
    const result = await runAccessFulfillmentWorkerMain({
      env: { ...DURABLE_ENV, ACCESS_FULFILLMENT_WORKER_DRY_RUN: "true" },
      logger,
      loadClient: async () => {
        loadCalls += 1;
        return new RecordingWorkerClient();
      },
      loadSupabaseClient: async () => {
        loadSupabaseCalls += 1;
        throw new Error("dry-run mode must not load Supabase");
      },
      loadEmailRuntime: async () => {
        loadEmailRuntimeCalls += 1;
        throw new Error("dry-run mode must not load email runtime");
      },
      registerSignalHandlers: () => {
        signalCalls += 1;
        throw new Error("dry-run mode must not register handlers");
      },
    });

    assert.deepEqual(result, { kind: "dry_run", exitCode: 0 });
    assert.equal(loadCalls, 0);
    assert.equal(loadSupabaseCalls, 0);
    assert.equal(loadEmailRuntimeCalls, 0);
    assert.equal(signalCalls, 0);
    assert.equal(logger.entries[0]?.event, "access_fulfillment_worker_dry_run");
  });

  it("rejects legacy plus dry-run before loading Supabase", async () => {
    let sideEffectCalls = 0;
    const result = await runAccessFulfillmentWorkerMain({
      env: {
        ...DRY_RUN_ENV,
        ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "true",
      },
      logger: new MemoryLogger(),
      loadClient: async () => {
        sideEffectCalls += 1;
        return new RecordingWorkerClient();
      },
      loadSupabaseClient: async () => {
        sideEffectCalls += 1;
        throw new Error("invalid config must not load Supabase");
      },
      loadEmailRuntime: async () => {
        sideEffectCalls += 1;
        throw new Error("invalid config must not load email runtime");
      },
      registerSignalHandlers: () => {
        sideEffectCalls += 1;
        throw new Error("invalid config must not register handlers");
      },
    });

    assert.equal(result.kind, "fatal");
    assert.equal(result.kind === "fatal" && result.errorCode, "invalid_access_fulfillment_configuration");
    assert.equal(sideEffectCalls, 0);
  });

  it("loads the client only for active reconcile-only mode", async () => {
    const client = new RecordingWorkerClient();
    const logger = new MemoryLogger(true);
    let loadCalls = 0;
    let factoryCalls = 0;
    let cleanupCalls = 0;
    let requestShutdown: (() => void) | undefined;
    const result = await runAccessFulfillmentWorkerMain({
      env: ACTIVE_ENV,
      logger,
      loadClient: async () => {
        loadCalls += 1;
        return client;
      },
      loadSupabaseClient: async () => {
        throw new Error("reconcile-only mode must not load durable Supabase");
      },
      loadEmailRuntime: async () => {
        throw new Error("reconcile-only mode must not load email runtime");
      },
      createWorker: (dependencies) => {
        factoryCalls += 1;
        assert.equal(dependencies.client, client);
        assert.equal(dependencies.emailCapability, undefined);
        return {
          async runLoop(signal) {
            assert.equal(signal.aborted, false);
            assert.ok(requestShutdown);
            requestShutdown();
            requestShutdown();
            assert.equal(signal.aborted, true);
            return { kind: "stopped", stopReason: "external_shutdown" };
          },
        };
      },
      registerSignalHandlers: (handler) => {
        requestShutdown = handler;
        return () => {
          cleanupCalls += 1;
        };
      },
    });

    assert.deepEqual(result, {
      kind: "stopped",
      exitCode: 0,
      stopReason: "external_shutdown",
    });
    assert.equal(loadCalls, 1);
    assert.equal(factoryCalls, 1);
    assert.equal(cleanupCalls, 1);
    assert.equal(client.claimCalls.length, 0);
    const startLog = logger.entries.find(
      (entry) => entry.event === "access_fulfillment_worker_started",
    );
    assert.equal(startLog?.metadata?.rpcTimeoutMs, WORKER_CONFIG.rpcTimeoutMs);
    const stoppedLog = logger.entries.find(
      (entry) => entry.event === "access_fulfillment_worker_stopped",
    );
    assert.deepEqual(stoppedLog?.metadata, {
      stopReason: "external_shutdown",
    });
    assert.equal("shutdown" in (stoppedLog?.metadata ?? {}), false);
    assert.equal(
      logger.entries.filter(
        (entry) => entry.event === "access_fulfillment_worker_shutdown_requested",
      ).length,
      1,
    );

    const initialSigtermListeners = process.rawListeners("SIGTERM").length;
    const initialSigintListeners = process.rawListeners("SIGINT").length;
    let repeatedSignalCalls = 0;
    const unregister = registerAccessFulfillmentWorkerSignalHandlers(() => {
      repeatedSignalCalls += 1;
    });
    try {
      const sigtermListener = process.rawListeners("SIGTERM")[initialSigtermListeners];
      const sigintListener = process.rawListeners("SIGINT")[initialSigintListeners];
      assert.ok(sigtermListener);
      assert.ok(sigintListener);
      sigtermListener.call(process);
      sigtermListener.call(process);
      sigintListener.call(process);
      sigintListener.call(process);
      assert.equal(repeatedSignalCalls, 4);
      assert.equal(process.rawListeners("SIGTERM").length, initialSigtermListeners + 1);
      assert.equal(process.rawListeners("SIGINT").length, initialSigintListeners + 1);
    } finally {
      unregister();
    }
    assert.equal(process.rawListeners("SIGTERM").length, initialSigtermListeners);
    assert.equal(process.rawListeners("SIGINT").length, initialSigintListeners);
  });

  it("composes the durable runtime lazily with exact bindings and shared Supabase ownership", async () => {
    const events: string[] = [];
    const logger = new MemoryLogger();
    const supabaseClient = Object.freeze(
      {},
    ) as unknown as AccessFulfillmentRuntimeSupabaseClient;
    const rpcClient = new RecordingWorkerClient();
    const reader = Object.freeze({}) as ReturnType<
      AccessFulfillmentEmailRuntime["createReader"]
    >;
    const emailData = canonicalEmailData();
    const builtMessage = canonicalBuiltMessage(emailData);
    let providerSendCalls = 0;
    let cleanupCalls = 0;
    let requestShutdown: (() => void) | undefined;
    let capabilityFromWorker: AccessFulfillmentEmailCapability | undefined;
    const provider: AccessFulfillmentEmailCapability["provider"] = {
      async send() {
        providerSendCalls += 1;
        return {
          kind: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
        };
      },
    };
    const emailRuntime: AccessFulfillmentEmailRuntime = {
      createReader(client) {
        events.push("reader");
        assert.equal(client, supabaseClient);
        return reader;
      },
      async loadMessageData(activeReader, orderId, options) {
        events.push("load");
        assert.equal(activeReader, reader);
        assert.equal(orderId, ORDER_A);
        assert.ok(options?.signal);
        return { kind: "success", orderId, data: emailData };
      },
      async buildMessage(input) {
        events.push("build");
        assert.deepEqual(input, {
          from: DURABLE_ENV.EMAIL_FROM_ADDRESS,
          buyerEmail: emailData.buyerEmail,
          buyerName: emailData.buyerName,
          publicRef: emailData.publicRef,
          sourceName: emailData.sourceName,
          accessDate: emailData.accessDate,
          qrBaseUrl: "https://runtime.example.test",
          entries: emailData.entries,
        });
        return builtMessage;
      },
      createProvider(options) {
        events.push("provider");
        assert.deepEqual(options, {
          apiKey: DURABLE_ENV.RESEND_API_KEY,
          timeoutMs: WORKER_CONFIG.emailProviderTimeoutMs,
        });
        return provider;
      },
      getQrBaseUrl() {
        events.push("qr_base_url");
        return "https://runtime.example.test";
      },
    };

    const result = await runAccessFulfillmentWorkerMain({
      env: DURABLE_ENV,
      logger,
      registerSignalHandlers: (handler) => {
        events.push("signals");
        requestShutdown = handler;
        return () => {
          events.push("unregister");
          cleanupCalls += 1;
        };
      },
      loadSupabaseClient: async () => {
        events.push("supabase");
        return supabaseClient;
      },
      createRpcClient: (transport) => {
        events.push("rpc");
        assert.equal(transport, supabaseClient);
        return rpcClient;
      },
      loadEmailRuntime: async () => {
        events.push("email_runtime");
        return emailRuntime;
      },
      createWorker: (dependencies) => {
        events.push("worker");
        assert.equal(dependencies.client, rpcClient);
        assert.equal(dependencies.config.durableEmailDeliveryEnabled, true);
        assert.ok(dependencies.emailCapability);
        capabilityFromWorker = dependencies.emailCapability;
        return {
          async runLoop(signal) {
            events.push("run_loop");
            assert.equal(signal.aborted, false);
            const loadResult = await dependencies.emailCapability?.load(ORDER_A, {
              signal,
            });
            assert.deepEqual(loadResult, {
              kind: "success",
              orderId: ORDER_A,
              data: emailData,
            });
            const buildResult = await dependencies.emailCapability?.build(emailData);
            assert.equal(buildResult, builtMessage);
            assert.ok(requestShutdown);
            requestShutdown();
            assert.equal(signal.aborted, true);
            return { kind: "stopped", stopReason: "external_shutdown" };
          },
        };
      },
    });

    assert.deepEqual(result, {
      kind: "stopped",
      exitCode: 0,
      stopReason: "external_shutdown",
    });
    assert.ok(capabilityFromWorker);
    assert.equal(capabilityFromWorker.provider, provider);
    assert.equal(providerSendCalls, 0);
    assert.equal(cleanupCalls, 1);
    assert.deepEqual(events, [
      "signals",
      "supabase",
      "rpc",
      "email_runtime",
      "reader",
      "qr_base_url",
      "provider",
      "worker",
      "run_loop",
      "load",
      "build",
      "unregister",
    ]);
    const startLog = logger.entries.find(
      (entry) => entry.event === "access_fulfillment_worker_started",
    );
    assert.deepEqual(startLog?.metadata, {
      mode: "durable_email",
      durableEmailDeliveryEnabled: true,
      provider: "resend",
      emailProviderTimeoutMs: WORKER_CONFIG.emailProviderTimeoutMs,
      batchSize: WORKER_CONFIG.batchSize,
      pollIntervalMs: WORKER_CONFIG.pollIntervalMs,
      leaseSeconds: WORKER_CONFIG.leaseSeconds,
      concurrency: WORKER_CONFIG.concurrency,
      rpcTimeoutMs: WORKER_CONFIG.rpcTimeoutMs,
    });
    const serializedLogs = JSON.stringify(logger.entries);
    assert.equal(serializedLogs.includes(DURABLE_ENV.RESEND_API_KEY), false);
    assert.equal(serializedLogs.includes(DURABLE_ENV.EMAIL_FROM_ADDRESS), false);
    assert.equal(serializedLogs.includes("https://runtime.example.test"), false);
  });

  it("fails closed and cleans signal handlers for durable startup failures", async () => {
    const stages = ["supabase", "reader", "provider", "worker"] as const;

    for (const failingStage of stages) {
      const logger = new MemoryLogger();
      const supabaseClient = Object.freeze(
        {},
      ) as unknown as AccessFulfillmentRuntimeSupabaseClient;
      const reader = Object.freeze({}) as ReturnType<
        AccessFulfillmentEmailRuntime["createReader"]
      >;
      let cleanupCalls = 0;
      let providerSendCalls = 0;
      const emailRuntime: AccessFulfillmentEmailRuntime = {
        createReader() {
          if (failingStage === "reader") {
            throw new Error("synthetic reader construction failure");
          }
          return reader;
        },
        async loadMessageData(_reader, orderId) {
          return { kind: "success", orderId, data: canonicalEmailData() };
        },
        async buildMessage(input) {
          return canonicalBuiltMessage(input);
        },
        createProvider() {
          if (failingStage === "provider") {
            throw new Error("synthetic provider construction failure");
          }
          return {
            async send() {
              providerSendCalls += 1;
              return {
                kind: "accepted",
                providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
              };
            },
          };
        },
        getQrBaseUrl() {
          return "https://runtime.example.test";
        },
      };
      const result = await runAccessFulfillmentWorkerMain({
        env: DURABLE_ENV,
        logger,
        registerSignalHandlers: () => () => {
          cleanupCalls += 1;
        },
        loadSupabaseClient: async () => {
          if (failingStage === "supabase") {
            throw new Error("synthetic Supabase load failure");
          }
          return supabaseClient;
        },
        createRpcClient: () => new RecordingWorkerClient(),
        loadEmailRuntime: async () => emailRuntime,
        createWorker: () => {
          if (failingStage === "worker") {
            throw new Error("synthetic worker construction failure");
          }
          return {
            async runLoop() {
              assert.fail("startup failure must not run the worker");
            },
          };
        },
      });

      assert.deepEqual(result, {
        kind: "fatal",
        exitCode: 1,
        stopReason: "fatal_stop",
        errorCode: "worker_startup_failed",
      });
      assert.equal(cleanupCalls, 1);
      assert.equal(providerSendCalls, 0);
      const serializedLogs = JSON.stringify(logger.entries);
      assert.equal(serializedLogs.includes(DURABLE_ENV.RESEND_API_KEY), false);
      assert.equal(serializedLogs.includes(DURABLE_ENV.EMAIL_FROM_ADDRESS), false);
      assert.equal(serializedLogs.includes("synthetic"), false);
    }
  });

  it("propagates a runtime fatal stop through the main result and final log", async () => {
    const logger = new MemoryLogger();
    const client = new RecordingWorkerClient();
    client.claimHandler = () => ({
      kind: "malformed_response",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      field: "items",
      reason: "Required",
    });
    const result = await runAccessFulfillmentWorkerMain({
      env: ACTIVE_ENV,
      logger,
      loadClient: async () => client,
      generateToken: () => TOKEN_A,
      registerSignalHandlers: () => () => undefined,
    });

    assert.deepEqual(result, {
      kind: "fatal",
      exitCode: 1,
      stopReason: "fatal_stop",
      errorCode: "worker_claim_malformed_response",
    });
    const fatalLatchLogs = logger.entries.filter(
      (entry) => entry.event === "access_fulfillment_worker_fatal_latched",
    );
    assert.equal(fatalLatchLogs.length, 1);
    assert.deepEqual(fatalLatchLogs[0]?.metadata, {
      errorCode: "worker_claim_malformed_response",
      stopReason: "fatal_stop",
    });
    const stoppedLogs = logger.entries.filter(
      (entry) => entry.event === "access_fulfillment_worker_stopped",
    );
    assert.equal(stoppedLogs.length, 1);
    assert.deepEqual(stoppedLogs[0]?.metadata, {
      errorCode: "worker_claim_malformed_response",
      stopReason: "fatal_stop",
    });
    assert.equal("shutdown" in (stoppedLogs[0]?.metadata ?? {}), false);
  });
});

describe("access fulfillment worker claim lifecycle", () => {
  it("completes a fresh empty cycle without processing items", async () => {
    const client = new RecordingWorkerClient();
    const harness = createWorkerHarness(client);
    const result = await harness.worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "empty");
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(harness.generatedTokenCount(), 1);
    assert.equal(harness.logger.entries.some((entry) => entry.event === "access_fulfillment_batch_empty"), true);
  });

  it("sleeps for the configured poll interval after an empty batch", async () => {
    const client = new RecordingWorkerClient();
    const controller = new AbortController();
    const sleepCalls: number[] = [];
    const harness = createWorkerHarness(client, {
      sleep: async (milliseconds) => {
        sleepCalls.push(milliseconds);
        controller.abort();
      },
    });
    const result = await harness.worker.runLoop(controller.signal);

    assert.deepEqual(result, {
      kind: "stopped",
      stopReason: "external_shutdown",
    });
    assert.deepEqual(sleepCalls, [WORKER_CONFIG.pollIntervalMs]);
    assert.equal(client.claimCalls.length, 1);
    assert.equal(harness.generatedTokenCount(), 1);
  });

  it("classifies a poll sleep failure as a fatal stop", async () => {
    const client = new RecordingWorkerClient();
    const harness = createWorkerHarness(client, {
      sleep: async () => {
        throw new Error("Synthetic poll sleep failure");
      },
    });

    const result = await harness.worker.runLoop(
      new AbortController().signal,
    );

    assert.deepEqual(result, {
      kind: "fatal",
      stopReason: "fatal_stop",
      errorCode: "worker_poll_sleep_failed",
    });
    const stoppedLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_worker_fatal_latched",
    );
    assert.deepEqual(stoppedLog?.metadata, {
      errorCode: "worker_poll_sleep_failed",
      stopReason: "fatal_stop",
    });
  });

  it("processes fresh and replayed non-empty claims", async () => {
    for (const idempotent of [false, true]) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)], idempotent);
      const harness = createWorkerHarness(client);
      const result = await harness.worker.runOnce(new AbortController().signal);

      assert.equal(result.kind, "completed");
      assert.equal(result.summary.reconciledCount, 1);
      assert.deepEqual(client.claimCalls, [
        {
          reconcileLeaseToken: TOKEN_A,
          limit: WORKER_CONFIG.batchSize,
          leaseSeconds: WORKER_CONFIG.leaseSeconds,
        },
      ]);
      assert.deepEqual(client.reconcileCalls, [
        {
          orderId: ORDER_A,
          paymentAttemptId: PAYMENT_A,
          reconcileLeaseToken: TOKEN_A,
          reconcileLeaseEpoch: 1,
        },
      ]);
      assert.equal(client.releaseCalls.length, 0);
      assert.equal(
        harness.logger.entries.find(
          (entry) => entry.event === "access_fulfillment_batch_claimed",
        )?.metadata?.idempotent,
        idempotent,
      );
    }
  });

  it("reuses one token and never overlaps claim retries after transport ambiguity", async () => {
    const client = new RecordingWorkerClient();
    let call = 0;
    let activeClaims = 0;
    let maximumActiveClaims = 0;
    client.claimHandler = async () => {
      activeClaims += 1;
      maximumActiveClaims = Math.max(maximumActiveClaims, activeClaims);
      await Promise.resolve();
      activeClaims -= 1;
      call += 1;
      if (call === 1) {
        return {
          kind: "transport_error",
          rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
          message: "Supabase RPC transport failed",
        };
      }
      return batchSuccess([]);
    };
    const harness = createWorkerHarness(client);
    const result = await harness.worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "empty");
    assert.equal(maximumActiveClaims, 1);
    assert.equal(harness.generatedTokenCount(), 1);
    assert.deepEqual(
      client.claimCalls.map((input) => input.reconcileLeaseToken),
      [TOKEN_A, TOKEN_A],
    );
    assert.deepEqual(harness.sleepCalls, [1_000]);
  });

  it("generates a new token only after the prior cycle concludes", async () => {
    const client = new RecordingWorkerClient();
    const harness = createWorkerHarness(client, { tokens: [TOKEN_A, TOKEN_B] });

    await harness.worker.runOnce(new AbortController().signal);
    await harness.worker.runOnce(new AbortController().signal);

    assert.deepEqual(
      client.claimCalls.map((input) => input.reconcileLeaseToken),
      [TOKEN_A, TOKEN_B],
    );
  });

  it("retries retryable business errors with the same token", async () => {
    const client = new RecordingWorkerClient();
    let call = 0;
    client.claimHandler = () => {
      call += 1;
      return call === 1
        ? {
          kind: "business_error",
          rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
          response: {
            ok: false,
            retryable: true,
            error: { code: "concurrency_conflict", message: "Retryable" },
          },
        }
        : batchSuccess([]);
    };
    const harness = createWorkerHarness(client);
    const result = await harness.worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "empty");
    assert.equal(client.claimCalls.length, 2);
    assert.equal(new Set(client.claimCalls.map((input) => input.reconcileLeaseToken)).size, 1);
  });

  it("aborts a never-settling claim, retries with the same token, and ignores the late response", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const firstClaim = deferred<ClaimFulfillmentBatchResult>();
    let call = 0;
    client.claimHandler = () => {
      call += 1;
      return call === 1 ? firstClaim.promise : batchSuccess([]);
    };
    const harness = createWorkerHarness(client, {
      createDeadline: controlledDeadlineFactory(scheduler),
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.claimCalls.length === 1);
    const firstSignal = client.claimSignals[0];
    assert.ok(firstSignal);
    scheduler.fire(0);
    const result = await pendingRun;

    assert.equal(result.kind, "empty");
    assert.equal(result.stopReason, "normal_completion");
    assert.deepEqual(
      client.claimCalls.map((input) => input.reconcileLeaseToken),
      [TOKEN_A, TOKEN_A],
    );
    assert.equal(client.claimSignals.length, 2);
    assert.notEqual(client.claimSignals[0], client.claimSignals[1]);
    assert.equal(firstSignal.aborted, true);
    assert.equal(client.claimSignals[1]?.aborted, false);
    assert.equal(
      harness.logger.entries.some(
        (entry) => entry.metadata?.errorCode === "worker_claim_timeout",
      ),
      true,
    );
    assert.equal(scheduler.entries.every((entry) => entry.cancelCalls === 1), true);

    const logCount = harness.logger.entries.length;
    firstClaim.resolve(batchSuccess([claimedItem(ORDER_A)]));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(harness.logger.entries.length, logCount);
  });

  it("classifies external abort during claim without retrying or logging a timeout", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const pendingClaim = deferred<ClaimFulfillmentBatchResult>();
    client.claimHandler = () => pendingClaim.promise;
    const harness = createWorkerHarness(client, {
      createDeadline: controlledDeadlineFactory(scheduler),
    });
    const controller = new AbortController();

    const pendingRun = harness.worker.runOnce(controller.signal);
    await waitFor(() => client.claimCalls.length === 1);
    controller.abort();
    const result = await pendingRun;

    assert.equal(result.kind, "shutdown");
    assert.equal(result.stopReason, "external_shutdown");
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.claimSignals[0]?.aborted, true);
    assert.equal(
      harness.logger.entries.some(
        (entry) => entry.metadata?.errorCode === "worker_claim_timeout",
      ),
      false,
    );
    assert.equal(scheduler.entries[0]?.cancelCalls, 1);

    const logCount = harness.logger.entries.length;
    pendingClaim.resolve(batchSuccess([claimedItem(ORDER_A)]));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(harness.logger.entries.length, logCount);
  });

  it("anchors a fresh lease budget at the conclusive claim attempt start", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const clock = new ManualMonotonicClock(100);
    client.claimHandler = () => {
      clock.set(2_000);
      return batchSuccess([claimedItem(ORDER_A)], false);
    };
    const result = await createWorkerHarness(client, {
      config: { leaseSeconds: 30, rpcTimeoutMs: 25_000 },
      now: clock.now,
      createDeadline: controlledDeadlineFactory(scheduler),
    }).worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "completed");
    assert.equal(result.stopReason, "normal_completion");
    assert.deepEqual(
      scheduler.entries.map((entry) => entry.timeoutMs),
      [25_000, 23_100],
    );
  });

  it("anchors a replay budget at the first attempt made with that token", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const clock = new ManualMonotonicClock(100);
    let call = 0;
    client.claimHandler = () => {
      call += 1;
      if (call === 1) {
        clock.set(500);
        return {
          kind: "transport_error",
          rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
          message: "Supabase RPC transport failed",
        };
      }
      clock.set(6_000);
      return batchSuccess([claimedItem(ORDER_A)], true);
    };
    const result = await createWorkerHarness(client, {
      config: { leaseSeconds: 30, rpcTimeoutMs: 25_000 },
      now: clock.now,
      sleep: async () => {
        clock.set(5_000);
      },
      createDeadline: controlledDeadlineFactory(scheduler),
    }).worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "completed");
    assert.deepEqual(
      scheduler.entries.map((entry) => entry.timeoutMs),
      [25_000, 25_000, 19_100],
    );
    assert.equal(client.claimCalls.length, 2);
    assert.equal(new Set(client.claimCalls.map((input) => input.reconcileLeaseToken)).size, 1);
  });

  it("stops fatally on malformed and terminal business claim responses", async () => {
    const fatalClaims: ClaimFulfillmentBatchResult[] = [
      {
        kind: "malformed_response",
        rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
        field: "items",
        reason: "Required",
      },
      {
        kind: "business_error",
        rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
        response: {
          ok: false,
          error: { code: "internal_error", message: "Terminal" },
        },
      },
    ];

    for (const claim of fatalClaims) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => claim;
      const result = await createWorkerHarness(client).worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "fatal");
      assert.equal(client.reconcileCalls.length, 0);
      assert.equal(client.releaseCalls.length, 0);
    }
  });

  it("bounds replay backoff below poll and half the lease", () => {
    const config = { ...WORKER_CONFIG, pollIntervalMs: 60_000, leaseSeconds: 30 };
    const delays = [1, 2, 3, 4, 5, 10].map((attempt) =>
      accessFulfillmentClaimRetryDelayMs(attempt, config),
    );
    assert.deepEqual(delays, [1_000, 2_000, 4_000, 5_000, 5_000, 5_000]);
    assert.equal(delays.every((delay) => delay < config.leaseSeconds * 1_000 / 2), true);
  });
});

describe("access fulfillment worker item handling", () => {
  it("does not release after reconcile success or stale lease", async () => {
    for (const reconcileResult of [
      undefined,
      reconcileBusinessError("stale_lease"),
    ]) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
      if (reconcileResult) {
        client.reconcileHandler = () => reconcileResult;
      }
      const result = await createWorkerHarness(client).worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(client.reconcileCalls.length, 1);
      assert.equal(client.releaseCalls.length, 0);
      assert.equal(
        reconcileResult ? result.summary.staleCount : result.summary.reconciledCount,
        1,
      );
    }
  });

  it("does not accept a reconcile success correlated to another order or payment", async () => {
    for (const responseIdentity of [
      { orderId: ORDER_B, paymentAttemptId: PAYMENT_A },
      { orderId: ORDER_A, paymentAttemptId: PAYMENT_B },
    ]) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
      client.reconcileHandler = (input) => ({
        kind: "success",
        rpc: ACCESS_FULFILLMENT_RPC.reconcile,
        response: {
          ...reconcileSuccess(input).response,
          order_id: responseIdentity.orderId,
          payment_attempt_id: responseIdentity.paymentAttemptId,
        },
      });
      const result = await createWorkerHarness(client).worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.summary.reconciledCount, 0);
      assert.equal(result.summary.failedCount, 1);
      assert.equal(client.releaseCalls.length, 1);
      assert.equal(
        client.releaseCalls[0]?.errorCode,
        "worker_reconcile_malformed_response",
      );
    }
  });

  it("attempts one safe release for every non-stale reconcile failure kind", async () => {
    const failures: Array<{
      result: ReconcileOrderFulfillmentResult;
      expectedErrorCode: string;
    }> = [
      {
        result: {
          kind: "transport_error",
          rpc: ACCESS_FULFILLMENT_RPC.reconcile,
          message: "Supabase RPC transport failed",
        },
        expectedErrorCode: "worker_reconcile_transport_error",
      },
      {
        result: {
          kind: "malformed_response",
          rpc: ACCESS_FULFILLMENT_RPC.reconcile,
          field: "status",
          reason: "Required",
        },
        expectedErrorCode: "worker_reconcile_malformed_response",
      },
      {
        result: {
          kind: "unknown_status",
          rpc: ACCESS_FULFILLMENT_RPC.reconcile,
          field: "status",
          status: "future_status",
        },
        expectedErrorCode: "worker_reconcile_unknown_status",
      },
      {
        result: reconcileBusinessError("entries_count_mismatch"),
        expectedErrorCode: "entries_count_mismatch",
      },
    ];

    for (const failure of failures) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
      client.reconcileHandler = () => failure.result;
      const result = await createWorkerHarness(client).worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.summary.failedCount, 1);
      assert.equal(client.releaseCalls.length, 1);
      assert.deepEqual(client.releaseCalls[0], {
        orderId: ORDER_A,
        reconcileLeaseToken: TOKEN_A,
        reconcileLeaseEpoch: 1,
        retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
        errorCode: failure.expectedErrorCode,
      });
    }
  });

  it("classifies every release outcome without inventing lease authority", async () => {
    const scenarios: Array<{
      name: string;
      releaseHandler: ReleaseHandler;
      failedCount: number;
      staleCount: number;
      releaseFailedCount: number;
      terminal?: boolean;
      releaseErrorCode?: string;
    }> = [
      {
        name: "retryable success",
        releaseHandler: releaseSuccess,
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 0,
        terminal: false,
      },
      {
        name: "terminal success",
        releaseHandler: (input) => ({
          kind: "success",
          rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
          response: {
            ok: true,
            status: "released",
            terminal: true,
            order_id: input.orderId,
            epoch: input.reconcileLeaseEpoch,
            retryable: false,
          },
        }),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 0,
        terminal: true,
      },
      {
        name: "stale lease",
        releaseHandler: () => releaseBusinessError("stale_lease"),
        failedCount: 0,
        staleCount: 1,
        releaseFailedCount: 0,
      },
      {
        name: "transport error",
        releaseHandler: () => ({
          kind: "transport_error",
          rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
          message: "Supabase RPC transport failed",
        }),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "worker_release_transport_error",
      },
      {
        name: "malformed response",
        releaseHandler: () => ({
          kind: "malformed_response",
          rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
          field: "status",
          reason: "Required",
        }),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "worker_release_malformed_response",
      },
      {
        name: "unknown status",
        releaseHandler: () => ({
          kind: "unknown_status",
          rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
          field: "status",
          status: "future_status",
        }),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "worker_release_unknown_status",
      },
      {
        name: "safe future business error",
        releaseHandler: () => releaseBusinessError("future_release_error"),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "future_release_error",
      },
      {
        name: "unsafe future business error",
        releaseHandler: () => releaseBusinessError("future release/error"),
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "worker_release_business_error",
      },
      {
        name: "thrown release",
        releaseHandler: () => {
          throw new Error("Synthetic release transport failure");
        },
        failedCount: 1,
        staleCount: 0,
        releaseFailedCount: 1,
        releaseErrorCode: "worker_release_transport_error",
      },
    ];

    for (const scenario of scenarios) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
      client.reconcileHandler = () => reconcileBusinessError("entries_count_mismatch");
      client.releaseHandler = scenario.releaseHandler;
      const harness = createWorkerHarness(client);
      const result = await harness.worker.runOnce(new AbortController().signal);

      assert.equal(client.releaseCalls.length, 1, scenario.name);
      assert.equal(result.summary.failedCount, scenario.failedCount, scenario.name);
      assert.equal(result.summary.staleCount, scenario.staleCount, scenario.name);
      assert.equal(
        result.summary.releaseFailedCount,
        scenario.releaseFailedCount,
        scenario.name,
      );
      if (scenario.staleCount === 1) {
        assert.equal(
          harness.logger.entries.some(
            (entry) => entry.event === "access_fulfillment_stale_lease",
          ),
          true,
          scenario.name,
        );
      } else {
        const failureLog = harness.logger.entries.find(
          (entry) => entry.event === "access_fulfillment_item_failed",
        );
        assert.ok(failureLog, scenario.name);
        assert.equal(
          failureLog.metadata?.releaseErrorCode,
          scenario.releaseErrorCode,
          scenario.name,
        );
        if (scenario.terminal !== undefined) {
          assert.equal(failureLog.metadata?.terminal, scenario.terminal, scenario.name);
        }
      }
    }
  });

  it("reports a release success correlated to another order or epoch as unresolved", async () => {
    for (const responseIdentity of [
      { orderId: ORDER_B, epoch: 1 },
      { orderId: ORDER_A, epoch: 2 },
    ]) {
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
      client.reconcileHandler = () => reconcileBusinessError("entries_count_mismatch");
      client.releaseHandler = () => ({
        kind: "success",
        rpc: ACCESS_FULFILLMENT_RPC.releaseLease,
        response: {
          ok: true,
          status: "released",
          order_id: responseIdentity.orderId,
          epoch: responseIdentity.epoch,
          retryable: true,
        },
      });
      const result = await createWorkerHarness(client).worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.summary.failedCount, 1);
      assert.equal(result.summary.releaseFailedCount, 1);
      assert.equal(client.releaseCalls.length, 1);
    }
  });

  it("latches the first fatal boundary, aborts peers, and never cleans pending claims", async () => {
    for (const failureKind of ["provider", "unexpected"] as const) {
      const items = [
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
        claimedItem(ORDER_D, "issuance", 4),
      ];
      const client = new RecordingWorkerClient();
      client.claimHandler = () => batchSuccess(items);
      const activeReconcile = deferred<ReconcileOrderFulfillmentResult>();
      client.reconcileHandler = (input) => {
        if (input.orderId === ORDER_A) {
          if (failureKind === "provider") {
            return reconcileBusinessError("entries_count_mismatch");
          }
          return new Proxy(reconcileSuccess(input), {
            get(target, property, receiver) {
              if (property === "kind") {
                throw new Error("Synthetic unexpected item invariant");
              }
              return Reflect.get(target, property, receiver);
            },
          });
        }
        if (input.orderId === ORDER_B) {
          return activeReconcile.promise;
        }
        assert.fail(`Pending order was reconciled for ${failureKind}`);
      };
      client.releaseHandler = (input) =>
        failureKind === "provider" && input.orderId === ORDER_A
          ? releaseBusinessError("provider_outcome_required")
          : releaseSuccess(input);
      const harness = createWorkerHarness(client, {
        tokens: [TOKEN_A, TOKEN_B],
        config: { concurrency: 2 },
        ...(failureKind === "unexpected"
          ? {
            logger: new MemoryLogger(true),
          }
          : {}),
      });
      const loop = harness.worker.runLoop(new AbortController().signal);

      await waitFor(() => client.reconcileCalls.length === 2);
      const activeInput = client.reconcileCalls.find((input) => input.orderId === ORDER_B);
      assert.ok(activeInput);
      const result = await loop;

      assert.deepEqual(result, {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode:
          failureKind === "provider"
            ? "provider_outcome_required"
            : "worker_item_unexpected_error",
      });
      assert.equal(client.claimCalls.length, 1, failureKind);
      assert.equal(harness.generatedTokenCount(), 1, failureKind);
      assert.deepEqual(
        client.reconcileCalls.map((input) => input.orderId),
        [ORDER_A, ORDER_B],
        failureKind,
      );
      assert.deepEqual(
        client.releaseCalls.map((input) => ({
          orderId: input.orderId,
          retryAfterSeconds: input.retryAfterSeconds,
          errorCode: input.errorCode,
        })),
        failureKind === "provider"
          ? [
            {
              orderId: ORDER_A,
              retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
              errorCode: "entries_count_mismatch",
            },
          ]
          : [],
        failureKind,
      );
      const activeSignal =
        client.reconcileSignals[
          client.reconcileCalls.findIndex((input) => input.orderId === ORDER_B)
        ];
      assert.equal(activeSignal?.aborted, true, failureKind);

      const logCount = harness.logger.entries.length;
      activeReconcile.reject(new Error("Synthetic late peer rejection"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(harness.logger.entries.length, logCount, failureKind);
      assert.equal(client.reconcileCalls.length, 2, failureKind);
      assert.equal(client.releaseCalls.length, failureKind === "provider" ? 1 : 0);

      const expectedErrorCode =
        failureKind === "provider"
          ? "provider_outcome_required"
          : "worker_item_unexpected_error";
      const repeatedLatch = (
        harness.worker as unknown as {
          latchFatalStop(errorCode: string): { readonly errorCode: string };
        }
      ).latchFatalStop("secondary_fatal_must_not_win");
      assert.equal(repeatedLatch.errorCode, expectedErrorCode, failureKind);
      assert.equal(harness.logger.entries.length, logCount, failureKind);
      assert.deepEqual(
        await harness.worker.runOnce(new AbortController().signal),
        {
          kind: "fatal",
          stopReason: "fatal_stop",
          errorCode: expectedErrorCode,
          summary: {
            claimedCount: 0,
            reconciledCount: 0,
            deferredCount: 0,
            failedCount: 0,
            staleCount: 0,
            shutdownReleasedCount: 0,
            localLeaseBudgetExhaustedCount: 0,
            releaseFailedCount: 0,
            emailAcceptedCount: 0,
            emailRetryScheduledCount: 0,
            emailAmbiguousCount: 0,
            emailSkippedSentCount: 0,
            emailUnsettledCount: 0,
            emailManualReviewCount: 0,
            emailManualReviewUnknownCount: 0,
          },
        },
        failureKind,
      );
      assert.deepEqual(
        await harness.worker.runLoop(new AbortController().signal),
        {
          kind: "fatal",
          stopReason: "fatal_stop",
          errorCode: expectedErrorCode,
        },
        failureKind,
      );
      assert.equal(harness.generatedTokenCount(), 1, failureKind);
      assert.equal(client.claimCalls.length, 1, failureKind);
    }
  });

  it("defers email only by release with null error code and lease-sized retry", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A, "email", 9)]);
    const result = await createWorkerHarness(client).worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.deferredCount, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.deepEqual(client.releaseCalls, [
      {
        orderId: ORDER_A,
        reconcileLeaseToken: TOKEN_A,
        reconcileLeaseEpoch: 9,
        retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
        errorCode: null,
      },
    ]);
  });

  it("enforces exact configured concurrency and keeps epochs per order", async () => {
    const items = [ORDER_A, ORDER_B, ORDER_C, ORDER_D, ORDER_E].map((order, index) =>
      claimedItem(order, "issuance", index + 1),
    );
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess(items);
    let active = 0;
    let maximumActive = 0;
    client.reconcileHandler = async (input) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active -= 1;
      return reconcileSuccess(input);
    };
    const result = await createWorkerHarness(client, {
      config: { concurrency: 2 },
    }).worker.runOnce(new AbortController().signal);

    assert.equal(result.summary.reconciledCount, items.length);
    assert.equal(maximumActive, 2);
    assert.deepEqual(
      client.reconcileCalls.map((input) => input.reconcileLeaseEpoch),
      [1, 2, 3, 4, 5],
    );
  });

  it("continues other items after one item fails", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
      ]);
    client.reconcileHandler = (input) =>
      input.orderId === ORDER_B
        ? reconcileBusinessError("entries_count_mismatch")
        : reconcileSuccess(input);
    const result = await createWorkerHarness(client).worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(client.reconcileCalls.length, 3);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(result.summary.reconciledCount, 2);
    assert.equal(result.summary.failedCount, 1);
  });
});

describe("access fulfillment worker deadlines and local lease budget", () => {
  it("caps reconcile below 1000 ms, performs one SQL-fenced release, and ignores late success", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const clock = new ManualMonotonicClock(0);
    const pendingReconcile = deferred<ReconcileOrderFulfillmentResult>();
    client.claimHandler = () => {
      clock.set(24_500);
      return batchSuccess([claimedItem(ORDER_A)]);
    };
    client.reconcileHandler = () => pendingReconcile.promise;
    const harness = createWorkerHarness(client, {
      config: { leaseSeconds: 30, rpcTimeoutMs: 25_000 },
      now: clock.now,
      createDeadline: controlledDeadlineFactory(scheduler),
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.reconcileCalls.length === 1);
    assert.equal(scheduler.entries[1]?.timeoutMs, 500);
    scheduler.fire(1);
    const result = await pendingRun;

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.failedCount, 1);
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(client.reconcileSignals[0]?.aborted, true);
    assert.notEqual(client.reconcileSignals[0], client.releaseSignals[0]);
    assert.equal(client.releaseCalls[0]?.errorCode, "worker_reconcile_timeout");
    assert.deepEqual(
      scheduler.entries.map((entry) => entry.timeoutMs),
      [25_000, 500, 500],
    );

    const logCount = harness.logger.entries.length;
    pendingReconcile.resolve(reconcileSuccess(client.reconcileCalls[0]!));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(harness.logger.entries.length, logCount);
  });

  it("does not start another item RPC after the conservative batch budget is exhausted", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const clock = new ManualMonotonicClock(0);
    client.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
      ]);
    client.reconcileHandler = (input) => {
      assert.equal(input.orderId, ORDER_A);
      clock.set(25_000);
      return reconcileSuccess(input);
    };
    const harness = createWorkerHarness(client, {
      tokens: [TOKEN_A, TOKEN_B],
      config: {
        leaseSeconds: 30,
        rpcTimeoutMs: 25_000,
        concurrency: 1,
      },
      now: clock.now,
      createDeadline: controlledDeadlineFactory(scheduler),
    });

    const result = await harness.worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "local_lease_budget_exhausted",
    );
    assert.equal(result.summary.reconciledCount, 1);
    assert.equal(result.summary.localLeaseBudgetExhaustedCount, 1);
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(client.claimCalls.length, 1);
    assert.equal(harness.generatedTokenCount(), 1);
    assert.deepEqual(
      await harness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "local_lease_budget_exhausted",
      },
    );
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(harness.generatedTokenCount(), 1);
    const budgetLog = harness.logger.entries.find(
      (entry) =>
        entry.event === "access_fulfillment_local_lease_budget_exhausted",
    );
    assert.ok(budgetLog?.metadata);
    assert.deepEqual(Object.keys(budgetLog.metadata).sort(), [
      "durationMs",
      "errorCode",
      "remainingBudgetBucket",
    ]);
    assert.equal(
      budgetLog.metadata.errorCode,
      "local_lease_budget_exhausted",
    );

    const loopClient = new RecordingWorkerClient();
    const loopScheduler = new ControlledDeadlineScheduler();
    const loopClock = new ManualMonotonicClock(0);
    loopClient.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
      ]);
    loopClient.reconcileHandler = (input) => {
      assert.equal(input.orderId, ORDER_A);
      loopClock.set(25_000);
      return reconcileSuccess(input);
    };
    const loopHarness = createWorkerHarness(loopClient, {
      tokens: [TOKEN_A, TOKEN_B],
      config: {
        leaseSeconds: 30,
        rpcTimeoutMs: 25_000,
        concurrency: 1,
      },
      now: loopClock.now,
      createDeadline: controlledDeadlineFactory(loopScheduler),
    });

    assert.deepEqual(
      await loopHarness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "local_lease_budget_exhausted",
      },
    );
    assert.equal(loopClient.claimCalls.length, 1);
    assert.equal(loopClient.reconcileCalls.length, 1);
    assert.equal(loopClient.releaseCalls.length, 0);
    assert.equal(loopHarness.generatedTokenCount(), 1);
  });

  it("does not start release when reconcile consumes the local lease budget", async () => {
    const client = new RecordingWorkerClient();
    const clock = new ManualMonotonicClock(0);
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
    client.reconcileHandler = () => {
      clock.set(25_000);
      return reconcileBusinessError("entries_count_mismatch");
    };
    const harness = createWorkerHarness(client, {
      config: { leaseSeconds: 30, rpcTimeoutMs: 25_000 },
      now: clock.now,
    });
    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "local_lease_budget_exhausted",
    );
    assert.equal(result.summary.localLeaseBudgetExhaustedCount, 1);
    assert.equal(result.summary.failedCount, 0);
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 0);
    const budgetLog = harness.logger.entries.find(
      (entry) =>
        entry.event === "access_fulfillment_local_lease_budget_exhausted",
    );
    assert.deepEqual(budgetLog?.metadata, {
      errorCode: "local_lease_budget_exhausted",
      remainingBudgetBucket: "exhausted",
      durationMs: 25_000,
    });
  });

  for (const scenario of [
    { name: "NaN", readings: [Number.NaN] },
    {
      name: "positive and negative Infinity",
      readings: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    },
    {
      name: "an exception",
      readings: [new Error("Synthetic monotonic clock failure")],
    },
  ] as const) {
    it(`permanently latches ${scenario.name} from the monotonic clock`, async () => {
      for (const reading of scenario.readings) {
        const client = new RecordingWorkerClient();
        const clock = new ScriptedMonotonicClock([reading], 100);
        const harness = createWorkerHarness(client, {
          tokens: [TOKEN_A, TOKEN_B],
          now: clock.now,
        });

        const first = await harness.worker.runOnce(
          new AbortController().signal,
        );
        assert.equal(first.kind, "fatal");
        assert.equal(first.stopReason, "fatal_stop");
        assert.equal(
          first.kind === "fatal" && first.errorCode,
          "worker_monotonic_clock_invalid",
        );
        assert.deepEqual(
          await harness.worker.runOnce(new AbortController().signal),
          {
            kind: "fatal",
            stopReason: "fatal_stop",
            errorCode: "worker_monotonic_clock_invalid",
            summary: {
              claimedCount: 0,
              reconciledCount: 0,
              deferredCount: 0,
              failedCount: 0,
              staleCount: 0,
              shutdownReleasedCount: 0,
              localLeaseBudgetExhaustedCount: 0,
              releaseFailedCount: 0,
              emailAcceptedCount: 0,
              emailRetryScheduledCount: 0,
              emailAmbiguousCount: 0,
              emailSkippedSentCount: 0,
              emailUnsettledCount: 0,
              emailManualReviewCount: 0,
              emailManualReviewUnknownCount: 0,
            },
          },
        );
        assert.deepEqual(
          await harness.worker.runLoop(new AbortController().signal),
          {
            kind: "fatal",
            stopReason: "fatal_stop",
            errorCode: "worker_monotonic_clock_invalid",
          },
        );
        assert.equal(clock.calls, 1);
        assert.equal(harness.generatedTokenCount(), 1);
        assert.equal(client.claimCalls.length, 0);
        assert.equal(client.reconcileCalls.length, 0);
        assert.equal(client.releaseCalls.length, 0);
        const stoppedLog = harness.logger.entries.find(
          (entry) =>
            entry.event === "access_fulfillment_worker_fatal_latched",
        );
        assert.deepEqual(stoppedLog?.metadata, {
          errorCode: "worker_monotonic_clock_invalid",
          stopReason: "fatal_stop",
        });
      }
    });
  }

  it("stops fatally without an item RPC when the monotonic clock moves backward", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
    const clock = new ScriptedMonotonicClock([100, 110, 120, 119], 130);
    const harness = createWorkerHarness(client, {
      tokens: [TOKEN_A, TOKEN_B],
      now: clock.now,
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_monotonic_clock_invalid",
    );
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(harness.generatedTokenCount(), 1);
    assert.equal(clock.calls, 4);
    assert.deepEqual(
      await harness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "worker_monotonic_clock_invalid",
      },
    );
    assert.equal(harness.generatedTokenCount(), 1);
    assert.equal(clock.calls, 4);
    const stoppedLog = harness.logger.entries.find(
      (entry) =>
        entry.event === "access_fulfillment_worker_fatal_latched" &&
        entry.metadata?.errorCode === "worker_monotonic_clock_invalid",
    );
    assert.deepEqual(stoppedLog?.metadata, {
      errorCode: "worker_monotonic_clock_invalid",
      stopReason: "fatal_stop",
    });
  });

  it("treats a stale release after reconcile timeout as safe loss of authority", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const pendingReconcile = deferred<ReconcileOrderFulfillmentResult>();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
    client.reconcileHandler = () => pendingReconcile.promise;
    client.releaseHandler = () => releaseBusinessError("stale_lease");
    const harness = createWorkerHarness(client, {
      createDeadline: controlledDeadlineFactory(scheduler),
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.reconcileCalls.length === 1);
    scheduler.fire(1);
    const result = await pendingRun;

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.staleCount, 1);
    assert.equal(result.summary.failedCount, 0);
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 1);
    const staleLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_stale_lease",
    );
    assert.equal(staleLog?.metadata?.errorCode, "stale_lease");
    assert.equal(
      staleLog?.metadata?.originStage,
      "issuance_failure_release",
    );

    const terminalLogCount = harness.logger.entries.length;
    pendingReconcile.resolve(reconcileSuccess(client.reconcileCalls[0]!));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.reconcileCalls.length, 1);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(harness.logger.entries.length, terminalLogCount);
  });

  it("aborts a never-settling release once and ignores its late response", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const pendingRelease = deferred<ReleaseFulfillmentLeaseResult>();
    client.claimHandler = () =>
      batchSuccess([claimedItem(ORDER_A, "email", 9)]);
    client.releaseHandler = () => pendingRelease.promise;
    const harness = createWorkerHarness(client, {
      createDeadline: controlledDeadlineFactory(scheduler),
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.releaseCalls.length === 1);
    scheduler.fire(1);
    const result = await pendingRun;

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.failedCount, 1);
    assert.equal(result.summary.releaseFailedCount, 1);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(client.releaseSignals[0]?.aborted, true);
    const failureLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_item_failed",
    );
    assert.equal(failureLog?.metadata?.releaseErrorCode, "worker_release_timeout");

    const logCount = harness.logger.entries.length;
    pendingRelease.resolve(releaseSuccess(client.releaseCalls[0]!));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(harness.logger.entries.length, logCount);
  });

  it("distinguishes external shutdown during release from a deadline", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const pendingRelease = deferred<ReleaseFulfillmentLeaseResult>();
    client.claimHandler = () =>
      batchSuccess([claimedItem(ORDER_A, "email", 9)]);
    client.releaseHandler = () => pendingRelease.promise;
    const harness = createWorkerHarness(client, {
      createDeadline: controlledDeadlineFactory(scheduler),
    });
    const controller = new AbortController();

    const pendingRun = harness.worker.runOnce(controller.signal);
    await waitFor(() => client.releaseCalls.length === 1);
    controller.abort();
    const result = await pendingRun;

    assert.equal(result.kind, "shutdown");
    assert.equal(result.stopReason, "external_shutdown");
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(client.releaseSignals[0]?.aborted, true);
    const failureLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_item_failed",
    );
    assert.equal(
      failureLog?.metadata?.releaseErrorCode,
      "worker_release_external_abort",
    );
    assert.equal(
      harness.logger.entries.some(
        (entry) => entry.metadata?.releaseErrorCode === "worker_release_timeout",
      ),
      false,
    );
  });

  it("makes a late claim response inert after a monotonic clock fatal", async () => {
    const client = new RecordingWorkerClient();
    const scheduler = new ControlledDeadlineScheduler();
    const pendingClaim = deferred<ClaimFulfillmentBatchResult>();
    let nowMs = 0;
    client.claimHandler = () => pendingClaim.promise;
    const harness = createWorkerHarness(client, {
      tokens: [TOKEN_A, TOKEN_B],
      now: () => nowMs,
      createDeadline: controlledDeadlineFactory(scheduler),
      sleep: async () => {
        assert.fail("fatal clock failure must prevent claim retry sleep");
      },
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.claimCalls.length === 1);
    nowMs = Number.NaN;
    scheduler.fire(0);
    const result = await pendingRun;

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_monotonic_clock_invalid",
    );
    assert.equal(client.claimSignals[0]?.aborted, true);
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(harness.generatedTokenCount(), 1);
    assert.equal(harness.sleepCalls.length, 0);

    const logCount = harness.logger.entries.length;
    const resultSnapshot = JSON.stringify(result);
    pendingClaim.resolve(batchSuccess([claimedItem(ORDER_A)]));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(JSON.stringify(result), resultSnapshot);
    assert.equal(harness.logger.entries.length, logCount);
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(client.releaseCalls.length, 0);
    assert.deepEqual(
      await harness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "worker_monotonic_clock_invalid",
      },
    );
    assert.equal(harness.generatedTokenCount(), 1);
  });

  it("aborts a concurrent reconcile and ignores its late success after budget fatal", async () => {
    const client = new RecordingWorkerClient();
    const clock = new ManualMonotonicClock(0);
    const reconcileA = deferred<ReconcileOrderFulfillmentResult>();
    const reconcileB = deferred<ReconcileOrderFulfillmentResult>();
    client.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
      ]);
    client.reconcileHandler = (input) => {
      if (input.orderId === ORDER_A) {
        return reconcileA.promise;
      }
      if (input.orderId === ORDER_B) {
        return reconcileB.promise;
      }
      assert.fail("pending item must not start after budget fatal");
    };
    const harness = createWorkerHarness(client, {
      tokens: [TOKEN_A, TOKEN_B],
      config: {
        leaseSeconds: 30,
        rpcTimeoutMs: 25_000,
        concurrency: 2,
      },
      now: clock.now,
    });

    const pendingRun = harness.worker.runOnce(new AbortController().signal);
    await waitFor(() => client.reconcileCalls.length === 2);
    clock.set(25_000);
    const inputA = client.reconcileCalls.find(
      (input) => input.orderId === ORDER_A,
    );
    assert.ok(inputA);
    reconcileA.resolve(reconcileSuccess(inputA));
    const result = await pendingRun;

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "local_lease_budget_exhausted",
    );
    assert.equal(result.summary.reconciledCount, 1);
    assert.equal(result.summary.localLeaseBudgetExhaustedCount, 1);
    assert.deepEqual(
      client.reconcileCalls.map((input) => input.orderId),
      [ORDER_A, ORDER_B],
    );
    const indexB = client.reconcileCalls.findIndex(
      (input) => input.orderId === ORDER_B,
    );
    assert.equal(client.reconcileSignals[indexB]?.aborted, true);
    assert.equal(client.releaseCalls.length, 0);
    assert.equal(client.claimCalls.length, 1);
    assert.equal(harness.generatedTokenCount(), 1);

    const logCount = harness.logger.entries.length;
    const resultSnapshot = JSON.stringify(result);
    const inputB = client.reconcileCalls[indexB];
    assert.ok(inputB);
    reconcileB.resolve(reconcileSuccess(inputB));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(JSON.stringify(result), resultSnapshot);
    assert.equal(harness.logger.entries.length, logCount);
    assert.equal(client.reconcileCalls.length, 2);
    assert.equal(client.releaseCalls.length, 0);
    assert.deepEqual(
      await harness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "local_lease_budget_exhausted",
      },
    );
    assert.equal(harness.generatedTokenCount(), 1);
  });

  it("aborts a release and ignores its late provider response after a peer clock fatal", async () => {
    const client = new RecordingWorkerClient();
    const pendingRelease = deferred<ReleaseFulfillmentLeaseResult>();
    let releaseStarted = false;
    client.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "issuance", 2),
      ]);
    client.releaseHandler = () => {
      releaseStarted = true;
      return pendingRelease.promise;
    };
    const harness = createWorkerHarness(client, {
      tokens: [TOKEN_A, TOKEN_B],
      config: { concurrency: 2 },
      now: () => (releaseStarted ? Number.NaN : 0),
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(result.stopReason, "fatal_stop");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_monotonic_clock_invalid",
    );
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(client.releaseCalls[0]?.orderId, ORDER_A);
    assert.equal(client.releaseSignals[0]?.aborted, true);
    assert.equal(client.reconcileCalls.length, 0);
    assert.equal(harness.generatedTokenCount(), 1);

    const logCount = harness.logger.entries.length;
    const resultSnapshot = JSON.stringify(result);
    pendingRelease.resolve(releaseBusinessError("provider_outcome_required"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(JSON.stringify(result), resultSnapshot);
    assert.equal(harness.logger.entries.length, logCount);
    assert.equal(client.releaseCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 0);
    assert.deepEqual(
      await harness.worker.runLoop(new AbortController().signal),
      {
        kind: "fatal",
        stopReason: "fatal_stop",
        errorCode: "worker_monotonic_clock_invalid",
      },
    );
    assert.equal(
      harness.logger.entries.filter(
        (entry) =>
          entry.event === "access_fulfillment_worker_fatal_latched",
      ).length,
      1,
    );
    assert.equal(harness.generatedTokenCount(), 1);
  });

  it("replaces causal metadata with the exact stale allowlist", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
    client.reconcileHandler = () =>
      reconcileBusinessError("entries_count_mismatch");
    client.releaseHandler = () => releaseBusinessError("stale_lease");
    const harness = createWorkerHarness(client);

    const result = await harness.worker.runOnce(new AbortController().signal);

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.staleCount, 1);
    const staleLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_stale_lease",
    );
    assert.ok(staleLog?.metadata);
    assert.deepEqual(Object.keys(staleLog.metadata).sort(), [
      "durationMs",
      "epoch",
      "errorCode",
      "orderHash",
      "originStage",
      "tokenHash",
      "workType",
    ]);
    assert.equal(staleLog.metadata.errorCode, "stale_lease");
    assert.equal(
      staleLog.metadata.originStage,
      "issuance_failure_release",
    );
    assert.equal(
      JSON.stringify(staleLog.metadata).includes("entries_count_mismatch"),
      false,
    );
  });
});

describe("access fulfillment worker shutdown and logging", () => {
  it("treats abort during a rejecting claim retry wait as graceful shutdown", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () => ({
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.claimBatch,
      message: "Supabase RPC transport failed",
    });
    const controller = new AbortController();
    const harness = createWorkerHarness(client, {
      sleep: async () => {
        controller.abort();
        throw new Error("Synthetic abort rejection");
      },
    });
    const result = await harness.worker.runLoop(controller.signal);

    assert.deepEqual(result, {
      kind: "stopped",
      stopReason: "external_shutdown",
    });
    assert.equal(client.claimCalls.length, 1);
    assert.equal(harness.generatedTokenCount(), 1);
  });

  it("stops new claims and releases every claimed item not yet started", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () =>
      batchSuccess([
        claimedItem(ORDER_A),
        claimedItem(ORDER_B, "issuance", 2),
        claimedItem(ORDER_C, "issuance", 3),
      ]);
    const activeReconcile = deferred<ReconcileOrderFulfillmentResult>();
    client.reconcileHandler = () => activeReconcile.promise;
    const controller = new AbortController();
    const harness = createWorkerHarness(client, { config: { concurrency: 1 } });
    let settled = false;
    const loop = harness.worker.runLoop(controller.signal).then((result) => {
      settled = true;
      return result;
    });

    await waitFor(() => client.reconcileCalls.length === 1);
    controller.abort();
    await Promise.resolve();
    assert.equal(settled, false);
    activeReconcile.resolve(reconcileSuccess(client.reconcileCalls[0]!));
    const result = await loop;

    assert.deepEqual(result, {
      kind: "stopped",
      stopReason: "external_shutdown",
    });
    assert.equal(client.claimCalls.length, 1);
    assert.equal(client.reconcileCalls.length, 1);
    assert.deepEqual(
      client.releaseCalls.map((input) => ({
        orderId: input.orderId,
        retryAfterSeconds: input.retryAfterSeconds,
        errorCode: input.errorCode,
      })),
      [
        {
          orderId: ORDER_A,
          retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
          errorCode: "reconcile_outcome_ambiguous",
        },
        { orderId: ORDER_B, retryAfterSeconds: 0, errorCode: null },
        { orderId: ORDER_C, retryAfterSeconds: 0, errorCode: null },
      ],
    );
    assert.equal(client.reconcileSignals[0]?.aborted, true);
    assert.equal(client.releaseSignals.length, 3);
    assert.equal(
      client.releaseSignals.every(
        (releaseSignal) =>
          releaseSignal !== undefined &&
          releaseSignal !== controller.signal &&
          releaseSignal.aborted === false,
      ),
      true,
    );
    assert.equal(new Set(client.releaseSignals).size, 3);
  });

  it("does not generate a token or claim when shutdown was already requested", async () => {
    const client = new RecordingWorkerClient();
    const harness = createWorkerHarness(client);
    const controller = new AbortController();
    controller.abort();
    const result = await harness.worker.runLoop(controller.signal);

    assert.deepEqual(result, {
      kind: "stopped",
      stopReason: "external_shutdown",
    });
    assert.equal(harness.generatedTokenCount(), 0);
    assert.equal(client.claimCalls.length, 0);
  });

  it("logs only irreversible truncated correlations and sanitized metadata", async () => {
    const literalToken = "literal-token-fragment-that-must-never-be-logged";
    const entryId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const serviceRoleSecret = "synthetic-service-role-secret";
    const supabaseUrl = "https://synthetic-project.supabase.invalid";
    const resendSecret = "synthetic-resend-secret-from-transport";
    const buyerEmail = "buyer-private@example.test";
    const buyerPhone = "+595981000000";
    const buyerDocument = "1234567";
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A, "email")]);
    const harness = createWorkerHarness(client, { tokens: [literalToken] });
    await harness.worker.runOnce(new AbortController().signal);

    const errorClient = new RecordingWorkerClient();
    errorClient.claimHandler = () => batchSuccess([claimedItem(ORDER_A)]);
    errorClient.reconcileHandler = () => {
      throw new Error(
        [
          entryId,
          serviceRoleSecret,
          supabaseUrl,
          resendSecret,
          buyerEmail,
          buyerPhone,
          buyerDocument,
        ].join("|"),
      );
    };
    const errorHarness = createWorkerHarness(errorClient);
    await errorHarness.worker.runOnce(new AbortController().signal);

    const serialized = JSON.stringify([
      ...harness.logger.entries,
      ...errorHarness.logger.entries,
    ]);
    for (const forbidden of [
      literalToken,
      "literal-token",
      "fragment-that",
      TOKEN_A,
      ORDER_A,
      ORDER_A.slice(0, 8),
      PAYMENT_A,
      entryId,
      serviceRoleSecret,
      supabaseUrl,
      resendSecret,
      buyerEmail,
      buyerPhone,
      buyerDocument,
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }

    const claimedLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_batch_claimed",
    );
    const deferredLog = harness.logger.entries.find(
      (entry) => entry.event === "access_fulfillment_item_deferred",
    );
    assert.equal(
      claimedLog?.metadata?.tokenHash,
      accessFulfillmentCorrelationHash(literalToken),
    );
    assert.equal(
      String(claimedLog?.metadata?.tokenHash).length,
      ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH,
    );
    assert.equal(claimedLog?.metadata?.durationMs, 1);
    assert.equal(deferredLog?.metadata?.durationMs, 2);
    assert.equal(deferredLog?.metadata?.orderHash, accessFulfillmentCorrelationHash(ORDER_A));
  });
});

describe("access fulfillment durable email capability and preclaim", () => {
  it("keeps durable OFF byte-behavior equivalent and never reads capability getters", async () => {
    const client = new RecordingWorkerClient();
    client.claimHandler = () => batchSuccess([claimedItem(ORDER_A, "email")]);
    let capabilityReads = 0;
    let clock = 0;
    const dependencies = {
      client,
      config: WORKER_CONFIG,
      generateToken: () => TOKEN_A,
      now: () => {
        clock += 1;
        return clock;
      },
      sleep: async () => undefined,
      logger: new MemoryLogger(),
    };
    Object.defineProperty(dependencies, "emailCapability", {
      enumerable: true,
      get() {
        capabilityReads += 1;
        throw new Error("durable OFF must not inspect capability");
      },
    });

    const result = await createAccessFulfillmentWorker(
      dependencies,
    ).runOnce(new AbortController().signal);

    assert.equal(result.kind, "completed");
    assert.equal(capabilityReads, 0);
    assert.equal(client.releaseCalls.length, 1);
    assert.deepEqual(client.releaseCalls[0], {
      orderId: ORDER_A,
      reconcileLeaseToken: TOKEN_A,
      reconcileLeaseEpoch: 1,
      retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
      errorCode: null,
    });
    assert.equal(result.summary.deferredCount, 1);
    assert.equal(result.summary.emailRetryScheduledCount, 0);
    assert.equal(client.emailClaimCalls.length, 0);
    assert.equal(client.emailOutcomeCalls.length, 0);
  });

  it("rejects every absent, partial, or throwing durable capability before token generation", async () => {
    const invalidCapabilities: Array<unknown> = [
      undefined,
      null,
      {},
      { load: async () => ({ kind: "aborted" }) },
      {
        load: async () => ({ kind: "aborted" }),
        build: async () => canonicalBuiltMessage(),
      },
      {
        load: async () => ({ kind: "aborted" }),
        build: async () => canonicalBuiltMessage(),
        provider: {},
      },
      Object.defineProperty({}, "load", {
        get() {
          throw new Error("synthetic throwing capability getter");
        },
      }),
    ];

    for (const emailCapability of invalidCapabilities) {
      const client = new RecordingWorkerClient();
      const harness = createWorkerHarness(client, {
        config: { durableEmailDeliveryEnabled: true },
        emailCapability:
          emailCapability as AccessFulfillmentEmailCapability | undefined,
      });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal");
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_capability_invalid",
      );
      assert.equal(harness.generatedTokenCount(), 0);
      assert.equal(client.claimCalls.length, 0);
      assert.equal(client.emailClaimCalls.length, 0);
      assert.equal(client.emailOutcomeCalls.length, 0);
    }
  });

  it("captures bound capability functions once despite later external mutation", async () => {
    const capability = new RecordingEmailCapability();
    const harness = createDurableWorkerHarness({ capability });
    (capability as unknown as { load: () => never }).load = () => {
      throw new Error("mutated load must be inert");
    };
    (capability as unknown as { build: () => never }).build = () => {
      throw new Error("mutated build must be inert");
    };
    (
      capability.provider as unknown as {
        send: () => never;
      }
    ).send = () => {
      throw new Error("mutated provider must be inert");
    };

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.emailAcceptedCount, 1);
    assert.equal(capability.loadCalls.length, 1);
    assert.equal(capability.buildCalls.length, 1);
    assert.equal(capability.providerCalls.length, 1);
    assertUniversalEmailInvariants(harness.client, capability);
  });

  it("maps all canonical loader retry and terminal codes without provider authority", async () => {
    const retryCodes = [
      "order_read_failed",
      "order_items_read_failed",
      "entries_read_failed",
      "source_read_failed",
    ] as const;
    for (const errorCode of retryCodes) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "retryable_error",
        errorCode,
      });
      const harness = createDurableWorkerHarness({ capability });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", errorCode);
      assert.equal(result.summary.emailRetryScheduledCount, 1, errorCode);
      assert.equal(result.summary.deferredCount, 0, errorCode);
      assert.equal(harness.client.releaseCalls.length, 1, errorCode);
      assert.equal(harness.client.releaseCalls[0]?.errorCode, errorCode);
      assert.equal(
        harness.client.releaseCalls[0]?.retryAfterSeconds,
        WORKER_CONFIG.leaseSeconds,
      );
      assert.equal(harness.client.emailClaimCalls.length, 0, errorCode);
      assert.equal(capability.providerCalls.length, 0, errorCode);
    }

    const terminalCodes = [
      "order_invalid",
      "order_items_invalid",
      "entries_not_found",
      "entries_invalid",
      "entry_count_mismatch",
      "entry_not_deliverable",
      "source_invalid",
    ] as const;
    for (const errorCode of terminalCodes) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "terminal_error",
        errorCode,
      });
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailTerminalHandler = (input) =>
        emailTerminalSuccess(input);
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", errorCode);
      assert.equal(result.summary.emailManualReviewCount, 1, errorCode);
      assert.equal(harness.client.emailTerminalCalls.length, 1, errorCode);
      assert.equal(
        harness.client.emailTerminalCalls[0]?.errorCode,
        errorCode,
      );
      assert.equal(harness.client.releaseCalls.length, 0, errorCode);
      assert.equal(capability.providerCalls.length, 0, errorCode);
    }
  });

  it("fails closed for loader invariant, throw, malformed, unknown, and order mismatch surfaces", async () => {
    const scenarios: Array<{
      name: string;
      expected: string;
      handler: AccessFulfillmentEmailCapability["load"];
    }> = [
      {
        name: "order not found",
        expected: "order_not_found",
        handler: async () => ({
          kind: "terminal_error",
          errorCode: "order_not_found",
        }),
      },
      {
        name: "order not paid",
        expected: "order_not_paid",
        handler: async () => ({
          kind: "terminal_error",
          errorCode: "order_not_paid",
        }),
      },
      {
        name: "throw",
        expected: "worker_email_loader_contract_invalid",
        handler: async () => {
          throw new Error("synthetic loader throw");
        },
      },
      {
        name: "unknown",
        expected: "worker_email_loader_contract_invalid",
        handler: async () =>
          ({
            kind: "retryable_error",
            errorCode: "unknown_loader_code",
          }) as unknown as AccessEmailMessageDataLoadResult,
      },
      {
        name: "order mismatch",
        expected: "worker_email_loader_contract_invalid",
        handler: async () => ({
          kind: "success",
          orderId: ORDER_B,
          data: canonicalEmailData(),
        }),
      },
      {
        name: "malformed success",
        expected: "worker_email_loader_contract_invalid",
        handler: async () =>
          ({
            kind: "success",
            orderId: ORDER_A,
            data: { ...canonicalEmailData(), extra: true },
          }) as unknown as AccessEmailMessageDataLoadResult,
      },
    ];

    for (const scenario of scenarios) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = scenario.handler;
      const harness = createDurableWorkerHarness({ capability });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "fatal", scenario.name);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        scenario.expected,
        scenario.name,
      );
      assert.equal(capability.providerCalls.length, 0, scenario.name);
      assert.equal(harness.client.emailClaimCalls.length, 0, scenario.name);
    }
  });

  it("maps every canonical builder error and rejects malformed successful builds", async () => {
    const builderErrors = [
      "qr_generation_failed",
      "invalid_recipient",
      "invalid_from",
      "duplicate_entry_id",
      "invalid_entry",
      "invalid_access_date",
      "invalid_template_version",
    ] as const;
    for (const code of builderErrors) {
      const capability = new RecordingEmailCapability();
      capability.buildHandler = async () => {
        throw new AccessEmailMessageError(code);
      };
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailTerminalHandler = (input) =>
        emailTerminalSuccess(input);
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      if (code === "qr_generation_failed") {
        assert.equal(result.kind, "completed", code);
        assert.equal(result.summary.emailRetryScheduledCount, 1, code);
        assert.equal(harness.client.releaseCalls[0]?.errorCode, code);
      } else if (code === "invalid_recipient") {
        assert.equal(result.kind, "completed", code);
        assert.equal(result.summary.emailManualReviewCount, 1, code);
        assert.equal(harness.client.emailTerminalCalls.length, 1, code);
      } else {
        assert.equal(result.kind, "fatal", code);
        assert.equal(result.kind === "fatal" && result.errorCode, code);
      }
      assert.equal(capability.providerCalls.length, 0, code);
      assert.equal(harness.client.emailClaimCalls.length, 0, code);
    }

    const valid = canonicalBuiltMessage();
    const malformed: unknown[] = [
      { ...valid, requestPayloadHash: "b".repeat(64) },
      { ...valid, requestPayloadHash: "B".repeat(64) },
      { ...valid, entryIds: [...valid.entryIds].reverse() },
      { ...valid, entryIds: [valid.entryIds[0], valid.entryIds[0]] },
      { ...valid, extra: true },
      {
        ...valid,
        message: { ...valid.message, to: ["other@example.test"] },
      },
    ];
    for (const value of malformed) {
      const capability = new RecordingEmailCapability();
      capability.buildHandler = async () =>
        value as BuiltAccessEntriesEmailMessage;
      const harness = createDurableWorkerHarness({ capability });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "fatal");
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_builder_contract_invalid",
      );
      assert.equal(capability.providerCalls.length, 0);
      assert.equal(harness.client.emailClaimCalls.length, 0);
    }
  });
});

describe("access fulfillment durable email terminal obligations", () => {
  it("replays the same terminal request after transport and continues after shutdown", async () => {
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async () => ({
      kind: "terminal_error",
      errorCode: "entries_not_found",
    });
    const controller = new AbortController();
    const harness = createDurableWorkerHarness({ capability });
    let calls = 0;
    harness.client.emailTerminalHandler = (input) => {
      calls += 1;
      if (calls === 1) {
        controller.abort();
        return {
          kind: "transport_error",
          rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
          message: "Supabase RPC transport failed",
        };
      }
      return emailTerminalSuccess(input, true);
    };

    const result = await harness.worker.runOnce(controller.signal);

    assert.equal(result.kind, "shutdown");
    assert.equal(result.summary.emailManualReviewCount, 1);
    assert.equal(harness.client.emailTerminalCalls.length, 2);
    assert.equal(
      harness.client.emailTerminalCalls[0],
      harness.client.emailTerminalCalls[1],
    );
    assert.equal(harness.client.releaseCalls.length, 0);
    assert.equal(capability.providerCalls.length, 0);
    assertUniversalEmailInvariants(harness.client, capability);
  });

  it("bounds terminal uncertainty at two exact attempts and marks it unsettled", async () => {
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async () => ({
      kind: "terminal_error",
      errorCode: "source_invalid",
    });
    const harness = createDurableWorkerHarness({ capability });
    harness.client.emailTerminalHandler = () => ({
      kind: "transport_error",
      rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
      message: "Supabase RPC transport failed",
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_email_terminal_preclaim_recovery_exhausted",
    );
    assert.equal(result.summary.emailUnsettledCount, 1);
    assert.equal(harness.client.emailTerminalCalls.length, 2);
    assert.equal(
      harness.client.emailTerminalCalls[0],
      harness.client.emailTerminalCalls[1],
    );
    assert.equal(harness.client.releaseCalls.length, 0);
    assert.equal(capability.providerCalls.length, 0);
  });

  it("handles every conclusive terminal business branch without provider activity", async () => {
    const scenarios = [
      { code: "stale_lease", expected: "completed", stale: 1 },
      { code: "generation_mismatch", expected: "completed", stale: 1 },
      { code: "email_already_sent", expected: "completed", skipped: 1 },
      {
        code: "provider_outcome_required",
        expected: "fatal",
        unsettled: 1,
      },
      {
        code: "delivery_state_conflict",
        expected: "fatal",
        unsettled: 1,
      },
      { code: "invalid_request", expected: "fatal" },
      { code: "invalid_error_code", expected: "fatal" },
      { code: "order_not_found", expected: "fatal" },
      { code: "fulfillment_not_found", expected: "fatal" },
      { code: "internal_error", expected: "fatal" },
    ] as const;

    for (const scenario of scenarios) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "terminal_error",
        errorCode: "entries_invalid",
      });
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailTerminalHandler = () =>
        ({
          kind: "business_error",
          rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
          response:
            scenario.code === "invalid_request" ||
            scenario.code === "invalid_error_code" ||
            scenario.code === "order_not_found" ||
            scenario.code === "internal_error"
              ? {
                  ok: false,
                  error: {
                    code: scenario.code,
                    message: "Sanitized test error",
                  },
                }
              : {
                  ok: false,
                  order_id: ORDER_A,
                  error: {
                    code: scenario.code,
                    message: "Sanitized test error",
                  },
                },
        }) as RecordEmailPreclaimTerminalFailureResult;

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, scenario.expected, scenario.code);
      assert.equal(
        result.summary.staleCount,
        "stale" in scenario ? scenario.stale : 0,
        scenario.code,
      );
      assert.equal(
        result.summary.emailSkippedSentCount,
        "skipped" in scenario ? scenario.skipped : 0,
        scenario.code,
      );
      assert.equal(
        result.summary.emailUnsettledCount,
        "unsettled" in scenario ? scenario.unsettled : 0,
        scenario.code,
      );
      assert.equal(capability.providerCalls.length, 0, scenario.code);
      if (scenario.code === "email_already_sent") {
        assert.equal(harness.client.releaseCalls.length, 1);
        assert.equal(harness.client.releaseCalls[0]?.retryAfterSeconds, 0);
        assert.equal(harness.client.releaseCalls[0]?.errorCode, null);
      }
    }
  });
});

function emailClaimBusinessError(
  code: string,
  overrides: Record<string, unknown> = {},
): ClaimEmailDeliveryResult {
  return {
    kind: "business_error",
    rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
    response: {
      ok: false,
      error: { code, message: "Sanitized test error" },
      ...overrides,
    },
  } as ClaimEmailDeliveryResult;
}

function emailOutcomeBusinessError(
  code: string,
  overrides: Record<string, unknown> = {},
): RecordEmailDeliveryOutcomeResult {
  return {
    kind: "business_error",
    rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
    response: {
      ok: false,
      error: { code, message: "Sanitized test error" },
      ...overrides,
    },
  } as RecordEmailDeliveryOutcomeResult;
}

describe("access fulfillment durable email claim and correlation", () => {
  it("claims with the exact frozen request and settles fresh and replay processing", async () => {
    for (const idempotent of [false, true]) {
      const harness = createDurableWorkerHarness();
      harness.client.emailClaimHandler = (input) =>
        correlatedEmailClaimSuccess(input, { idempotent });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed");
      assert.equal(result.summary.emailAcceptedCount, 1);
      assert.equal(harness.client.emailClaimCalls.length, 1);
      const built = canonicalBuiltMessage();
      assert.deepEqual(harness.client.emailClaimCalls[0], {
        orderId: ORDER_A,
        reconcileLeaseToken: TOKEN_A,
        reconcileLeaseEpoch: 1,
        entryIds: [...built.entryIds],
        requestPayloadHash: built.requestPayloadHash,
        templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
        provider: "resend",
      });
      assert.equal(Object.isFrozen(harness.client.emailClaimCalls[0]), true);
      assert.equal(
        Object.isFrozen(harness.client.emailClaimCalls[0]?.entryIds),
        true,
      );
      assert.equal(harness.capability.providerCalls.length, 1);
      assert.equal(harness.client.releaseCalls.length, 0);
      assertUniversalEmailInvariants(harness.client, harness.capability);
    }
  });

  it("replays one identical claim after transport or concurrency and never sends twice", async () => {
    for (const first of ["transport", "concurrency"] as const) {
      const harness = createDurableWorkerHarness();
      let calls = 0;
      harness.client.emailClaimHandler = (input) => {
        calls += 1;
        if (calls === 1) {
          return first === "transport"
            ? transportEmailClaim()
            : emailClaimBusinessError("concurrency_conflict", {
                retryable: true,
              });
        }
        return correlatedEmailClaimSuccess(input, { idempotent: true });
      };

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", first);
      assert.equal(result.summary.emailAcceptedCount, 1, first);
      assert.equal(harness.client.emailClaimCalls.length, 2, first);
      assert.equal(
        harness.client.emailClaimCalls[0],
        harness.client.emailClaimCalls[1],
        first,
      );
      assert.equal(harness.capability.providerCalls.length, 1, first);
      assertUniversalEmailInvariants(harness.client, harness.capability);
    }
  });

  it("bounds uncertain claims at two exact requests", async () => {
    const harness = createDurableWorkerHarness();
    harness.client.emailClaimHandler = () => transportEmailClaim();

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_email_claim_recovery_exhausted",
    );
    assert.equal(result.summary.emailUnsettledCount, 1);
    assert.equal(harness.client.emailClaimCalls.length, 2);
    assert.equal(
      harness.client.emailClaimCalls[0],
      harness.client.emailClaimCalls[1],
    );
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 0);
  });

  it("handles skipped sent and every claim business branch without widening authority", async () => {
    const scenarios = [
      {
        code: "stale_lease",
        expectedKind: "completed",
        stale: 1,
        manual: 0,
        unsettled: 0,
        release: false,
      },
      {
        code: "ambiguous_idempotency_window_expired",
        expectedKind: "completed",
        stale: 0,
        manual: 1,
        unsettled: 0,
        release: false,
      },
      {
        code: "delivery_payload_drift",
        expectedKind: "completed",
        stale: 0,
        manual: 1,
        unsettled: 0,
        release: false,
      },
      {
        code: "delivery_state_conflict",
        expectedKind: "completed",
        stale: 0,
        manual: 1,
        unsettled: 0,
        release: false,
      },
      {
        code: "email_manual_review",
        expectedKind: "completed",
        stale: 0,
        manual: 1,
        unsettled: 0,
        release: true,
      },
      ...[
        "invalid_request",
        "invalid_provider",
        "order_not_found",
        "fulfillment_not_found",
      ].map((code) => ({
        code,
        expectedKind: "fatal",
        stale: 0,
        manual: 0,
        unsettled: 0,
        release: false,
      })),
      ...[
        "issuance_manual_review",
        "issuance_not_complete",
        "multiple_approved_payment_attempts",
        "fulfillment_attempt_mismatch",
        "unsupported_approved_provider",
        "order_not_paid",
        "internal_error",
      ].map((code) => ({
        code,
        expectedKind: "fatal",
        stale: 0,
        manual: 0,
        unsettled: 1,
        release: false,
      })),
    ];

    for (const scenario of scenarios) {
      const harness = createDurableWorkerHarness();
      harness.client.emailClaimHandler = () =>
        emailClaimBusinessError(scenario.code, {
          order_id: ORDER_A,
          ...(scenario.code === "delivery_payload_drift"
            ? { delivery_attempt_id: EMAIL_ATTEMPT_A }
            : {}),
        });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, scenario.expectedKind, scenario.code);
      assert.equal(result.summary.staleCount, scenario.stale, scenario.code);
      assert.equal(
        result.summary.emailManualReviewCount,
        scenario.manual,
        scenario.code,
      );
      assert.equal(
        result.summary.emailUnsettledCount,
        scenario.unsettled,
        scenario.code,
      );
      assert.equal(
        harness.client.releaseCalls.length,
        scenario.release ? 1 : 0,
        scenario.code,
      );
      if (scenario.release) {
        assert.equal(harness.client.releaseCalls[0]?.retryAfterSeconds, 0);
        assert.equal(harness.client.releaseCalls[0]?.errorCode, null);
      }
      assert.equal(harness.capability.providerCalls.length, 0, scenario.code);
      assert.equal(harness.client.emailOutcomeCalls.length, 0, scenario.code);
    }

    const skipped = createDurableWorkerHarness();
    skipped.client.emailClaimHandler = (input) => ({
      kind: "success",
      rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
      response: {
        ok: true,
        status: "skipped_sent",
        order_id: input.orderId,
        generation: 1,
        epoch: input.reconcileLeaseEpoch,
        idempotent: true,
      },
    });
    const skippedResult = await skipped.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(skippedResult.kind, "completed");
    assert.equal(skippedResult.summary.emailSkippedSentCount, 1);
    assert.equal(skipped.client.releaseCalls.length, 1);
    assert.equal(skipped.client.releaseCalls[0]?.retryAfterSeconds, 0);
    assert.equal(skipped.client.releaseCalls[0]?.errorCode, null);
    assert.equal(skipped.capability.providerCalls.length, 0);
  });

  it("rejects every individual correlated-field mismatch before provider or release", async () => {
    const built = canonicalBuiltMessage();
    const mismatches: Array<{
      name: string;
      overrides: Record<string, unknown>;
    }> = [
      { name: "order", overrides: { order_id: ORDER_B } },
      { name: "generation", overrides: { generation: 2 } },
      { name: "epoch", overrides: { epoch: 2 } },
      { name: "provider", overrides: { provider: "other" } },
      {
        name: "attempt",
        overrides: { delivery_attempt_id: "not-a-canonical-uuid" },
      },
      { name: "key", overrides: { idempotency_key: "wrong-key" } },
      {
        name: "entry IDs",
        overrides: { entry_ids: [EMAIL_ENTRY_A, ORDER_C] },
      },
      {
        name: "entry order",
        overrides: { entry_ids: [...built.entryIds].reverse() },
      },
      { name: "entry count", overrides: { entry_count: 3 } },
      {
        name: "snapshot",
        overrides: { entry_snapshot_hash: "B".repeat(64) },
      },
      {
        name: "request hash",
        overrides: { request_payload_hash: "b".repeat(64) },
      },
      {
        name: "template",
        overrides: { template_version: "access-entries-v0" },
      },
      { name: "remaining", overrides: { idempotency_remaining_ms: -1 } },
    ];

    for (const mismatch of mismatches) {
      const harness = createDurableWorkerHarness();
      harness.client.emailClaimHandler = (input) =>
        correlatedEmailClaimSuccess(
          input,
          mismatch.overrides as Partial<CorrelatedProcessingResponse>,
        );

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", mismatch.name);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_claim_correlation_mismatch",
        mismatch.name,
      );
      assert.equal(result.summary.emailUnsettledCount, 1, mismatch.name);
      assert.equal(harness.capability.providerCalls.length, 0, mismatch.name);
      assert.equal(harness.client.releaseCalls.length, 0, mismatch.name);
      assert.equal(harness.client.emailOutcomeCalls.length, 0, mismatch.name);
      assert.equal(harness.client.emailClaimCalls.length, 1, mismatch.name);
    }
  });

  it("rejects partial 049, extra, malformed, and unknown processing immediately", async () => {
    const scenarios: Array<{
      name: string;
      result: (input: ClaimEmailDeliveryInput) => ClaimEmailDeliveryResult;
    }> = [
      {
        name: "partial 049",
        result: (input) => {
          const correlated = (
            correlatedEmailClaimSuccess(input) as Extract<
              ClaimEmailDeliveryResult,
              { kind: "success" }
            >
          ).response as unknown as Record<string, unknown>;
          const {
            idempotency_remaining_ms: removedIdempotencyRemainingMs,
            ...partial
          } = correlated;
          assert.equal(removedIdempotencyRemainingMs, 120_000);
          return {
            kind: "success",
            rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
            response: partial,
          } as unknown as ClaimEmailDeliveryResult;
        },
      },
      {
        name: "extra field",
        result: (input) => {
          const correlated = (
            correlatedEmailClaimSuccess(input) as Extract<
              ClaimEmailDeliveryResult,
              { kind: "success" }
            >
          ).response;
          return {
            kind: "success",
            rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
            response: { ...correlated, extra: true },
          } as unknown as ClaimEmailDeliveryResult;
        },
      },
      {
        name: "malformed",
        result: () =>
          ({
            kind: "malformed_response",
            rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
            field: "response",
            reason: "Synthetic malformed response",
          }) as ClaimEmailDeliveryResult,
      },
      {
        name: "unknown",
        result: () =>
          ({
            kind: "unknown_status",
            rpc: ACCESS_FULFILLMENT_RPC.claimEmail,
            field: "status",
            status: "synthetic_unknown",
          }) as ClaimEmailDeliveryResult,
      },
    ];

    for (const scenario of scenarios) {
      const harness = createDurableWorkerHarness();
      harness.client.emailClaimHandler = scenario.result;
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", scenario.name);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_claim_correlation_mismatch",
        scenario.name,
      );
      assert.equal(result.summary.emailUnsettledCount, 1, scenario.name);
      assert.equal(harness.capability.providerCalls.length, 0, scenario.name);
      assert.equal(harness.client.releaseCalls.length, 0, scenario.name);
      assert.equal(harness.client.emailOutcomeCalls.length, 0, scenario.name);
      assert.equal(harness.client.emailClaimCalls.length, 1, scenario.name);
    }
  });
});

describe("access fulfillment legacy email processing", () => {
  it("settles the exact ambiguous tuple, never calls provider, then latches the required fatal", async () => {
    for (const idempotent of [false, true]) {
      const harness = createDurableWorkerHarness();
      harness.client.emailClaimHandler = (input) =>
        legacyEmailClaimSuccess(input, { idempotent });
      harness.client.emailOutcomeHandler = (input) =>
        emailOutcomeSuccess(input);

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal");
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_claim_correlation_required",
      );
      assert.deepEqual(harness.client.emailOutcomeCalls[0], {
        orderId: ORDER_A,
        deliveryAttemptId: EMAIL_ATTEMPT_A,
        reconcileLeaseToken: TOKEN_A,
        reconcileLeaseEpoch: 1,
        outcome: "ambiguous",
        providerMessageId: null,
        errorCode: "worker_email_claim_correlation_required",
        retryAfterSeconds: 60,
      });
      assert.equal(Object.isFrozen(harness.client.emailOutcomeCalls[0]), true);
      assert.equal(result.summary.emailAmbiguousCount, 1);
      assert.equal(harness.capability.providerCalls.length, 0);
      assert.equal(harness.client.releaseCalls.length, 0);
      assert.equal(harness.client.emailClaimCalls.length, 1);
    }
  });

  it("derives replay manual-review uncertainty from the frozen legacy tuple", async () => {
    const harness = createDurableWorkerHarness();
    harness.client.emailClaimHandler = (input) =>
      legacyEmailClaimSuccess(input);
    harness.client.emailOutcomeHandler = (input) =>
      emailOutcomeSuccess(input, { idempotent: true });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(result.summary.emailAmbiguousCount, 1);
    assert.equal(result.summary.emailManualReviewUnknownCount, 1);
    assert.equal(result.summary.emailManualReviewCount, 0);
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });

  it("replays the same legacy settlement after transport even when shutdown is latched", async () => {
    const controller = new AbortController();
    const harness = createDurableWorkerHarness();
    harness.client.emailClaimHandler = (input) => {
      controller.abort("synthetic shutdown reason");
      return legacyEmailClaimSuccess(input);
    };
    let calls = 0;
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      calls += 1;
      return calls === 1
        ? transportEmailOutcome()
        : emailOutcomeSuccess(input, { idempotent: true });
    };

    const result = await harness.worker.runOnce(controller.signal);

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_email_claim_correlation_required",
    );
    assert.equal(harness.client.emailOutcomeCalls.length, 2);
    assert.equal(
      harness.client.emailOutcomeCalls[0],
      harness.client.emailOutcomeCalls[1],
    );
    assert.equal(result.summary.emailAmbiguousCount, 1);
    assert.equal(result.summary.emailManualReviewUnknownCount, 1);
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });

  it("marks legacy settlement exhaustion unsettled and preserves first-winning fatal", async () => {
    const harness = createDurableWorkerHarness();
    harness.client.emailClaimHandler = (input) =>
      legacyEmailClaimSuccess(input);
    harness.client.emailOutcomeHandler = () => transportEmailOutcome();

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_email_outcome_settlement_exhausted",
    );
    assert.equal(result.summary.emailUnsettledCount, 1);
    assert.equal(result.summary.emailAmbiguousCount, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 2);
    assert.equal(
      harness.client.emailOutcomeCalls[0],
      harness.client.emailOutcomeCalls[1],
    );
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });
});

describe("access fulfillment durable email provider mapping and timing", () => {
  it("maps every valid provider outcome into the exact frozen settlement tuple", async () => {
    const scenarios: Array<{
      name: string;
      provider: AccessEmailProviderOutcome;
      expected: Pick<
        RecordEmailDeliveryOutcomeInput,
        "outcome" | "providerMessageId" | "errorCode" | "retryAfterSeconds"
      >;
      accepted: number;
      retry: number;
      ambiguous: number;
      retryable?: boolean;
    }> = [
      {
        name: "accepted",
        provider: {
          kind: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
        },
        expected: {
          outcome: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
          errorCode: null,
          retryAfterSeconds: null,
        },
        accepted: 1,
        retry: 0,
        ambiguous: 0,
      },
      {
        name: "retryable explicit",
        provider: {
          kind: "failed_retryable",
          errorCode: "provider_rate_limited",
          retryAfterSeconds: 45,
        },
        expected: {
          outcome: "failed",
          providerMessageId: null,
          errorCode: "provider_rate_limited",
          retryAfterSeconds: 45,
        },
        accepted: 0,
        retry: 1,
        ambiguous: 0,
      },
      {
        name: "retryable fallback",
        provider: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
        },
        expected: {
          outcome: "failed",
          providerMessageId: null,
          errorCode: "provider_transient",
          retryAfterSeconds: 60,
        },
        accepted: 0,
        retry: 1,
        ambiguous: 0,
      },
      {
        name: "terminal",
        provider: {
          kind: "failed_terminal",
          errorCode: "provider_rejected",
        },
        expected: {
          outcome: "failed",
          providerMessageId: null,
          errorCode: "provider_rejected",
          retryAfterSeconds: null,
        },
        accepted: 0,
        retry: 0,
        ambiguous: 0,
        retryable: false,
      },
      {
        name: "ambiguous explicit",
        provider: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
          retryAfterSeconds: 25,
        },
        expected: {
          outcome: "ambiguous",
          providerMessageId: null,
          errorCode: "provider_uncertain",
          retryAfterSeconds: 25,
        },
        accepted: 0,
        retry: 0,
        ambiguous: 1,
      },
      {
        name: "ambiguous without retry",
        provider: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
        },
        expected: {
          outcome: "ambiguous",
          providerMessageId: null,
          errorCode: "provider_uncertain",
          retryAfterSeconds: null,
        },
        accepted: 0,
        retry: 0,
        ambiguous: 1,
      },
    ];

    for (const scenario of scenarios) {
      const capability = new RecordingEmailCapability();
      capability.providerHandler = async () => scenario.provider;
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailOutcomeHandler = (input) =>
        emailOutcomeSuccess(input, {
          retryable: scenario.retryable,
        });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", scenario.name);
      assert.equal(capability.providerCalls.length, 1, scenario.name);
      assert.equal(harness.client.emailOutcomeCalls.length, 1, scenario.name);
      const request = harness.client.emailOutcomeCalls[0];
      assert.deepEqual(
        {
          outcome: request?.outcome,
          providerMessageId: request?.providerMessageId,
          errorCode: request?.errorCode,
          retryAfterSeconds: request?.retryAfterSeconds,
        },
        scenario.expected,
        scenario.name,
      );
      assert.equal(Object.isFrozen(request), true, scenario.name);
      assert.equal(
        result.summary.emailAcceptedCount,
        scenario.accepted,
        scenario.name,
      );
      assert.equal(
        result.summary.emailRetryScheduledCount,
        scenario.retry,
        scenario.name,
      );
      assert.equal(
        result.summary.emailAmbiguousCount,
        scenario.ambiguous,
        scenario.name,
      );
      assertUniversalEmailInvariants(harness.client, capability);
    }
  });

  it("maps every malformed or thrown post-send result to one exact ambiguous tuple", async () => {
    const malformed: Array<{ name: string; value: unknown }> = [
      {
        name: "empty accepted id",
        value: { kind: "accepted", providerMessageId: "" },
      },
      {
        name: "invalid error code",
        value: { kind: "failed_terminal", errorCode: "INVALID CODE" },
      },
      {
        name: "negative retry",
        value: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
          retryAfterSeconds: -1,
        },
      },
      {
        name: "oversized retry",
        value: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
          retryAfterSeconds: 604_801,
        },
      },
      {
        name: "fraction retry",
        value: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
          retryAfterSeconds: 1.5,
        },
      },
      {
        name: "undefined retry",
        value: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
          retryAfterSeconds: undefined,
        },
      },
      { name: "unknown kind", value: { kind: "synthetic_unknown" } },
      { name: "malformed", value: {} },
      {
        name: "partial plausible retry",
        value: { kind: "ambiguous", retryAfterSeconds: 30 },
      },
      {
        name: "extra field",
        value: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
          retryAfterSeconds: 30,
          extra: true,
        },
      },
    ];

    for (const scenario of malformed) {
      const capability = new RecordingEmailCapability();
      capability.providerHandler = async () =>
        scenario.value as AccessEmailProviderOutcome;
      const harness = createDurableWorkerHarness({ capability });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", scenario.name);
      assert.equal(capability.providerCalls.length, 1, scenario.name);
      assert.deepEqual(
        {
          outcome: harness.client.emailOutcomeCalls[0]?.outcome,
          providerMessageId:
            harness.client.emailOutcomeCalls[0]?.providerMessageId,
          errorCode: harness.client.emailOutcomeCalls[0]?.errorCode,
          retryAfterSeconds:
            harness.client.emailOutcomeCalls[0]?.retryAfterSeconds,
        },
        {
          outcome: "ambiguous",
          providerMessageId: null,
          errorCode: "worker_email_provider_contract_ambiguous",
          retryAfterSeconds: null,
        },
        scenario.name,
      );
      assert.equal(result.summary.emailAmbiguousCount, 1, scenario.name);
      assertUniversalEmailInvariants(harness.client, capability);
    }

    for (const mode of ["throw", "reject"] as const) {
      const capability = new RecordingEmailCapability();
      capability.providerHandler =
        mode === "throw"
          ? (() => {
              throw new Error("synthetic provider throw");
            })
          : async () => Promise.reject(new Error("synthetic provider reject"));
      const harness = createDurableWorkerHarness({ capability });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "completed", mode);
      assert.equal(capability.providerCalls.length, 1, mode);
      assert.equal(
        harness.client.emailOutcomeCalls[0]?.outcome,
        "ambiguous",
        mode,
      );
      assert.equal(
        harness.client.emailOutcomeCalls[0]?.errorCode,
        "worker_email_provider_contract_ambiguous",
        mode,
      );
      assert.equal(
        harness.client.emailOutcomeCalls[0]?.retryAfterSeconds,
        null,
        mode,
      );
      assert.equal(result.summary.emailAmbiguousCount, 1, mode);
    }
  });

  it("uses the conclusive retry attempt start and enforces equality and minus-one remaining boundaries", async () => {
    for (const remaining of [6_100, 6_099]) {
      const clock = new ManualMonotonicClock(0);
      const harness = createDurableWorkerHarness({ now: clock.now });
      harness.client.emailClaimHandler = (input) => {
        clock.set(100);
        return correlatedEmailClaimSuccess(input, {
          idempotency_remaining_ms: remaining,
        });
      };

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", String(remaining));
      assert.equal(
        harness.capability.providerCalls.length,
        remaining === 6_100 ? 1 : 0,
        String(remaining),
      );
      assert.equal(
        harness.client.emailOutcomeCalls[0]?.errorCode,
        remaining === 6_100
          ? null
          : "worker_email_idempotency_window_insufficient",
      );
    }

    const clock = new ManualMonotonicClock(0);
    const retry = createDurableWorkerHarness({ now: clock.now });
    let attempts = 0;
    retry.client.emailClaimHandler = (input) => {
      attempts += 1;
      if (attempts === 1) {
        clock.set(1_000);
        return transportEmailClaim();
      }
      return correlatedEmailClaimSuccess(input, {
        idempotency_remaining_ms: 6_000,
      });
    };
    const retryResult = await retry.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(retryResult.kind, "completed");
    assert.equal(retry.client.emailClaimCalls.length, 2);
    assert.equal(retry.capability.providerCalls.length, 1);
  });

  it("does not start provider when local capacity or SQL remaining is insufficient", async () => {
    const localClock = new ManualMonotonicClock(0);
    const local = createDurableWorkerHarness({
      now: localClock.now,
      config: { leaseSeconds: 17 },
    });
    local.client.emailClaimHandler = (input) => {
      localClock.set(1);
      return correlatedEmailClaimSuccess(input, {
        idempotency_remaining_ms: 120_000,
      });
    };
    const localResult = await local.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(localResult.kind, "completed");
    assert.equal(local.capability.providerCalls.length, 0);
    assert.equal(
      local.client.emailOutcomeCalls[0]?.errorCode,
      "worker_email_idempotency_window_insufficient",
    );

    const sql = createDurableWorkerHarness();
    sql.client.emailClaimHandler = (input) =>
      correlatedEmailClaimSuccess(input, {
        idempotency_remaining_ms: 0,
      });
    const sqlResult = await sql.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(sqlResult.kind, "completed");
    assert.equal(sql.capability.providerCalls.length, 0);
    assert.equal(
      sql.client.emailOutcomeCalls[0]?.errorCode,
      "worker_email_idempotency_window_insufficient",
    );
  });

  it("fails safely before send when setup fails or shutdown wins the final guard", async () => {
    const setup = createDurableWorkerHarness({
      createDeadline: (timeoutMs, externalSignal) => {
        if (timeoutMs === 5_000) {
          throw new Error("synthetic provider deadline setup failure");
        }
        return createAbortDeadline(timeoutMs, externalSignal);
      },
    });
    const setupResult = await setup.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(setupResult.kind, "completed");
    assert.equal(setup.capability.providerCalls.length, 0);
    assert.equal(
      setup.client.emailOutcomeCalls[0]?.errorCode,
      "provider_call_not_started_aborted",
    );
    assert.equal(
      setup.client.emailOutcomeCalls[0]?.retryAfterSeconds,
      60,
    );

    const controller = new AbortController();
    const shutdown = createDurableWorkerHarness();
    shutdown.client.emailClaimHandler = (input) => {
      controller.abort("synthetic pre-provider shutdown");
      return correlatedEmailClaimSuccess(input);
    };
    shutdown.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };
    const shutdownResult = await shutdown.worker.runOnce(controller.signal);
    assert.equal(shutdownResult.kind, "shutdown");
    assert.equal(shutdown.capability.providerCalls.length, 0);
    assert.equal(
      shutdown.client.emailOutcomeCalls[0]?.errorCode,
      "provider_call_not_started_aborted",
    );
    assert.equal(shutdownResult.summary.emailRetryScheduledCount, 1);
  });

  it("observes provider timeout after send and settles on an independent signal", async () => {
    const scheduler = new ControlledDeadlineScheduler();
    const capability = new RecordingEmailCapability();
    const providerStarted = deferred<void>();
    const providerNever = deferred<AccessEmailProviderOutcome>();
    capability.providerHandler = async (_input, options) => {
      assert.equal(options?.signal?.aborted, false);
      providerStarted.resolve();
      return providerNever.promise;
    };
    const harness = createDurableWorkerHarness({
      capability,
      createDeadline: controlledDeadlineFactory(scheduler),
    });
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };

    const run = harness.worker.runOnce(new AbortController().signal);
    await providerStarted.promise;
    const providerDeadlineIndex = scheduler.entries.findIndex(
      (entry) => entry.timeoutMs === 5_000 && !entry.cancelled,
    );
    assert.notEqual(providerDeadlineIndex, -1);
    scheduler.fire(providerDeadlineIndex);
    const result = await run;

    assert.equal(result.kind, "completed");
    assert.equal(capability.providerCalls.length, 1);
    assert.equal(capability.providerCalls[0]?.signal?.aborted, true);
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.outcome,
      "ambiguous",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.errorCode,
      "worker_email_provider_contract_ambiguous",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.retryAfterSeconds,
      null,
    );
    assert.equal(result.summary.emailAmbiguousCount, 1);
  });

  it("observes external shutdown after send and still settles independently", async () => {
    const controller = new AbortController();
    const capability = new RecordingEmailCapability();
    const providerStarted = deferred<void>();
    const providerNever = deferred<AccessEmailProviderOutcome>();
    capability.providerHandler = async () => {
      providerStarted.resolve();
      return providerNever.promise;
    };
    const harness = createDurableWorkerHarness({ capability });
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };

    const run = harness.worker.runOnce(controller.signal);
    await providerStarted.promise;
    controller.abort("synthetic shutdown after provider start");
    const result = await run;

    assert.equal(result.kind, "shutdown");
    assert.equal(capability.providerCalls.length, 1);
    assert.equal(capability.providerCalls[0]?.signal?.aborted, true);
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.outcome,
      "ambiguous",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.errorCode,
      "worker_email_provider_contract_ambiguous",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.retryAfterSeconds,
      null,
    );
    assert.equal(result.summary.emailAmbiguousCount, 1);
  });

  it("aborts an in-flight provider on peer fatal, preserves settlement, and stores both outcomes", async () => {
    const capability = new RecordingEmailCapability();
    const providerStarted = deferred<void>();
    const providerNever = deferred<AccessEmailProviderOutcome>();
    capability.loadHandler = async (orderId) => {
      if (orderId === ORDER_B) {
        await providerStarted.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      return {
        kind: "success",
        orderId,
        data: canonicalEmailData(),
      };
    };
    capability.providerHandler = async () => {
      providerStarted.resolve();
      return providerNever.promise;
    };
    const harness = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
    });
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "order_not_found",
    );
    assert.equal(capability.providerCalls.length, 1);
    assert.equal(capability.providerCalls[0]?.signal?.aborted, true);
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.outcome,
      "ambiguous",
    );
    assert.equal(result.summary.emailAmbiguousCount, 1);
    assert.equal(result.summary.failedCount, 1);
    assert.equal(harness.client.releaseCalls.length, 0);
  });
});

describe("access fulfillment durable email outcome settlement", () => {
  it("accounts for every fresh and replay settlement shape orthogonally", async () => {
    const scenarios: Array<{
      name: string;
      provider: AccessEmailProviderOutcome;
      settlement: {
        idempotent?: boolean;
        manualReview?: boolean;
        retryable?: boolean;
      };
      accepted: number;
      retry: number;
      ambiguous: number;
      manual: number;
      unknown: number;
    }> = [
      {
        name: "accepted fresh",
        provider: {
          kind: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
        },
        settlement: {},
        accepted: 1,
        retry: 0,
        ambiguous: 0,
        manual: 0,
        unknown: 0,
      },
      {
        name: "accepted replay",
        provider: {
          kind: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
        },
        settlement: { idempotent: true },
        accepted: 1,
        retry: 0,
        ambiguous: 0,
        manual: 0,
        unknown: 0,
      },
      {
        name: "accepted manual",
        provider: {
          kind: "accepted",
          providerMessageId: EMAIL_PROVIDER_MESSAGE_A,
        },
        settlement: { manualReview: true },
        accepted: 1,
        retry: 0,
        ambiguous: 0,
        manual: 1,
        unknown: 0,
      },
      {
        name: "failed fresh retryable",
        provider: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
          retryAfterSeconds: 30,
        },
        settlement: { retryable: true },
        accepted: 0,
        retry: 1,
        ambiguous: 0,
        manual: 0,
        unknown: 0,
      },
      {
        name: "failed fresh manual",
        provider: {
          kind: "failed_terminal",
          errorCode: "provider_rejected",
        },
        settlement: { manualReview: true },
        accepted: 0,
        retry: 0,
        ambiguous: 0,
        manual: 1,
        unknown: 0,
      },
      {
        name: "failed replay",
        provider: {
          kind: "failed_retryable",
          errorCode: "provider_transient",
          retryAfterSeconds: 30,
        },
        settlement: { idempotent: true },
        accepted: 0,
        retry: 1,
        ambiguous: 0,
        manual: 0,
        unknown: 1,
      },
      {
        name: "ambiguous fresh",
        provider: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
        },
        settlement: {},
        accepted: 0,
        retry: 0,
        ambiguous: 1,
        manual: 0,
        unknown: 0,
      },
      {
        name: "ambiguous fresh manual",
        provider: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
        },
        settlement: { manualReview: true },
        accepted: 0,
        retry: 0,
        ambiguous: 1,
        manual: 1,
        unknown: 0,
      },
      {
        name: "ambiguous replay",
        provider: {
          kind: "ambiguous",
          errorCode: "provider_uncertain",
        },
        settlement: { idempotent: true },
        accepted: 0,
        retry: 0,
        ambiguous: 1,
        manual: 0,
        unknown: 1,
      },
    ];

    for (const scenario of scenarios) {
      const capability = new RecordingEmailCapability();
      capability.providerHandler = async () => scenario.provider;
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailOutcomeHandler = (input) =>
        emailOutcomeSuccess(input, scenario.settlement);

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", scenario.name);
      assert.equal(
        result.summary.emailAcceptedCount,
        scenario.accepted,
        scenario.name,
      );
      assert.equal(
        result.summary.emailRetryScheduledCount,
        scenario.retry,
        scenario.name,
      );
      assert.equal(
        result.summary.emailAmbiguousCount,
        scenario.ambiguous,
        scenario.name,
      );
      assert.equal(
        result.summary.emailManualReviewCount,
        scenario.manual,
        scenario.name,
      );
      assert.equal(
        result.summary.emailManualReviewUnknownCount,
        scenario.unknown,
        scenario.name,
      );
      assert.equal(result.summary.emailUnsettledCount, 0, scenario.name);
      assert.equal(capability.providerCalls.length, 1, scenario.name);
      assert.equal(harness.client.releaseCalls.length, 0, scenario.name);
    }
  });

  it("replays the exact frozen outcome after concurrency or transport", async () => {
    for (const first of ["concurrency", "transport"] as const) {
      const harness = createDurableWorkerHarness();
      let calls = 0;
      harness.client.emailOutcomeHandler = (input) => {
        calls += 1;
        if (calls === 1) {
          return first === "concurrency"
            ? emailOutcomeBusinessError("concurrency_conflict", {
                retryable: true,
              })
            : transportEmailOutcome();
        }
        return emailOutcomeSuccess(input, { idempotent: true });
      };

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", first);
      assert.equal(result.summary.emailAcceptedCount, 1, first);
      assert.equal(harness.client.emailOutcomeCalls.length, 2, first);
      assert.equal(
        harness.client.emailOutcomeCalls[0],
        harness.client.emailOutcomeCalls[1],
        first,
      );
      assert.equal(Object.isFrozen(harness.client.emailOutcomeCalls[0]), true);
      assert.equal(harness.capability.providerCalls.length, 1, first);
      assertUniversalEmailInvariants(harness.client, harness.capability);
    }
  });

  it("continues exact settlement recovery after external shutdown", async () => {
    const controller = new AbortController();
    const harness = createDurableWorkerHarness();
    let calls = 0;
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      calls += 1;
      if (calls === 1) {
        controller.abort("synthetic shutdown during settlement");
        return transportEmailOutcome();
      }
      return emailOutcomeSuccess(input, { idempotent: true });
    };

    const result = await harness.worker.runOnce(controller.signal);

    assert.equal(result.kind, "shutdown");
    assert.equal(result.summary.emailAcceptedCount, 1);
    assert.equal(harness.client.emailOutcomeCalls.length, 2);
    assert.equal(
      harness.client.emailOutcomeCalls[0],
      harness.client.emailOutcomeCalls[1],
    );
    assert.equal(
      harness.client.emailOutcomeSignals.every(
        (signal) => signal?.aborted === false,
      ),
      true,
    );
  });

  it("classifies every conclusive settlement conflict without release or a second provider call", async () => {
    const codes = [
      "stale_lease",
      "outcome_conflict",
      "provider_message_conflict",
      "delivery_attempt_mismatch",
      "delivery_attempt_not_found",
      "order_not_found",
      "fulfillment_not_found",
      "invalid_request",
      "internal_error",
      "synthetic_unknown_code",
    ] as const;

    for (const code of codes) {
      const harness = createDurableWorkerHarness();
      harness.client.emailOutcomeHandler = () =>
        emailOutcomeBusinessError(code, {
          order_id: ORDER_A,
          delivery_attempt_id: EMAIL_ATTEMPT_A,
        });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", code);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        code === "synthetic_unknown_code"
          ? "worker_email_outcome_settlement_exhausted"
          : code,
        code,
      );
      assert.equal(result.summary.emailUnsettledCount, 1, code);
      assert.equal(result.summary.emailAcceptedCount, 0, code);
      assert.equal(harness.capability.providerCalls.length, 1, code);
      assert.equal(harness.client.emailOutcomeCalls.length, 1, code);
      assert.equal(harness.client.releaseCalls.length, 0, code);
    }
  });

  it("fails closed on settlement correlation mismatch, malformed response, and unknown status", async () => {
    const scenarios: Array<{
      name: string;
      handler: EmailOutcomeHandler;
    }> = [
      {
        name: "order mismatch",
        handler: (input) => {
          const success = emailOutcomeSuccess(input) as Extract<
            RecordEmailDeliveryOutcomeResult,
            { kind: "success" }
          >;
          return {
            ...success,
            response: { ...success.response, order_id: ORDER_B },
          } as RecordEmailDeliveryOutcomeResult;
        },
      },
      {
        name: "attempt mismatch",
        handler: (input) => {
          const success = emailOutcomeSuccess(input) as Extract<
            RecordEmailDeliveryOutcomeResult,
            { kind: "success" }
          >;
          return {
            ...success,
            response: {
              ...success.response,
              delivery_attempt_id: ORDER_C,
            },
          } as RecordEmailDeliveryOutcomeResult;
        },
      },
      {
        name: "malformed",
        handler: () =>
          ({
            kind: "malformed_response",
            rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
            field: "response",
            reason: "Synthetic malformed response",
          }) as RecordEmailDeliveryOutcomeResult,
      },
      {
        name: "unknown status",
        handler: () =>
          ({
            kind: "unknown_status",
            rpc: ACCESS_FULFILLMENT_RPC.recordEmailOutcome,
            field: "status",
            status: "synthetic_unknown",
          }) as RecordEmailDeliveryOutcomeResult,
      },
    ];

    for (const scenario of scenarios) {
      const harness = createDurableWorkerHarness();
      harness.client.emailOutcomeHandler = scenario.handler;
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", scenario.name);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_outcome_settlement_exhausted",
        scenario.name,
      );
      assert.equal(result.summary.emailUnsettledCount, 1, scenario.name);
      assert.equal(harness.capability.providerCalls.length, 1, scenario.name);
      assert.equal(harness.client.emailOutcomeCalls.length, 1, scenario.name);
      assert.equal(harness.client.releaseCalls.length, 0, scenario.name);
    }
  });

  it("bounds transport and deadline settlement uncertainty at two identical attempts", async () => {
    const transport = createDurableWorkerHarness();
    transport.client.emailOutcomeHandler = () => transportEmailOutcome();
    const transportResult = await transport.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(transportResult.kind, "fatal");
    assert.equal(
      transportResult.kind === "fatal" && transportResult.errorCode,
      "worker_email_outcome_settlement_exhausted",
    );
    assert.equal(transportResult.summary.emailUnsettledCount, 1);
    assert.equal(transport.client.emailOutcomeCalls.length, 2);
    assert.equal(
      transport.client.emailOutcomeCalls[0],
      transport.client.emailOutcomeCalls[1],
    );

    const scheduler = new ControlledDeadlineScheduler();
    const deadline = createDurableWorkerHarness({
      createDeadline: controlledDeadlineFactory(scheduler),
    });
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const never = deferred<RecordEmailDeliveryOutcomeResult>();
    let calls = 0;
    deadline.client.emailOutcomeHandler = () => {
      calls += 1;
      (calls === 1 ? firstStarted : secondStarted).resolve();
      return never.promise;
    };

    const run = deadline.worker.runOnce(new AbortController().signal);
    await firstStarted.promise;
    let activeIndex = -1;
    scheduler.entries.forEach((entry, index) => {
      if (entry.timeoutMs === 10_000 && !entry.cancelled) {
        activeIndex = index;
      }
    });
    assert.notEqual(activeIndex, -1);
    scheduler.fire(activeIndex);
    await secondStarted.promise;
    activeIndex = -1;
    scheduler.entries.forEach((entry, index) => {
      if (entry.timeoutMs === 10_000 && !entry.cancelled) {
        activeIndex = index;
      }
    });
    assert.notEqual(activeIndex, -1);
    scheduler.fire(activeIndex);
    const deadlineResult = await run;

    assert.equal(deadlineResult.kind, "fatal");
    assert.equal(
      deadlineResult.kind === "fatal" && deadlineResult.errorCode,
      "worker_email_outcome_settlement_exhausted",
    );
    assert.equal(deadlineResult.summary.emailUnsettledCount, 1);
    assert.equal(deadline.client.emailOutcomeCalls.length, 2);
    assert.equal(
      deadline.client.emailOutcomeCalls[0],
      deadline.client.emailOutcomeCalls[1],
    );
  });

  it("keeps an already-started settlement alive through a peer fatal", async () => {
    const outcomeStarted = deferred<void>();
    const fatalObserved = deferred<void>();
    class FatalAwareLogger extends MemoryLogger {
      override error(
        event: string,
        metadata?: Record<string, unknown>,
      ): void {
        super.error(event, metadata);
        if (event === "access_fulfillment_worker_fatal_latched") {
          fatalObserved.resolve();
        }
      }
    }
    const logger = new FatalAwareLogger();
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async (orderId) => {
      if (orderId === ORDER_B) {
        await outcomeStarted.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      return {
        kind: "success",
        orderId,
        data: canonicalEmailData(),
      };
    };
    const harness = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
      logger,
    });
    harness.client.emailOutcomeHandler = async (input, options) => {
      outcomeStarted.resolve();
      await fatalObserved.promise;
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "order_not_found",
    );
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(harness.client.emailOutcomeSignals[0]?.aborted, false);
    assert.equal(result.summary.emailAcceptedCount, 1);
    assert.equal(result.summary.failedCount, 1);
    assert.equal(result.summary.emailUnsettledCount, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });
});

describe("access fulfillment durable email edge races and safe logging", () => {
  it("rejects throwing build, provider, and send getters before token generation", async () => {
    const invalid: unknown[] = [
      Object.defineProperty(
        {
          load: async () => ({
            kind: "success",
            orderId: ORDER_A,
            data: canonicalEmailData(),
          }),
        },
        "build",
        {
          get() {
            throw new Error("synthetic build getter failure");
          },
        },
      ),
      Object.defineProperty(
        {
          load: async () => ({
            kind: "success",
            orderId: ORDER_A,
            data: canonicalEmailData(),
          }),
          build: async () => canonicalBuiltMessage(),
        },
        "provider",
        {
          get() {
            throw new Error("synthetic provider getter failure");
          },
        },
      ),
      {
        load: async () => ({
          kind: "success",
          orderId: ORDER_A,
          data: canonicalEmailData(),
        }),
        build: async () => canonicalBuiltMessage(),
        provider: Object.defineProperty({}, "send", {
          get() {
            throw new Error("synthetic send getter failure");
          },
        }),
      },
    ];

    for (const emailCapability of invalid) {
      const client = new RecordingWorkerClient();
      const harness = createWorkerHarness(client, {
        config: { durableEmailDeliveryEnabled: true },
        emailCapability:
          emailCapability as AccessFulfillmentEmailCapability,
      });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "fatal");
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_capability_invalid",
      );
      assert.equal(harness.generatedTokenCount(), 0);
      assert.equal(client.claimCalls.length, 0);
    }
  });

  it("classifies unexplained loader abort and releases only for actual shutdown", async () => {
    const unexplainedCapability = new RecordingEmailCapability();
    unexplainedCapability.loadHandler = async () => ({
      kind: "aborted",
      errorCode: "email_message_data_load_aborted",
    });
    const unexplained = createDurableWorkerHarness({
      capability: unexplainedCapability,
    });
    const unexplainedResult = await unexplained.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(unexplainedResult.kind, "fatal");
    assert.equal(
      unexplainedResult.kind === "fatal" && unexplainedResult.errorCode,
      "worker_email_loader_contract_invalid",
    );
    assert.equal(unexplained.client.releaseCalls.length, 0);
    assert.equal(unexplainedCapability.providerCalls.length, 0);

    const controller = new AbortController();
    const shutdownCapability = new RecordingEmailCapability();
    const loadStarted = deferred<void>();
    shutdownCapability.loadHandler = async (_orderId, options) => {
      loadStarted.resolve();
      await new Promise<void>((resolve) => {
        options?.signal?.addEventListener("abort", () => resolve(), {
          once: true,
        });
      });
      return {
        kind: "aborted",
        errorCode: "email_message_data_load_aborted",
      };
    };
    const shutdown = createDurableWorkerHarness({
      capability: shutdownCapability,
    });
    const run = shutdown.worker.runOnce(controller.signal);
    await loadStarted.promise;
    controller.abort("synthetic loader shutdown");
    const shutdownResult = await run;
    assert.equal(shutdownResult.kind, "shutdown");
    assert.equal(shutdown.client.releaseCalls.length, 1);
    assert.equal(shutdown.client.releaseCalls[0]?.retryAfterSeconds, 0);
    assert.equal(shutdown.client.releaseCalls[0]?.errorCode, null);
    assert.equal(shutdownCapability.providerCalls.length, 0);
  });

  it("propagates peer fatal through an ordinary loader signal without cleanup release", async () => {
    const firstLoaderStarted = deferred<void>();
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async (orderId, options) => {
      if (orderId === ORDER_B) {
        await firstLoaderStarted.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      firstLoaderStarted.resolve();
      await new Promise<void>((resolve) => {
        options?.signal?.addEventListener("abort", () => resolve(), {
          once: true,
        });
      });
      return {
        kind: "aborted",
        errorCode: "email_message_data_load_aborted",
      };
    };
    const harness = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "order_not_found",
    );
    assert.equal(capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
    assert.equal(harness.client.emailClaimCalls.length, 0);
  });

  it("rejects generic builder throws and malformed message internals before claim", async () => {
    const thrownCapability = new RecordingEmailCapability();
    thrownCapability.buildHandler = async () => {
      throw new Error("synthetic noncanonical builder throw");
    };
    const thrown = createDurableWorkerHarness({
      capability: thrownCapability,
    });
    const thrownResult = await thrown.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(thrownResult.kind, "fatal");
    assert.equal(
      thrownResult.kind === "fatal" && thrownResult.errorCode,
      "worker_email_builder_contract_invalid",
    );

    const valid = canonicalBuiltMessage();
    const malformed: unknown[] = [
      {
        ...valid,
        message: {
          ...valid.message,
          from: "invalid from",
        },
      },
      {
        ...valid,
        message: {
          ...valid.message,
          html: "",
        },
      },
      {
        ...valid,
        message: {
          ...valid.message,
          attachments: valid.message.attachments.slice(0, 1),
        },
      },
      {
        ...valid,
        message: {
          ...valid.message,
          attachments: valid.message.attachments.map((attachment, index) =>
            index === 0 ? { ...attachment, content: "not base64!" } : attachment,
          ),
        },
      },
      {
        ...valid,
        message: {
          ...valid.message,
          attachments: valid.message.attachments.map((attachment, index) =>
            index === 0
              ? { ...attachment, filename: "wrong.png" }
              : attachment,
          ),
        },
      },
      {
        ...valid,
        message: { ...valid.message, extra: true },
      },
    ];

    for (const value of malformed) {
      const capability = new RecordingEmailCapability();
      capability.buildHandler = async () =>
        value as BuiltAccessEntriesEmailMessage;
      const harness = createDurableWorkerHarness({ capability });
      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );
      assert.equal(result.kind, "fatal");
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_builder_contract_invalid",
      );
      assert.equal(harness.client.emailClaimCalls.length, 0);
      assert.equal(capability.providerCalls.length, 0);
    }
  });

  it("accepts fresh and replay terminal records and retries correlation or concurrency exactly", async () => {
    for (const idempotent of [false, true]) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "terminal_error",
        errorCode: "entries_not_found",
      });
      const harness = createDurableWorkerHarness({ capability });
      harness.client.emailTerminalHandler = (input) =>
        emailTerminalSuccess(input, idempotent);

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed");
      assert.equal(result.summary.emailManualReviewCount, 1);
      assert.deepEqual(harness.client.emailTerminalCalls[0], {
        orderId: ORDER_A,
        reconcileLeaseToken: TOKEN_A,
        reconcileLeaseEpoch: 1,
        emailGeneration: 1,
        errorCode: "entries_not_found",
      });
      assert.equal(Object.isFrozen(harness.client.emailTerminalCalls[0]), true);
      assert.equal(capability.providerCalls.length, 0);
      assert.equal(harness.client.releaseCalls.length, 0);
    }

    for (const first of ["concurrency", "correlation"] as const) {
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "terminal_error",
        errorCode: "entries_invalid",
      });
      const harness = createDurableWorkerHarness({ capability });
      let calls = 0;
      harness.client.emailTerminalHandler = (input) => {
        calls += 1;
        if (calls === 1) {
          if (first === "concurrency") {
            return {
              kind: "business_error",
              rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
              response: {
                ok: false,
                retryable: true,
                error: {
                  code: "concurrency_conflict",
                  message: "Sanitized test error",
                },
              },
            };
          }
          const success = emailTerminalSuccess(input) as Extract<
            RecordEmailPreclaimTerminalFailureResult,
            { kind: "success" }
          >;
          return {
            ...success,
            response: {
              ...success.response,
              generation: input.emailGeneration + 1,
            },
          } as RecordEmailPreclaimTerminalFailureResult;
        }
        return emailTerminalSuccess(input, true);
      };

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "completed", first);
      assert.equal(result.summary.emailManualReviewCount, 1, first);
      assert.equal(harness.client.emailTerminalCalls.length, 2, first);
      assert.equal(
        harness.client.emailTerminalCalls[0],
        harness.client.emailTerminalCalls[1],
        first,
      );
      assert.equal(capability.providerCalls.length, 0, first);
    }
  });

  it("bounds malformed terminal responses and preserves a terminal outcome across peer fatal", async () => {
    const malformedCapability = new RecordingEmailCapability();
    malformedCapability.loadHandler = async () => ({
      kind: "terminal_error",
      errorCode: "source_invalid",
    });
    const malformed = createDurableWorkerHarness({
      capability: malformedCapability,
    });
    malformed.client.emailTerminalHandler = () =>
      ({
        kind: "malformed_response",
        rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
        field: "response",
        reason: "Synthetic malformed response",
      }) as RecordEmailPreclaimTerminalFailureResult;
    const malformedResult = await malformed.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(malformedResult.kind, "fatal");
    assert.equal(
      malformedResult.kind === "fatal" && malformedResult.errorCode,
      "worker_email_terminal_preclaim_recovery_exhausted",
    );
    assert.equal(malformedResult.summary.emailUnsettledCount, 1);
    assert.equal(malformed.client.emailTerminalCalls.length, 2);
    assert.equal(
      malformed.client.emailTerminalCalls[0],
      malformed.client.emailTerminalCalls[1],
    );

    const terminalStarted = deferred<void>();
    const fatalObserved = deferred<void>();
    class TerminalFatalLogger extends MemoryLogger {
      override error(
        event: string,
        metadata?: Record<string, unknown>,
      ): void {
        super.error(event, metadata);
        if (event === "access_fulfillment_worker_fatal_latched") {
          fatalObserved.resolve();
        }
      }
    }
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async (orderId) => {
      if (orderId === ORDER_B) {
        await terminalStarted.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      return {
        kind: "terminal_error",
        errorCode: "entries_not_found",
      };
    };
    const terminal = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
      logger: new TerminalFatalLogger(),
    });
    terminal.client.emailTerminalHandler = async (input, options) => {
      terminalStarted.resolve();
      await fatalObserved.promise;
      assert.equal(options?.signal?.aborted, false);
      return emailTerminalSuccess(input);
    };

    const terminalResult = await terminal.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(terminalResult.kind, "fatal");
    assert.equal(
      terminalResult.kind === "fatal" && terminalResult.errorCode,
      "order_not_found",
    );
    assert.equal(terminalResult.summary.emailManualReviewCount, 1);
    assert.equal(terminal.client.emailTerminalCalls.length, 1);
    assert.equal(terminal.client.emailTerminalSignals[0]?.aborted, false);
    assert.equal(capability.providerCalls.length, 0);
    assert.equal(terminal.client.releaseCalls.length, 0);
  });

  it("continues a claim obligation after peer fatal but does not start provider", async () => {
    const claimStarted = deferred<void>();
    const fatalObserved = deferred<void>();
    class ClaimFatalLogger extends MemoryLogger {
      override error(
        event: string,
        metadata?: Record<string, unknown>,
      ): void {
        super.error(event, metadata);
        if (event === "access_fulfillment_worker_fatal_latched") {
          fatalObserved.resolve();
        }
      }
    }
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async (orderId) => {
      if (orderId === ORDER_B) {
        await claimStarted.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      return {
        kind: "success",
        orderId,
        data: canonicalEmailData(),
      };
    };
    const harness = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
      logger: new ClaimFatalLogger(),
    });
    harness.client.emailClaimHandler = async (input, options) => {
      claimStarted.resolve();
      await fatalObserved.promise;
      assert.equal(options?.signal?.aborted, false);
      return correlatedEmailClaimSuccess(input);
    };
    harness.client.emailOutcomeHandler = (input, options) => {
      assert.equal(options?.signal?.aborted, false);
      return emailOutcomeSuccess(input);
    };

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "order_not_found",
    );
    assert.equal(harness.client.emailClaimCalls.length, 1);
    assert.equal(harness.client.emailClaimSignals[0]?.aborted, false);
    assert.equal(capability.providerCalls.length, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.errorCode,
      "provider_call_not_started_aborted",
    );
    assert.equal(result.summary.emailRetryScheduledCount, 1);
    assert.equal(result.summary.failedCount, 1);
    assert.equal(harness.client.releaseCalls.length, 0);
  });

  it("never serializes buyer, message, authority, provider, abort, or secret sentinels", async () => {
    const logger = new MemoryLogger();
    const capability = new RecordingEmailCapability();
    const data: AccessEmailMessageData = Object.freeze({
      ...canonicalEmailData(),
      buyerEmail: "buyer-log-sentinel@example.test",
      buyerName: "BUYER_NAME_SENTINEL",
      entries: Object.freeze(
        canonicalEmailData().entries.map((entry, index) =>
          Object.freeze({
            ...entry,
            checkinToken:
              index === 0
                ? EMAIL_CHECKIN_LOG
                : entry.checkinToken,
          }),
        ),
      ),
    });
    capability.loadHandler = async (orderId) => ({
      kind: "success",
      orderId,
      data,
    });
    capability.buildHandler = async (loaded) => {
      const base = canonicalBuiltMessage(loaded);
      const message = Object.freeze({
        ...base.message,
        from: "LOGGER_SECRET_FROM <logger-secret@example.test>",
        html: "<p>HTML_SENTINEL</p>",
        attachments: Object.freeze(
          base.message.attachments.map((attachment, index) =>
            Object.freeze({
              ...attachment,
              content:
                index === 0 ? "UVJfU0VOVElORUw=" : attachment.content,
            }),
          ),
        ),
      });
      return Object.freeze({
        ...base,
        message,
        requestPayloadHash: calculateAccessEmailRequestPayloadHash({
          templateVersion: base.templateVersion,
          message,
        }),
      });
    };
    capability.providerHandler = async () => ({
      kind: "accepted",
      providerMessageId: "PROVIDER_MESSAGE_SENTINEL",
    });
    const accepted = createDurableWorkerHarness({
      capability,
      logger,
    });
    const acceptedResult = await accepted.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(acceptedResult.kind, "completed");

    const rawErrorCapability = new RecordingEmailCapability();
    rawErrorCapability.providerHandler = async () => {
      throw new Error("PROVIDER_RAW_ERROR_SENTINEL");
    };
    const rawError = createDurableWorkerHarness({
      capability: rawErrorCapability,
      logger,
    });
    const rawErrorResult = await rawError.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(rawErrorResult.kind, "completed");

    const controller = new AbortController();
    const abortCapability = new RecordingEmailCapability();
    const providerStarted = deferred<void>();
    const providerNever = deferred<AccessEmailProviderOutcome>();
    abortCapability.providerHandler = async () => {
      providerStarted.resolve();
      return providerNever.promise;
    };
    const aborted = createDurableWorkerHarness({
      capability: abortCapability,
      logger,
    });
    const abortedRun = aborted.worker.runOnce(controller.signal);
    await providerStarted.promise;
    controller.abort("PROVIDER_ABORT_REASON_SENTINEL");
    const abortedResult = await abortedRun;
    assert.equal(abortedResult.kind, "shutdown");

    const serialized = JSON.stringify(logger.entries);
    for (const sentinel of [
      "buyer-log-sentinel@example.test",
      "BUYER_NAME_SENTINEL",
      "LOGGER_SECRET_FROM",
      "logger-secret@example.test",
      "HTML_SENTINEL",
      "UVJfU0VOVElORUw=",
      EMAIL_CHECKIN_LOG,
      TOKEN_A,
      EMAIL_ENTRY_A,
      EMAIL_ENTRY_B,
      EMAIL_ATTEMPT_A,
      "access-email-delivery/" + EMAIL_ATTEMPT_A,
      "PROVIDER_MESSAGE_SENTINEL",
      "PROVIDER_RAW_ERROR_SENTINEL",
      "PROVIDER_ABORT_REASON_SENTINEL",
      "entrada-1.png",
    ]) {
      assert.equal(serialized.includes(sentinel), false, sentinel);
    }
  });
});

describe("access fulfillment durable email zero-start obligation recovery", () => {
  const failLocalObligationSetup: AccessFulfillmentWorkerDeadlineFactory = (
    timeoutMs,
    externalSignal,
  ) => {
    if (externalSignal === undefined) {
      throw new Error("synthetic local obligation setup failure");
    }
    return createAbortDeadline(timeoutMs, externalSignal);
  };

  it("keeps terminal preclaim authority when no terminal RPC invocation starts", async () => {
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async () => ({
      kind: "terminal_error",
      errorCode: "entries_not_found",
    });
    const harness = createDurableWorkerHarness({
      capability,
      createDeadline: failLocalObligationSetup,
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(harness.client.emailTerminalCalls.length, 0);
    assert.equal(harness.client.emailClaimCalls.length, 0);
    assert.equal(capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 1);
    assert.deepEqual(harness.client.releaseCalls[0], {
      orderId: ORDER_A,
      reconcileLeaseToken: TOKEN_A,
      reconcileLeaseEpoch: 1,
      retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
      errorCode: "entries_not_found",
    });
    assert.equal(result.summary.emailRetryScheduledCount, 1);
    assert.equal(result.summary.emailUnsettledCount, 0);
  });

  it("keeps claim preclaim authority when no claim RPC invocation starts", async () => {
    const harness = createDurableWorkerHarness({
      createDeadline: failLocalObligationSetup,
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(harness.client.emailClaimCalls.length, 0);
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 1);
    assert.deepEqual(harness.client.releaseCalls[0], {
      orderId: ORDER_A,
      reconcileLeaseToken: TOKEN_A,
      reconcileLeaseEpoch: 1,
      retryAfterSeconds: WORKER_CONFIG.leaseSeconds,
      errorCode: null,
    });
    assert.equal(result.summary.emailRetryScheduledCount, 1);
    assert.equal(result.summary.emailUnsettledCount, 0);
  });
});

describe("access fulfillment durable email defensive validation edges", () => {
  it("rejects non-UUID and noncanonical check-in tokens before build or claim", async () => {
    for (const checkinToken of [
      "not-a-uuid-checkin-token",
      EMAIL_CHECKIN_A.toUpperCase(),
    ]) {
      const capability = new RecordingEmailCapability();
      const base = canonicalEmailData();
      capability.loadHandler = async (orderId) => ({
        kind: "success",
        orderId,
        data: {
          ...base,
          entries: base.entries.map((entry, index) =>
            index === 0 ? { ...entry, checkinToken } : entry,
          ),
        },
      });
      const harness = createDurableWorkerHarness({ capability });

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", checkinToken);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "worker_email_loader_contract_invalid",
        checkinToken,
      );
      assert.equal(capability.buildCalls.length, 0, checkinToken);
      assert.equal(harness.client.emailClaimCalls.length, 0, checkinToken);
      assert.equal(capability.providerCalls.length, 0, checkinToken);
      assert.equal(harness.client.releaseCalls.length, 0, checkinToken);
    }
  });

  it("rechecks shutdown between zero-start obligation setup attempts", async () => {
    for (const terminal of [false, true]) {
      const controller = new AbortController();
      let localSetupCalls = 0;
      const capability = new RecordingEmailCapability();
      if (terminal) {
        capability.loadHandler = async () => ({
          kind: "terminal_error",
          errorCode: "entries_not_found",
        });
      }
      const harness = createDurableWorkerHarness({
        capability,
        createDeadline: (timeoutMs, externalSignal) => {
          if (externalSignal === undefined) {
            localSetupCalls += 1;
            controller.abort(
              "synthetic shutdown between zero-start obligation attempts",
            );
            throw new Error("synthetic obligation setup failure");
          }
          return createAbortDeadline(timeoutMs, externalSignal);
        },
      });

      const result = await harness.worker.runOnce(controller.signal);

      assert.equal(result.kind, "shutdown", String(terminal));
      assert.equal(localSetupCalls, 1, String(terminal));
      assert.equal(harness.client.emailTerminalCalls.length, 0);
      assert.equal(harness.client.emailClaimCalls.length, 0);
      assert.equal(capability.providerCalls.length, 0);
      assert.equal(harness.client.emailOutcomeCalls.length, 0);
      assert.equal(harness.client.releaseCalls.length, 1);
      assert.equal(harness.client.releaseCalls[0]?.retryAfterSeconds, 0);
      assert.equal(harness.client.releaseCalls[0]?.errorCode, null);
      assert.equal(result.summary.emailUnsettledCount, 0);
    }
  });
});

describe("access fulfillment durable email hostile contracts and stale retention", () => {
  it("maps throwing loader and builder array proxies to their exact contract errors", async () => {
    const loaderCapability = new RecordingEmailCapability();
    const data = canonicalEmailData();
    const throwingEntries = new Proxy([...data.entries], {
      get(target, property, receiver) {
        if (property === "length") {
          throw new Error("synthetic loader array trap");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    loaderCapability.loadHandler = async (orderId) =>
      ({
        kind: "success",
        orderId,
        data: { ...data, entries: throwingEntries },
      }) as AccessEmailMessageDataLoadResult;
    const loader = createDurableWorkerHarness({
      capability: loaderCapability,
    });
    const loaderResult = await loader.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(loaderResult.kind, "fatal");
    assert.equal(
      loaderResult.kind === "fatal" && loaderResult.errorCode,
      "worker_email_loader_contract_invalid",
    );
    assert.equal(loader.client.emailClaimCalls.length, 0);
    assert.equal(loaderCapability.providerCalls.length, 0);

    const builderCapability = new RecordingEmailCapability();
    const built = canonicalBuiltMessage();
    const throwingEntryIds = new Proxy([...built.entryIds], {
      get(target, property, receiver) {
        if (property === "length") {
          throw new Error("synthetic builder array trap");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    builderCapability.buildHandler = async () =>
      ({
        ...built,
        entryIds: throwingEntryIds,
      }) as BuiltAccessEntriesEmailMessage;
    const builder = createDurableWorkerHarness({
      capability: builderCapability,
    });
    const builderResult = await builder.worker.runOnce(
      new AbortController().signal,
    );
    assert.equal(builderResult.kind, "fatal");
    assert.equal(
      builderResult.kind === "fatal" && builderResult.errorCode,
      "worker_email_builder_contract_invalid",
    );
    assert.equal(builder.client.emailClaimCalls.length, 0);
    assert.equal(builderCapability.providerCalls.length, 0);
  });

  it("retains claim and terminal stale conclusions produced after a peer fatal", async () => {
    for (const stage of ["claim", "terminal"] as const) {
      const obligationStarted = deferred<void>();
      const fatalObserved = deferred<void>();
      class StaleFatalLogger extends MemoryLogger {
        override error(
          event: string,
          metadata?: Record<string, unknown>,
        ): void {
          super.error(event, metadata);
          if (event === "access_fulfillment_worker_fatal_latched") {
            fatalObserved.resolve();
          }
        }
      }
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async (orderId) => {
        if (orderId === ORDER_B) {
          await obligationStarted.promise;
          return {
            kind: "terminal_error",
            errorCode: "order_not_found",
          };
        }
        return stage === "terminal"
          ? {
              kind: "terminal_error",
              errorCode: "entries_not_found",
            }
          : {
              kind: "success",
              orderId,
              data: canonicalEmailData(),
            };
      };
      const harness = createDurableWorkerHarness({
        capability,
        items: [
          claimedItem(ORDER_A, "email"),
          claimedItem(ORDER_B, "email"),
        ],
        config: { concurrency: 2 },
        logger: new StaleFatalLogger(),
      });
      if (stage === "claim") {
        harness.client.emailClaimHandler = async (_input, options) => {
          obligationStarted.resolve();
          await fatalObserved.promise;
          assert.equal(options?.signal?.aborted, false);
          return emailClaimBusinessError("stale_lease", {
            order_id: ORDER_A,
          });
        };
      } else {
        harness.client.emailTerminalHandler = async (_input, options) => {
          obligationStarted.resolve();
          await fatalObserved.promise;
          assert.equal(options?.signal?.aborted, false);
          return {
            kind: "business_error",
            rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
            response: {
              ok: false,
              order_id: ORDER_A,
              error: {
                code: "stale_lease",
                message: "Sanitized test error",
              },
            },
          };
        };
      }

      const result = await harness.worker.runOnce(
        new AbortController().signal,
      );

      assert.equal(result.kind, "fatal", stage);
      assert.equal(
        result.kind === "fatal" && result.errorCode,
        "order_not_found",
        stage,
      );
      assert.equal(result.summary.staleCount, 1, stage);
      assert.equal(result.summary.failedCount, 1, stage);
      assert.equal(capability.providerCalls.length, 0, stage);
      assert.equal(harness.client.releaseCalls.length, 0, stage);
      assert.equal(harness.client.emailOutcomeCalls.length, 0, stage);
      assert.equal(
        stage === "claim"
          ? harness.client.emailClaimSignals[0]?.aborted
          : harness.client.emailTerminalSignals[0]?.aborted,
        false,
        stage,
      );
    }
  });
});
describe("access fulfillment durable email provider cleanup", () => {
  it("does not let provider-deadline cleanup failure suppress settlement", async () => {
    let providerDisposeCalls = 0;
    const harness = createDurableWorkerHarness({
      createDeadline: (timeoutMs, externalSignal) => {
        const deadline = createAbortDeadline(timeoutMs, externalSignal);
        if (timeoutMs !== 5_000 || externalSignal !== undefined) {
          return deadline;
        }
        return {
          signal: deadline.signal,
          state: () => deadline.state(),
          didTimeout: () => deadline.didTimeout(),
          wasExternallyAborted: () => deadline.wasExternallyAborted(),
          dispose: () => {
            providerDisposeCalls += 1;
            deadline.dispose();
            throw new Error("synthetic provider cleanup failure");
          },
        };
      },
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(harness.capability.providerCalls.length, 1);
    assert.equal(providerDisposeCalls, 1);
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(result.summary.emailAcceptedCount, 1);
    assert.equal(result.summary.emailUnsettledCount, 0);
  });
});
describe("access fulfillment durable email explicit checklist boundaries", () => {
  it("replays exact terminal and claim requests after a real deadline timeout", async () => {
    {
      const scheduler = new ControlledDeadlineScheduler();
      const capability = new RecordingEmailCapability();
      capability.loadHandler = async () => ({
        kind: "terminal_error",
        errorCode: "entries_not_found",
      });
      const harness = createDurableWorkerHarness({
        capability,
        createDeadline: controlledDeadlineFactory(scheduler),
      });
      const firstStarted = deferred<void>();
      const firstNever =
        deferred<RecordEmailPreclaimTerminalFailureResult>();
      let calls = 0;
      harness.client.emailTerminalHandler = (input) => {
        calls += 1;
        if (calls === 1) {
          firstStarted.resolve();
          return firstNever.promise;
        }
        return emailTerminalSuccess(input, true);
      };

      const run = harness.worker.runOnce(new AbortController().signal);
      await firstStarted.promise;
      let activeIndex = -1;
      scheduler.entries.forEach((entry, index) => {
        if (entry.timeoutMs === 10_000 && !entry.cancelled) {
          activeIndex = index;
        }
      });
      assert.notEqual(activeIndex, -1);
      scheduler.fire(activeIndex);
      const result = await run;

      assert.equal(result.kind, "completed");
      assert.equal(result.summary.emailManualReviewCount, 1);
      assert.equal(harness.client.emailTerminalCalls.length, 2);
      assert.equal(
        harness.client.emailTerminalCalls[0],
        harness.client.emailTerminalCalls[1],
      );
      assert.equal(capability.providerCalls.length, 0);
      assert.equal(harness.client.releaseCalls.length, 0);
    }

    {
      const scheduler = new ControlledDeadlineScheduler();
      const harness = createDurableWorkerHarness({
        createDeadline: controlledDeadlineFactory(scheduler),
      });
      const firstStarted = deferred<void>();
      const firstNever = deferred<ClaimEmailDeliveryResult>();
      let calls = 0;
      harness.client.emailClaimHandler = (input) => {
        calls += 1;
        if (calls === 1) {
          firstStarted.resolve();
          return firstNever.promise;
        }
        return correlatedEmailClaimSuccess(input, { idempotent: true });
      };

      const run = harness.worker.runOnce(new AbortController().signal);
      await firstStarted.promise;
      let activeIndex = -1;
      scheduler.entries.forEach((entry, index) => {
        if (entry.timeoutMs === 10_000 && !entry.cancelled) {
          activeIndex = index;
        }
      });
      assert.notEqual(activeIndex, -1);
      scheduler.fire(activeIndex);
      const result = await run;

      assert.equal(result.kind, "completed");
      assert.equal(result.summary.emailAcceptedCount, 1);
      assert.equal(harness.client.emailClaimCalls.length, 2);
      assert.equal(
        harness.client.emailClaimCalls[0],
        harness.client.emailClaimCalls[1],
      );
      assert.equal(harness.capability.providerCalls.length, 1);
      assert.equal(harness.client.releaseCalls.length, 0);
    }
  });

  it("bounds an unknown terminal status at two exact attempts", async () => {
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async () => ({
      kind: "terminal_error",
      errorCode: "source_invalid",
    });
    const harness = createDurableWorkerHarness({ capability });
    harness.client.emailTerminalHandler = () =>
      ({
        kind: "unknown_status",
        rpc: ACCESS_FULFILLMENT_RPC.recordEmailPreclaimTerminalFailure,
        field: "status",
        status: "synthetic_unknown",
      }) as RecordEmailPreclaimTerminalFailureResult;

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "worker_email_terminal_preclaim_recovery_exhausted",
    );
    assert.equal(result.summary.emailUnsettledCount, 1);
    assert.equal(harness.client.emailTerminalCalls.length, 2);
    assert.equal(
      harness.client.emailTerminalCalls[0],
      harness.client.emailTerminalCalls[1],
    );
    assert.equal(capability.providerCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });

  it("settles delivery payload drift without inventing an attempt", async () => {
    const harness = createDurableWorkerHarness();
    harness.client.emailClaimHandler = () =>
      emailClaimBusinessError("delivery_payload_drift", {
        order_id: ORDER_A,
      });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(result.summary.emailManualReviewCount, 1);
    assert.equal(result.summary.emailUnsettledCount, 0);
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 0);
    assert.equal(harness.client.releaseCalls.length, 0);
  });

  it("classifies a pre-aborted provider deadline before send with zero provider calls", async () => {
    const preAborted = new AbortController();
    preAborted.abort("synthetic provider timeout before send");
    const harness = createDurableWorkerHarness({
      createDeadline: (timeoutMs, externalSignal) =>
        timeoutMs === 5_000 && externalSignal === undefined
          ? createAbortDeadline(timeoutMs, preAborted.signal)
          : createAbortDeadline(timeoutMs, externalSignal),
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "completed");
    assert.equal(harness.capability.providerCalls.length, 0);
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.outcome,
      "failed",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.errorCode,
      "provider_call_not_started_aborted",
    );
    assert.equal(
      harness.client.emailOutcomeCalls[0]?.retryAfterSeconds,
      60,
    );
    assert.equal(result.summary.emailRetryScheduledCount, 1);
  });

  it("retains a settled outcome when a peer latches fatal before indexed storage", async () => {
    const outcomeLogged = deferred<void>();
    class OutcomeBeforeFatalLogger extends MemoryLogger {
      override info(
        event: string,
        metadata?: Record<string, unknown>,
      ): void {
        super.info(event, metadata);
        if (event === "access_fulfillment_email_outcome_settled") {
          outcomeLogged.resolve();
        }
      }
    }
    const capability = new RecordingEmailCapability();
    capability.loadHandler = async (orderId) => {
      if (orderId === ORDER_B) {
        await outcomeLogged.promise;
        return {
          kind: "terminal_error",
          errorCode: "order_not_found",
        };
      }
      return {
        kind: "success",
        orderId,
        data: canonicalEmailData(),
      };
    };
    const harness = createDurableWorkerHarness({
      capability,
      items: [
        claimedItem(ORDER_A, "email"),
        claimedItem(ORDER_B, "email"),
      ],
      config: { concurrency: 2 },
      logger: new OutcomeBeforeFatalLogger(),
    });

    const result = await harness.worker.runOnce(
      new AbortController().signal,
    );

    assert.equal(result.kind, "fatal");
    assert.equal(
      result.kind === "fatal" && result.errorCode,
      "order_not_found",
    );
    assert.equal(result.summary.emailAcceptedCount, 1);
    assert.equal(result.summary.failedCount, 1);
    assert.equal(harness.client.emailOutcomeCalls.length, 1);
    assert.equal(capability.providerCalls.length, 1);
    assert.equal(harness.client.releaseCalls.length, 0);
  });
});
