import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_FULFILLMENT_RPC,
  type AccessFulfillmentRpcCallOptions,
  type ClaimFulfillmentBatchInput,
  type ClaimFulfillmentBatchResult,
  type ReconcileOrderFulfillmentInput,
  type ReconcileOrderFulfillmentResult,
  type ReleaseFulfillmentLeaseInput,
  type ReleaseFulfillmentLeaseResult,
} from "../services/accessFulfillment";
import {
  createAbortDeadline,
  type AbortDeadlineScheduler,
} from "../services/abortDeadline";
import {
  ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH,
  type AccessFulfillmentWorkerClient,
  type AccessFulfillmentWorkerConfig,
  type AccessFulfillmentWorkerDeadlineFactory,
  type AccessFulfillmentWorkerLogger,
  accessFulfillmentClaimRetryDelayMs,
  accessFulfillmentCorrelationHash,
  createAccessFulfillmentWorker,
} from "./accessFulfillmentWorker";
import {
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

class RecordingWorkerClient implements AccessFulfillmentWorkerClient {
  readonly claimCalls: ClaimFulfillmentBatchInput[] = [];
  readonly reconcileCalls: ReconcileOrderFulfillmentInput[] = [];
  readonly releaseCalls: ReleaseFulfillmentLeaseInput[] = [];
  readonly claimSignals: Array<AbortSignal | undefined> = [];
  readonly reconcileSignals: Array<AbortSignal | undefined> = [];
  readonly releaseSignals: Array<AbortSignal | undefined> = [];

  claimHandler: ClaimHandler = () => batchSuccess([]);
  reconcileHandler: ReconcileHandler = reconcileSuccess;
  releaseHandler: ReleaseHandler = releaseSuccess;

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
  });
  return {
    worker,
    logger,
    sleepCalls,
    generatedTokenCount: () => generatedTokens,
  };
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
    let factoryCalls = 0;
    const result = await runAccessFulfillmentWorkerMain({
      env: {},
      logger,
      loadClient: async () => {
        loadCalls += 1;
        return new RecordingWorkerClient();
      },
      createWorker: () => {
        factoryCalls += 1;
        throw new Error("disabled mode must not create a worker");
      },
    });

    assert.deepEqual(result, { kind: "disabled", exitCode: 0 });
    assert.equal(loadCalls, 0);
    assert.equal(factoryCalls, 0);
    assert.equal(logger.entries[0]?.event, "access_fulfillment_worker_disabled");
  });

  it("keeps valid dry-run mode free of Supabase imports and RPCs", async () => {
    let loadCalls = 0;
    const logger = new MemoryLogger();
    const result = await runAccessFulfillmentWorkerMain({
      env: DRY_RUN_ENV,
      logger,
      loadClient: async () => {
        loadCalls += 1;
        return new RecordingWorkerClient();
      },
    });

    assert.deepEqual(result, { kind: "dry_run", exitCode: 0 });
    assert.equal(loadCalls, 0);
    assert.equal(logger.entries[0]?.event, "access_fulfillment_worker_dry_run");
  });

  it("rejects legacy plus dry-run before loading Supabase", async () => {
    let loadCalls = 0;
    const result = await runAccessFulfillmentWorkerMain({
      env: {
        ...DRY_RUN_ENV,
        ACCESS_LEGACY_DIRECT_EMAIL_ENABLED: "true",
      },
      logger: new MemoryLogger(),
      loadClient: async () => {
        loadCalls += 1;
        return new RecordingWorkerClient();
      },
    });

    assert.equal(result.kind, "fatal");
    assert.equal(result.kind === "fatal" && result.errorCode, "invalid_access_fulfillment_configuration");
    assert.equal(loadCalls, 0);
  });

  it("blocks durable capability in dry-run and active modes before Supabase", async () => {
    for (const dryRun of ["true", "false"] as const) {
      let loadCalls = 0;
      const logger = new MemoryLogger();
      const result = await runAccessFulfillmentWorkerMain({
        env: { ...DURABLE_ENV, ACCESS_FULFILLMENT_WORKER_DRY_RUN: dryRun },
        logger,
        loadClient: async () => {
          loadCalls += 1;
          return new RecordingWorkerClient();
        },
      });

      assert.deepEqual(result, {
        kind: "fatal",
        exitCode: 1,
        stopReason: "fatal_stop",
        errorCode: "durable_email_capability_not_implemented",
      });
      assert.equal(loadCalls, 0);
      const serialized = JSON.stringify(logger.entries);
      assert.equal(serialized.includes(DURABLE_ENV.RESEND_API_KEY), false);
      assert.equal(serialized.includes(DURABLE_ENV.EMAIL_FROM_ADDRESS), false);
    }
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
      createWorker: (dependencies) => {
        factoryCalls += 1;
        assert.equal(dependencies.client, client);
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
