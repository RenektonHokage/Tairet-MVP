import { createHash } from "node:crypto";

import {
  ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS,
  type AccessFulfillmentConfig,
} from "../config/accessFulfillment";
import type {
  AccessFulfillmentClient,
  ClaimFulfillmentBatchResult,
  ReleaseFulfillmentLeaseResult,
} from "../services/accessFulfillment";
import {
  createAbortDeadline,
  type AbortDeadline,
} from "../services/abortDeadline";

export const ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH = 16;

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export type AccessFulfillmentWorkerClient = Pick<
  AccessFulfillmentClient,
  "claimFulfillmentBatch" | "reconcileOrderFulfillment" | "releaseFulfillmentLease"
>;

export type AccessFulfillmentWorkerConfig = Pick<
  AccessFulfillmentConfig,
  "batchSize" | "pollIntervalMs" | "leaseSeconds" | "concurrency" | "rpcTimeoutMs"
>;

type ClaimedBatch = Extract<ClaimFulfillmentBatchResult, { kind: "success" }>;
type ClaimedItem = ClaimedBatch["response"]["items"][number];

export interface AccessFulfillmentWorkerLogger {
  info(event: string, metadata?: Record<string, unknown>): void;
  warn(event: string, metadata?: Record<string, unknown>): void;
  error(event: string, metadata?: Record<string, unknown>): void;
}

export type AccessFulfillmentWorkerSleep = (
  milliseconds: number,
  signal: AbortSignal,
) => Promise<void>;

export type AccessFulfillmentWorkerDeadlineFactory = (
  timeoutMs: number,
  externalSignal?: AbortSignal,
) => AbortDeadline;

export interface AccessFulfillmentWorkerDependencies {
  client: AccessFulfillmentWorkerClient;
  config: AccessFulfillmentWorkerConfig;
  generateToken: () => string;
  now: () => number;
  sleep: AccessFulfillmentWorkerSleep;
  logger: AccessFulfillmentWorkerLogger;
  createDeadline?: AccessFulfillmentWorkerDeadlineFactory;
}

export type AccessFulfillmentStopReason =
  | "external_shutdown"
  | "fatal_stop"
  | "normal_completion";

export interface AccessFulfillmentCycleSummary {
  claimedCount: number;
  reconciledCount: number;
  deferredCount: number;
  failedCount: number;
  staleCount: number;
  shutdownReleasedCount: number;
  localLeaseBudgetExhaustedCount: number;
  releaseFailedCount: number;
}

export type AccessFulfillmentRunOnceResult =
  | {
      kind: "empty";
      stopReason: "normal_completion";
      summary: AccessFulfillmentCycleSummary;
    }
  | {
      kind: "completed";
      stopReason: "normal_completion";
      summary: AccessFulfillmentCycleSummary;
    }
  | {
      kind: "shutdown";
      stopReason: "external_shutdown";
      summary: AccessFulfillmentCycleSummary;
    }
  | {
      kind: "fatal";
      stopReason: "fatal_stop";
      errorCode: string;
      summary: AccessFulfillmentCycleSummary;
    };

export type AccessFulfillmentRunLoopResult =
  | { kind: "stopped"; stopReason: "external_shutdown" }
  | { kind: "fatal"; stopReason: "fatal_stop"; errorCode: string };

type ClaimConclusion =
  | {
      kind: "success";
      result: ClaimedBatch;
      conservativeLocalLeaseDeadlineMs: number;
    }
  | { kind: "shutdown" }
  | { kind: "fatal"; errorCode: string };

type ReleaseConclusion =
  | { kind: "released"; terminal: boolean }
  | { kind: "stale" }
  | { kind: "local_lease_budget_exhausted"; observedAtMs: number }
  | { kind: "failed"; errorCode: string }
  | { kind: "fatal"; errorCode: string };

type EffectiveRpcTimeout =
  | { kind: "available"; timeoutMs: number }
  | { kind: "local_lease_budget_exhausted"; observedAtMs: number }
  | { kind: "fatal"; errorCode: string };

type ItemOutcomeKind =
  | "reconciled"
  | "deferred"
  | "failed"
  | "stale"
  | "external_shutdown_released"
  | "local_lease_budget_exhausted";

export type AccessFulfillmentStaleOriginStage =
  | "issuance_reconcile"
  | "issuance_failure_release"
  | "email_defer_release"
  | "shutdown_cleanup_release";

interface ItemProcessingResult {
  kind: ItemOutcomeKind;
  releaseFailed?: boolean;
  fatalErrorCode?: string;
}

interface ProcessItemsResult {
  summary: AccessFulfillmentCycleSummary;
  fatalErrorCode?: string;
}

type DeadlineInvocationConclusion<Response> =
  | { kind: "result"; result: Response }
  | { kind: "deadline_exceeded" }
  | { kind: "external_abort"; requestStarted: boolean }
  | { kind: "fatal_abort"; errorCode: string; requestStarted: boolean }
  | { kind: "thrown" };

interface AccessFulfillmentFatalState {
  readonly errorCode: string;
}

interface CombinedAbortSignal {
  readonly signal: AbortSignal;
  dispose(): void;
}

function combineAbortSignals(
  signals: readonly (AbortSignal | undefined)[],
): CombinedAbortSignal {
  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();

  const dispose = (): void => {
    for (const [signal, listener] of listeners) {
      signal.removeEventListener("abort", listener);
    }
    listeners.clear();
  };

  const abort = (): void => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    dispose();
  };

  for (const signal of new Set(signals.filter((value): value is AbortSignal => Boolean(value)))) {
    if (signal.aborted) {
      abort();
      break;
    }
    const listener = (): void => abort();
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return { signal: controller.signal, dispose };
}

export function accessFulfillmentCorrelationHash(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH);
}

export function accessFulfillmentClaimRetryDelayMs(
  attempt: number,
  config: AccessFulfillmentWorkerConfig,
): number {
  const exponentialDelay = 1_000 * 2 ** Math.min(Math.max(attempt - 1, 0), 3);
  const leaseBound = Math.floor((config.leaseSeconds * 1_000) / 2);
  return Math.min(exponentialDelay, config.pollIntervalMs, 5_000, leaseBound);
}

function emptySummary(claimedCount = 0): AccessFulfillmentCycleSummary {
  return {
    claimedCount,
    reconciledCount: 0,
    deferredCount: 0,
    failedCount: 0,
    staleCount: 0,
    shutdownReleasedCount: 0,
    localLeaseBudgetExhaustedCount: 0,
    releaseFailedCount: 0,
  };
}

function safeErrorCode(value: string | undefined, fallback: string): string {
  return value && SAFE_ERROR_CODE.test(value) ? value : fallback;
}

function releaseFailureCode(result: ReleaseFulfillmentLeaseResult): string {
  switch (result.kind) {
    case "transport_error":
      return "worker_release_transport_error";
    case "malformed_response":
      return "worker_release_malformed_response";
    case "unknown_status":
      return "worker_release_unknown_status";
    case "business_error":
      return safeErrorCode(result.response.error.code, "worker_release_business_error");
    case "success":
      return "worker_release_unexpected_success_classification";
  }
}

export class AccessFulfillmentWorker {
  private lastMonotonicNowMs: number | undefined;
  private fatalState: AccessFulfillmentFatalState | null = null;
  private readonly fatalAbortController = new AbortController();

  constructor(private readonly dependencies: AccessFulfillmentWorkerDependencies) {}

  async runOnce(signal: AbortSignal): Promise<AccessFulfillmentRunOnceResult> {
    const fatalAtStart = this.fatalState;
    if (fatalAtStart) {
      return this.fatalRunOnceResult(fatalAtStart.errorCode, emptySummary());
    }

    if (signal.aborted) {
      return {
        kind: "shutdown",
        stopReason: "external_shutdown",
        summary: emptySummary(),
      };
    }

    const fatalBeforeToken = this.fatalState;
    if (fatalBeforeToken) {
      return this.fatalRunOnceResult(fatalBeforeToken.errorCode, emptySummary());
    }
    const reconcileLeaseToken = this.dependencies.generateToken();
    const fatalAfterToken = this.fatalState;
    if (fatalAfterToken) {
      return this.fatalRunOnceResult(fatalAfterToken.errorCode, emptySummary());
    }
    const tokenHash = accessFulfillmentCorrelationHash(reconcileLeaseToken);
    const claim = await this.claimWithRecovery(reconcileLeaseToken, tokenHash, signal);

    const fatalAfterClaim = this.fatalState;
    if (fatalAfterClaim) {
      return this.fatalRunOnceResult(fatalAfterClaim.errorCode, emptySummary());
    }

    if (claim.kind === "shutdown") {
      return {
        kind: "shutdown",
        stopReason: "external_shutdown",
        summary: emptySummary(),
      };
    }

    if (claim.kind === "fatal") {
      return this.fatalRunOnceResult(claim.errorCode, emptySummary());
    }

    const items = claim.result.response.items;
    if (items.length === 0) {
      return {
        kind: "empty",
        stopReason: "normal_completion",
        summary: emptySummary(),
      };
    }

    const processed = await this.processItems(
      items,
      reconcileLeaseToken,
      tokenHash,
      claim.conservativeLocalLeaseDeadlineMs,
      signal,
    );
    const fatalAfterItems = this.fatalState;
    if (fatalAfterItems) {
      return this.fatalRunOnceResult(
        fatalAfterItems.errorCode,
        processed.summary,
      );
    }
    if (processed.fatalErrorCode) {
      return this.fatalRunOnceResult(
        processed.fatalErrorCode,
        processed.summary,
      );
    }

    if (signal.aborted) {
      return {
        kind: "shutdown",
        stopReason: "external_shutdown",
        summary: processed.summary,
      };
    }

    const fatalBeforeCompletion = this.fatalState;
    if (fatalBeforeCompletion) {
      return this.fatalRunOnceResult(
        fatalBeforeCompletion.errorCode,
        processed.summary,
      );
    }
    return {
      kind: "completed",
      stopReason: "normal_completion",
      summary: processed.summary,
    };
  }

  async runLoop(signal: AbortSignal): Promise<AccessFulfillmentRunLoopResult> {
    for (;;) {
      const fatalBeforeCycle = this.fatalState;
      if (fatalBeforeCycle) {
        return {
          kind: "fatal",
          stopReason: "fatal_stop",
          errorCode: fatalBeforeCycle.errorCode,
        };
      }
      if (signal.aborted) {
        return { kind: "stopped", stopReason: "external_shutdown" };
      }

      const result = await this.runOnce(signal);
      const fatalAfterCycle = this.fatalState;
      if (fatalAfterCycle) {
        return {
          kind: "fatal",
          stopReason: "fatal_stop",
          errorCode: fatalAfterCycle.errorCode,
        };
      }
      if (result.kind === "fatal") {
        return {
          kind: "fatal",
          stopReason: "fatal_stop",
          errorCode: result.errorCode,
        };
      }

      if (result.kind === "shutdown") {
        return { kind: "stopped", stopReason: "external_shutdown" };
      }

      if (result.kind === "empty") {
        try {
          await this.dependencies.sleep(this.dependencies.config.pollIntervalMs, signal);
        } catch {
          const fatalAfterSleep = this.fatalState;
          if (fatalAfterSleep) {
            return {
              kind: "fatal",
              stopReason: "fatal_stop",
              errorCode: fatalAfterSleep.errorCode,
            };
          }
          if (signal.aborted) {
            return { kind: "stopped", stopReason: "external_shutdown" };
          }
          const fatal = this.latchFatalStop("worker_poll_sleep_failed");
          return {
            kind: "fatal",
            stopReason: "fatal_stop",
            errorCode: fatal.errorCode,
          };
        }
      }
    }
  }

  private async claimWithRecovery(
    reconcileLeaseToken: string,
    tokenHash: string,
    signal: AbortSignal,
  ): Promise<ClaimConclusion> {
    let tokenCycleFirstAttemptStartedAtMs: number | undefined;
    let retryAttempt = 0;

    for (;;) {
      const fatalBeforeAttempt = this.fatalState;
      if (fatalBeforeAttempt) {
        return { kind: "fatal", errorCode: fatalBeforeAttempt.errorCode };
      }
      if (signal.aborted) {
        return { kind: "shutdown" };
      }

      const currentClaimAttemptStartedAtMs = this.readMonotonicNow();
      if (currentClaimAttemptStartedAtMs === undefined) {
        return {
          kind: "fatal",
          errorCode:
            this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
        };
      }
      tokenCycleFirstAttemptStartedAtMs ??= currentClaimAttemptStartedAtMs;

      const fatalBeforeClaim = this.fatalState;
      if (fatalBeforeClaim) {
        return { kind: "fatal", errorCode: fatalBeforeClaim.errorCode };
      }
      const invocation = await this.invokeWithDeadline(
        this.dependencies.config.rpcTimeoutMs,
        signal,
        (requestSignal) =>
          this.dependencies.client.claimFulfillmentBatch(
            {
              reconcileLeaseToken,
              limit: this.dependencies.config.batchSize,
              leaseSeconds: this.dependencies.config.leaseSeconds,
            },
            { signal: requestSignal },
          ),
      );

      const fatalAfterClaim = this.fatalState;
      if (fatalAfterClaim || invocation.kind === "fatal_abort") {
        return {
          kind: "fatal",
          errorCode:
            fatalAfterClaim?.errorCode ??
            (invocation.kind === "fatal_abort"
              ? invocation.errorCode
              : "worker_fatal_error"),
        };
      }
      if (invocation.kind === "external_abort") {
        return { kind: "shutdown" };
      }

      let result: ClaimFulfillmentBatchResult;
      let invocationErrorCode: string | undefined;
      if (invocation.kind === "deadline_exceeded") {
        invocationErrorCode = "worker_claim_timeout";
        result = {
          kind: "transport_error",
          rpc: "claim_access_fulfillment_batch",
          message: "Supabase RPC transport failed",
        };
      } else if (invocation.kind === "thrown") {
        invocationErrorCode = "worker_claim_transport_error";
        result = {
          kind: "transport_error",
          rpc: "claim_access_fulfillment_batch",
          message: "Supabase RPC transport failed",
        };
      } else {
        result = invocation.result;
      }

      if (result.kind === "success") {
        const durationMs = this.durationMs(tokenCycleFirstAttemptStartedAtMs);
        const fatalDuringDuration = this.fatalState;
        if (durationMs === undefined || fatalDuringDuration) {
          return {
            kind: "fatal",
            errorCode:
              fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
          };
        }
        const leaseBudgetAnchorMs = result.response.idempotent
          ? tokenCycleFirstAttemptStartedAtMs
          : currentClaimAttemptStartedAtMs;
        const conservativeLocalLeaseDeadlineMs =
          leaseBudgetAnchorMs +
          this.dependencies.config.leaseSeconds * 1_000 -
          ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS;
        const metadata = {
          tokenHash,
          claimedCount: result.response.claimed_count,
          idempotent: result.response.idempotent,
          durationMs,
        };
        if (result.response.claimed_count === 0) {
          this.safeLog("info", "access_fulfillment_batch_empty", metadata);
        } else {
          this.safeLog("info", "access_fulfillment_batch_claimed", metadata);
        }
        return {
          kind: "success",
          result,
          conservativeLocalLeaseDeadlineMs,
        };
      }

      const fatalBeforeFailure = this.fatalState;
      if (fatalBeforeFailure) {
        return { kind: "fatal", errorCode: fatalBeforeFailure.errorCode };
      }
      if (signal.aborted) {
        return { kind: "shutdown" };
      }

      if (result.kind === "malformed_response") {
        const fatal = this.latchFatalStop("worker_claim_malformed_response");
        return { kind: "fatal", errorCode: fatal.errorCode };
      }

      if (result.kind === "business_error" && result.response.retryable !== true) {
        const errorCode = safeErrorCode(
          result.response.error.code,
          "worker_claim_business_error",
        );
        const fatal = this.latchFatalStop(errorCode);
        return { kind: "fatal", errorCode: fatal.errorCode };
      }

      retryAttempt += 1;
      const delayMs = accessFulfillmentClaimRetryDelayMs(
        retryAttempt,
        this.dependencies.config,
      );
      const errorCode =
        invocationErrorCode ??
        (result.kind === "business_error"
          ? safeErrorCode(result.response.error.code, "worker_claim_business_error")
          : "worker_claim_transport_error");
      const durationMs = this.durationMs(tokenCycleFirstAttemptStartedAtMs);
      const fatalDuringRetryLog = this.fatalState;
      if (durationMs === undefined || fatalDuringRetryLog) {
        return {
          kind: "fatal",
          errorCode:
            fatalDuringRetryLog?.errorCode ?? "worker_monotonic_clock_invalid",
        };
      }
      this.safeLog("warn", "access_fulfillment_batch_claim_failed", {
        tokenHash,
        errorCode,
        retryAttempt,
        delayMs,
        durationMs,
      });

      try {
        await this.dependencies.sleep(delayMs, signal);
      } catch {
        const fatalAfterSleep = this.fatalState;
        if (fatalAfterSleep) {
          return { kind: "fatal", errorCode: fatalAfterSleep.errorCode };
        }
        if (signal.aborted) {
          return { kind: "shutdown" };
        }
        const fatal = this.latchFatalStop("worker_claim_retry_sleep_failed");
        return { kind: "fatal", errorCode: fatal.errorCode };
      }
      const fatalAfterSleep = this.fatalState;
      if (fatalAfterSleep) {
        return { kind: "fatal", errorCode: fatalAfterSleep.errorCode };
      }
    }
  }

  private async processItems(
    items: readonly ClaimedItem[],
    reconcileLeaseToken: string,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
  ): Promise<ProcessItemsResult> {
    const started = Array.from({ length: items.length }, () => false);
    const outcomes: ItemProcessingResult[] = [];
    let nextIndex = 0;

    const runner = async (): Promise<void> => {
      for (;;) {
        if (this.fatalState || signal.aborted) {
          return;
        }
        const index = nextIndex;
        if (index >= items.length) {
          return;
        }
        if (this.fatalState || signal.aborted) {
          return;
        }
        nextIndex += 1;
        started[index] = true;
        const item = items[index];
        if (!item) {
          continue;
        }

        let outcome: ItemProcessingResult;
        const startedAt = this.readMonotonicNow();
        if (startedAt === undefined) {
          return;
        }
        try {
          outcome = await this.processItem(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
            conservativeLocalLeaseDeadlineMs,
            signal,
          );
        } catch {
          this.latchFatalStop("worker_item_unexpected_error");
          return;
        }
        if (this.fatalState) {
          return;
        }
        outcomes.push(outcome);
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));

    const fatalAfterRunners = this.fatalState;
    if (fatalAfterRunners) {
      const summary = this.summarize(items.length, outcomes);
      if (fatalAfterRunners.errorCode === "local_lease_budget_exhausted") {
        summary.localLeaseBudgetExhaustedCount += 1;
      }
      return {
        summary,
        fatalErrorCode: fatalAfterRunners.errorCode,
      };
    }

    const pendingItems = items.filter((_item, index) => !started[index]);
    if (pendingItems.length > 0) {
      const pendingOutcomes = await this.releasePendingItems(
        pendingItems,
        reconcileLeaseToken,
        tokenHash,
        conservativeLocalLeaseDeadlineMs,
      );
      const fatalAfterPendingCleanup = this.fatalState;
      if (fatalAfterPendingCleanup) {
        const summary = this.summarize(items.length, outcomes);
        if (
          fatalAfterPendingCleanup.errorCode ===
          "local_lease_budget_exhausted"
        ) {
          summary.localLeaseBudgetExhaustedCount += 1;
        }
        return {
          summary,
          fatalErrorCode: fatalAfterPendingCleanup.errorCode,
        };
      }
      outcomes.push(...pendingOutcomes);
    }

    const fatalAfterCleanup = this.fatalState;
    if (fatalAfterCleanup) {
      const summary = this.summarize(items.length, outcomes);
      if (fatalAfterCleanup.errorCode === "local_lease_budget_exhausted") {
        summary.localLeaseBudgetExhaustedCount += 1;
      }
      return {
        summary,
        fatalErrorCode: fatalAfterCleanup.errorCode,
      };
    }

    return {
      summary: this.summarize(items.length, outcomes),
    };
  }

  private async releasePendingItems(
    items: readonly ClaimedItem[],
    reconcileLeaseToken: string,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
  ): Promise<ItemProcessingResult[]> {
    const outcomes: ItemProcessingResult[] = [];
    let nextIndex = 0;

    const runner = async (): Promise<void> => {
      while (!this.fatalState && nextIndex < items.length) {
        if (this.fatalState) {
          return;
        }
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (!item) {
          continue;
        }
        const outcome = await this.releaseForExternalShutdown(
          item,
          reconcileLeaseToken,
          tokenHash,
          conservativeLocalLeaseDeadlineMs,
        );
        if (this.fatalState) {
          return;
        }
        outcomes.push(outcome);
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));
    return this.fatalState ? [] : outcomes;
  }

  private async processItem(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeItem = this.fatalState;
    if (fatalBeforeItem) {
      return this.latchedFatalItemResult(fatalBeforeItem.errorCode);
    }
    if (signal.aborted) {
      return this.releaseForExternalShutdown(
        item,
        reconcileLeaseToken,
        tokenHash,
        conservativeLocalLeaseDeadlineMs,
        startedAt,
      );
    }

    if (item.work_type === "email") {
      return this.deferEmail(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
      );
    }
    return this.reconcileIssuance(
      item,
      reconcileLeaseToken,
      tokenHash,
      startedAt,
      conservativeLocalLeaseDeadlineMs,
      signal,
    );
  }

  private async reconcileIssuance(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeReconcile = this.fatalState;
    if (fatalBeforeReconcile) {
      return this.latchedFatalItemResult(fatalBeforeReconcile.errorCode);
    }
    const effectiveTimeout = this.effectiveRpcTimeoutMs(
      conservativeLocalLeaseDeadlineMs,
    );
    if (effectiveTimeout.kind === "fatal") {
      return this.latchedFatalItemResult(effectiveTimeout.errorCode);
    }
    if (effectiveTimeout.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(
        startedAt,
        effectiveTimeout.observedAtMs,
      );
    }

    const fatalBeforeRpc = this.fatalState;
    if (fatalBeforeRpc) {
      return this.latchedFatalItemResult(fatalBeforeRpc.errorCode);
    }
    const invocation = await this.invokeWithDeadline(
      effectiveTimeout.timeoutMs,
      signal,
      (requestSignal) =>
        this.dependencies.client.reconcileOrderFulfillment(
          {
            orderId: item.order_id,
            paymentAttemptId: item.approved_payment_attempt_id,
            reconcileLeaseToken,
            reconcileLeaseEpoch: item.reconcile_lease_epoch,
          },
          { signal: requestSignal },
        ),
    );

    const fatalAfterRpc = this.fatalState;
    if (fatalAfterRpc || invocation.kind === "fatal_abort") {
      return this.latchedFatalItemResult(
        fatalAfterRpc?.errorCode ??
          (invocation.kind === "fatal_abort"
            ? invocation.errorCode
            : "worker_fatal_error"),
      );
    }
    if (invocation.kind === "external_abort" && !invocation.requestStarted) {
      return this.releaseForExternalShutdown(
        item,
        reconcileLeaseToken,
        tokenHash,
        conservativeLocalLeaseDeadlineMs,
        startedAt,
      );
    }

    if (invocation.kind === "deadline_exceeded") {
      return this.releaseAfterFailure(
        item,
        reconcileLeaseToken,
        tokenHash,
        "worker_reconcile_timeout",
        startedAt,
        conservativeLocalLeaseDeadlineMs,
      );
    }

    if (invocation.kind === "external_abort") {
      return this.releaseAfterFailure(
        item,
        reconcileLeaseToken,
        tokenHash,
        "reconcile_outcome_ambiguous",
        startedAt,
        conservativeLocalLeaseDeadlineMs,
      );
    }

    if (invocation.kind === "thrown") {
      return this.releaseAfterFailure(
        item,
        reconcileLeaseToken,
        tokenHash,
        "worker_reconcile_transport_error",
        startedAt,
        conservativeLocalLeaseDeadlineMs,
      );
    }

    const result = invocation.result;
    if (result.kind === "success") {
      if (
        result.response.order_id !== item.order_id ||
        result.response.payment_attempt_id !== item.approved_payment_attempt_id
      ) {
        return this.releaseAfterFailure(
          item,
          reconcileLeaseToken,
          tokenHash,
          "worker_reconcile_malformed_response",
          startedAt,
          conservativeLocalLeaseDeadlineMs,
        );
      }
      const durationMs = this.durationMs(startedAt);
      const fatalDuringDuration = this.fatalState;
      if (durationMs === undefined || fatalDuringDuration) {
        return this.latchedFatalItemResult(
          fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
        );
      }
      this.safeLog(
        "info",
        "access_fulfillment_item_reconciled",
        this.itemMetadata(item, tokenHash, {
          idempotent: result.response.idempotent,
          durationMs,
        }),
      );
      return { kind: "reconciled" };
    }

    if (
      result.kind === "business_error" &&
      result.response.error.code === "stale_lease"
    ) {
      return this.logStaleLease(
        item,
        tokenHash,
        "issuance_reconcile",
        startedAt,
      );
    }

    let errorCode: string;
    switch (result.kind) {
      case "transport_error":
        errorCode = "worker_reconcile_transport_error";
        break;
      case "malformed_response":
        errorCode = "worker_reconcile_malformed_response";
        break;
      case "unknown_status":
        errorCode = "worker_reconcile_unknown_status";
        break;
      case "business_error":
        errorCode = safeErrorCode(
          result.response.error.code,
          "worker_reconcile_business_error",
        );
        break;
    }

    return this.releaseAfterFailure(
      item,
      reconcileLeaseToken,
      tokenHash,
      errorCode,
      startedAt,
      conservativeLocalLeaseDeadlineMs,
    );
  }

  private async deferEmail(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeDefer = this.fatalState;
    if (fatalBeforeDefer) {
      return this.latchedFatalItemResult(fatalBeforeDefer.errorCode);
    }
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      this.dependencies.config.leaseSeconds,
      null,
      conservativeLocalLeaseDeadlineMs,
      signal,
    );

    if (release.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(
        startedAt,
        release.observedAtMs,
      );
    }
    const fatalAfterRelease = this.fatalState;
    if (fatalAfterRelease) {
      return this.latchedFatalItemResult(fatalAfterRelease.errorCode);
    }
    if (release.kind === "released") {
      const durationMs = this.durationMs(startedAt);
      const fatalDuringDuration = this.fatalState;
      if (durationMs === undefined || fatalDuringDuration) {
        return this.latchedFatalItemResult(
          fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
        );
      }
      this.safeLog(
        "info",
        "access_fulfillment_item_deferred",
        this.itemMetadata(item, tokenHash, {
          terminal: release.terminal,
          durationMs,
        }),
      );
      return { kind: "deferred" };
    }

    if (release.kind === "stale") {
      return this.logStaleLease(
        item,
        tokenHash,
        "email_defer_release",
        startedAt,
      );
    }

    return this.logReleaseFailure(
      item,
      tokenHash,
      release,
      "worker_email_defer_failed",
      startedAt,
    );
  }

  private async releaseAfterFailure(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    errorCode: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeRelease = this.fatalState;
    if (fatalBeforeRelease) {
      return this.latchedFatalItemResult(fatalBeforeRelease.errorCode);
    }
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      this.dependencies.config.leaseSeconds,
      errorCode,
      conservativeLocalLeaseDeadlineMs,
    );

    if (release.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(
        startedAt,
        release.observedAtMs,
      );
    }
    const fatalAfterRelease = this.fatalState;
    if (fatalAfterRelease) {
      return this.latchedFatalItemResult(fatalAfterRelease.errorCode);
    }
    if (release.kind === "stale") {
      return this.logStaleLease(
        item,
        tokenHash,
        "issuance_failure_release",
        startedAt,
      );
    }

    if (release.kind !== "released") {
      return this.logReleaseFailure(item, tokenHash, release, errorCode, startedAt);
    }

    const durationMs = this.durationMs(startedAt);
    const fatalDuringDuration = this.fatalState;
    if (durationMs === undefined || fatalDuringDuration) {
      return this.latchedFatalItemResult(
        fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
      );
    }
    this.safeLog(
      "warn",
      "access_fulfillment_item_failed",
      this.itemMetadata(item, tokenHash, {
        errorCode,
        leaseReleased: true,
        terminal: release.terminal,
        durationMs,
      }),
    );
    return { kind: "failed" };
  }

  private async releaseForExternalShutdown(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
    existingStartedAt?: number,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeCleanup = this.fatalState;
    if (fatalBeforeCleanup) {
      return this.latchedFatalItemResult(fatalBeforeCleanup.errorCode);
    }
    const startedAt = existingStartedAt ?? this.readMonotonicNow();
    if (startedAt === undefined) {
      return this.latchedFatalItemResult(
        this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
      );
    }
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      0,
      null,
      conservativeLocalLeaseDeadlineMs,
    );
    if (release.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(
        startedAt,
        release.observedAtMs,
      );
    }
    const fatalAfterCleanup = this.fatalState;
    if (fatalAfterCleanup) {
      return this.latchedFatalItemResult(fatalAfterCleanup.errorCode);
    }
    if (release.kind === "released") {
      const durationMs = this.durationMs(startedAt);
      const fatalDuringDuration = this.fatalState;
      if (durationMs === undefined || fatalDuringDuration) {
        return this.latchedFatalItemResult(
          fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
        );
      }
      this.safeLog(
        "info",
        "access_fulfillment_item_deferred",
        this.itemMetadata(item, tokenHash, {
          stopReason: "external_shutdown",
          terminal: release.terminal,
          durationMs,
        }),
      );
      return { kind: "external_shutdown_released" };
    }

    if (release.kind === "stale") {
      return this.logStaleLease(
        item,
        tokenHash,
        "shutdown_cleanup_release",
        startedAt,
      );
    }

    return this.logReleaseFailure(
      item,
      tokenHash,
      release,
      "worker_shutdown_release_failed",
      startedAt,
    );
  }

  private async safeRelease(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    retryAfterSeconds: number,
    errorCode: string | null,
    conservativeLocalLeaseDeadlineMs: number,
    externalSignal?: AbortSignal,
  ): Promise<ReleaseConclusion> {
    const fatalBeforeRelease = this.fatalState;
    if (fatalBeforeRelease) {
      return { kind: "fatal", errorCode: fatalBeforeRelease.errorCode };
    }

    const effectiveTimeout = this.effectiveRpcTimeoutMs(
      conservativeLocalLeaseDeadlineMs,
    );
    if (effectiveTimeout.kind === "fatal") {
      return { kind: "fatal", errorCode: effectiveTimeout.errorCode };
    }
    if (effectiveTimeout.kind === "local_lease_budget_exhausted") {
      return {
        kind: "local_lease_budget_exhausted",
        observedAtMs: effectiveTimeout.observedAtMs,
      };
    }

    const fatalBeforeRpc = this.fatalState;
    if (fatalBeforeRpc) {
      return { kind: "fatal", errorCode: fatalBeforeRpc.errorCode };
    }
    const invocation = await this.invokeWithDeadline(
      effectiveTimeout.timeoutMs,
      externalSignal,
      (requestSignal) =>
        this.dependencies.client.releaseFulfillmentLease(
          {
            orderId: item.order_id,
            reconcileLeaseToken,
            reconcileLeaseEpoch: item.reconcile_lease_epoch,
            retryAfterSeconds,
            errorCode,
          },
          { signal: requestSignal },
        ),
    );

    const fatalAfterRelease = this.fatalState;
    if (fatalAfterRelease || invocation.kind === "fatal_abort") {
      return {
        kind: "fatal",
        errorCode:
          fatalAfterRelease?.errorCode ??
          (invocation.kind === "fatal_abort"
            ? invocation.errorCode
            : "worker_fatal_error"),
      };
    }
    if (invocation.kind === "deadline_exceeded") {
      return { kind: "failed", errorCode: "worker_release_timeout" };
    }
    if (invocation.kind === "external_abort") {
      return { kind: "failed", errorCode: "worker_release_external_abort" };
    }
    if (invocation.kind === "thrown") {
      return { kind: "failed", errorCode: "worker_release_transport_error" };
    }

    const result: ReleaseFulfillmentLeaseResult = invocation.result;
    const fatalBeforeResult = this.fatalState;
    if (fatalBeforeResult) {
      return { kind: "fatal", errorCode: fatalBeforeResult.errorCode };
    }
    try {
      if (result.kind === "success") {
        if (
          result.response.order_id !== item.order_id ||
          result.response.epoch !== item.reconcile_lease_epoch
        ) {
          return { kind: "failed", errorCode: "worker_release_malformed_response" };
        }
        return {
          kind: "released",
          terminal: "terminal" in result.response && result.response.terminal === true,
        };
      }

      if (result.kind === "business_error") {
        if (result.response.error.code === "stale_lease") {
          return { kind: "stale" };
        }
        if (result.response.error.code === "provider_outcome_required") {
          const fatal = this.latchFatalStop("provider_outcome_required");
          return { kind: "fatal", errorCode: fatal.errorCode };
        }
      }

      return { kind: "failed", errorCode: releaseFailureCode(result) };
    } catch {
      return { kind: "failed", errorCode: "worker_release_malformed_response" };
    }
  }

  private async invokeWithDeadline<Response>(
    timeoutMs: number,
    externalSignal: AbortSignal | undefined,
    invoke: (signal: AbortSignal) => Promise<Response>,
  ): Promise<DeadlineInvocationConclusion<Response>> {
    const fatalBeforeDeadline = this.fatalState;
    if (fatalBeforeDeadline) {
      return {
        kind: "fatal_abort",
        errorCode: fatalBeforeDeadline.errorCode,
        requestStarted: false,
      };
    }

    const combinedSignal = combineAbortSignals([
      externalSignal,
      this.fatalAbortController.signal,
    ]);
    let deadline: AbortDeadline;
    try {
      deadline = (this.dependencies.createDeadline ?? createAbortDeadline)(
        timeoutMs,
        combinedSignal.signal,
      );
    } catch {
      combinedSignal.dispose();
      const fatalAfterDeadlineFailure = this.fatalState;
      if (fatalAfterDeadlineFailure) {
        return {
          kind: "fatal_abort",
          errorCode: fatalAfterDeadlineFailure.errorCode,
          requestStarted: false,
        };
      }
      return { kind: "thrown" };
    }

    let requestStarted = false;
    let removeAbortListener = (): void => undefined;
    try {
      const fatalBeforeInvoke = this.fatalState;
      if (fatalBeforeInvoke) {
        return {
          kind: "fatal_abort",
          errorCode: fatalBeforeInvoke.errorCode,
          requestStarted: false,
        };
      }
      if (deadline.signal.aborted) {
        return deadline.didTimeout()
          ? { kind: "deadline_exceeded" }
          : { kind: "external_abort", requestStarted: false };
      }

      const abortPromise = new Promise<{ kind: "aborted" }>((resolve) => {
        const handleAbort = (): void => {
          resolve({ kind: "aborted" });
        };
        deadline.signal.addEventListener("abort", handleAbort, { once: true });
        removeAbortListener = () => {
          deadline.signal.removeEventListener("abort", handleAbort);
        };
      });

      let operationPromise: Promise<
        { kind: "result"; result: Response } | { kind: "thrown" }
      >;
      try {
        requestStarted = true;
        operationPromise = Promise.resolve(invoke(deadline.signal)).then(
          (result) => ({ kind: "result" as const, result }),
          () => ({ kind: "thrown" as const }),
        );
      } catch {
        const fatalAfterInvokeFailure = this.fatalState;
        if (fatalAfterInvokeFailure) {
          return {
            kind: "fatal_abort",
            errorCode: fatalAfterInvokeFailure.errorCode,
            requestStarted,
          };
        }
        return { kind: "thrown" };
      }

      const fatalAfterInvoke = this.fatalState;
      if (fatalAfterInvoke) {
        return {
          kind: "fatal_abort",
          errorCode: fatalAfterInvoke.errorCode,
          requestStarted,
        };
      }
      if (deadline.signal.aborted) {
        return deadline.didTimeout()
          ? { kind: "deadline_exceeded" }
          : { kind: "external_abort", requestStarted };
      }

      const conclusion = await Promise.race([operationPromise, abortPromise]);
      const fatalAfterAwait = this.fatalState;
      if (fatalAfterAwait) {
        return {
          kind: "fatal_abort",
          errorCode: fatalAfterAwait.errorCode,
          requestStarted,
        };
      }
      if (deadline.signal.aborted) {
        return deadline.didTimeout()
          ? { kind: "deadline_exceeded" }
          : { kind: "external_abort", requestStarted };
      }

      return conclusion.kind === "aborted"
        ? { kind: "external_abort", requestStarted }
        : conclusion;
    } finally {
      removeAbortListener();
      deadline.dispose();
      combinedSignal.dispose();
    }
  }

  private effectiveRpcTimeoutMs(
    conservativeLocalLeaseDeadlineMs: number,
  ): EffectiveRpcTimeout {
    const fatalBeforeClock = this.fatalState;
    if (fatalBeforeClock) {
      return { kind: "fatal", errorCode: fatalBeforeClock.errorCode };
    }
    const nowMs = this.readMonotonicNow();
    if (nowMs === undefined) {
      return {
        kind: "fatal",
        errorCode:
          this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
      };
    }
    const remainingLocalLeaseBudgetMs =
      conservativeLocalLeaseDeadlineMs - nowMs;
    if (
      !Number.isFinite(remainingLocalLeaseBudgetMs) ||
      remainingLocalLeaseBudgetMs <= 0
    ) {
      const fatal = this.latchFatalStop("local_lease_budget_exhausted");
      return fatal.errorCode === "local_lease_budget_exhausted"
        ? { kind: "local_lease_budget_exhausted", observedAtMs: nowMs }
        : { kind: "fatal", errorCode: fatal.errorCode };
    }
    return {
      kind: "available",
      timeoutMs: Math.min(
        this.dependencies.config.rpcTimeoutMs,
        remainingLocalLeaseBudgetMs,
      ),
    };
  }

  private latchFatalStop(errorCode: string): AccessFulfillmentFatalState {
    const existing = this.fatalState;
    if (existing) {
      return existing;
    }

    const fatal: AccessFulfillmentFatalState = {
      errorCode: safeErrorCode(errorCode, "worker_fatal_error"),
    };
    this.fatalState = fatal;
    this.fatalAbortController.abort();
    this.writeLog("error", "access_fulfillment_worker_fatal_latched", {
      errorCode: fatal.errorCode,
      stopReason: "fatal_stop",
    });
    return fatal;
  }

  private fatalRunOnceResult(
    errorCode: string,
    summary: AccessFulfillmentCycleSummary,
  ): AccessFulfillmentRunOnceResult {
    const fatal = this.latchFatalStop(errorCode);
    return {
      kind: "fatal",
      stopReason: "fatal_stop",
      errorCode: fatal.errorCode,
      summary,
    };
  }

  private latchedFatalItemResult(errorCode: string): ItemProcessingResult {
    const fatal = this.latchFatalStop(errorCode);
    return {
      kind:
        fatal.errorCode === "local_lease_budget_exhausted"
          ? "local_lease_budget_exhausted"
          : "failed",
      fatalErrorCode: fatal.errorCode,
    };
  }

  private localLeaseBudgetExhausted(
    startedAt: number,
    observedAtMs: number,
  ): ItemProcessingResult {
    const fatal = this.latchFatalStop("local_lease_budget_exhausted");
    if (fatal.errorCode !== "local_lease_budget_exhausted") {
      return this.latchedFatalItemResult(fatal.errorCode);
    }
    const duration = observedAtMs - startedAt;
    const durationMs =
      Number.isFinite(duration) && duration >= 0
        ? Math.round(duration)
        : undefined;
    this.writeLog(
      "warn",
      "access_fulfillment_local_lease_budget_exhausted",
      {
        errorCode: "local_lease_budget_exhausted",
        remainingBudgetBucket: "exhausted",
        ...(durationMs === undefined ? {} : { durationMs }),
      },
    );
    return this.latchedFatalItemResult(fatal.errorCode);
  }

  private logReleaseFailure(
    item: ClaimedItem,
    tokenHash: string,
    release: Extract<ReleaseConclusion, { kind: "failed" | "fatal" }>,
    itemErrorCode: string,
    startedAt: number,
  ): ItemProcessingResult {
    const fatalBeforeLog = this.fatalState;
    if (fatalBeforeLog) {
      return this.latchedFatalItemResult(fatalBeforeLog.errorCode);
    }
    const durationMs = this.durationMs(startedAt);
    const fatalDuringDuration = this.fatalState;
    if (durationMs === undefined || fatalDuringDuration) {
      return this.latchedFatalItemResult(
        fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
      );
    }
    this.safeLog(
      "error",
      "access_fulfillment_item_failed",
      this.itemMetadata(item, tokenHash, {
        errorCode: itemErrorCode,
        releaseErrorCode: release.errorCode,
        durationMs,
      }),
    );
    return {
      kind: "failed",
      releaseFailed: true,
      ...(release.kind === "fatal" ? { fatalErrorCode: release.errorCode } : {}),
    };
  }

  private logStaleLease(
    item: ClaimedItem,
    tokenHash: string,
    originStage: AccessFulfillmentStaleOriginStage,
    startedAt: number,
  ): ItemProcessingResult {
    const fatalBeforeLog = this.fatalState;
    if (fatalBeforeLog) {
      return this.latchedFatalItemResult(fatalBeforeLog.errorCode);
    }
    const durationMs = this.durationMs(startedAt);
    const fatalDuringDuration = this.fatalState;
    if (durationMs === undefined || fatalDuringDuration) {
      return this.latchedFatalItemResult(
        fatalDuringDuration?.errorCode ?? "worker_monotonic_clock_invalid",
      );
    }
    this.safeLog(
      "warn",
      "access_fulfillment_stale_lease",
      {
        orderHash: accessFulfillmentCorrelationHash(item.order_id),
        tokenHash,
        epoch: item.reconcile_lease_epoch,
        workType: item.work_type,
        originStage,
        errorCode: "stale_lease",
        durationMs,
      },
    );
    return { kind: "stale" };
  }

  private durationMs(startedAt: number): number | undefined {
    const nowMs = this.readMonotonicNow();
    if (nowMs === undefined) {
      return undefined;
    }
    const duration = nowMs - startedAt;
    if (!Number.isFinite(duration) || duration < 0) {
      this.latchFatalStop("worker_monotonic_clock_invalid");
      return undefined;
    }
    return Math.round(duration);
  }

  private readMonotonicNow(): number | undefined {
    if (this.fatalState) {
      return undefined;
    }
    try {
      const value = this.dependencies.now();
      if (
        !Number.isFinite(value) ||
        (this.lastMonotonicNowMs !== undefined &&
          value < this.lastMonotonicNowMs)
      ) {
        this.latchFatalStop("worker_monotonic_clock_invalid");
        return undefined;
      }
      this.lastMonotonicNowMs = value;
      return value;
    } catch {
      this.latchFatalStop("worker_monotonic_clock_invalid");
      return undefined;
    }
  }

  private safeLog(
    level: "info" | "warn" | "error",
    event: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (this.fatalState) {
      return;
    }
    this.writeLog(level, event, metadata);
  }

  private writeLog(
    level: "info" | "warn" | "error",
    event: string,
    metadata?: Record<string, unknown>,
  ): void {
    try {
      this.dependencies.logger[level](event, metadata);
    } catch {
      // Observability must never break fencing, item cleanup, or shutdown.
    }
  }

  private itemMetadata(
    item: ClaimedItem,
    tokenHash: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      tokenHash,
      orderHash: accessFulfillmentCorrelationHash(item.order_id),
      epoch: item.reconcile_lease_epoch,
      workType: item.work_type,
      ...extra,
    };
  }

  private summarize(
    claimedCount: number,
    outcomes: readonly ItemProcessingResult[],
  ): AccessFulfillmentCycleSummary {
    const summary = emptySummary(claimedCount);
    for (const outcome of outcomes) {
      switch (outcome.kind) {
        case "reconciled":
          summary.reconciledCount += 1;
          break;
        case "deferred":
          summary.deferredCount += 1;
          break;
        case "failed":
          summary.failedCount += 1;
          break;
        case "stale":
          summary.staleCount += 1;
          break;
        case "external_shutdown_released":
          summary.shutdownReleasedCount += 1;
          break;
        case "local_lease_budget_exhausted":
          summary.localLeaseBudgetExhaustedCount += 1;
          break;
      }
      if (outcome.releaseFailed) {
        summary.releaseFailedCount += 1;
      }
    }
    return summary;
  }
}

export function createAccessFulfillmentWorker(
  dependencies: AccessFulfillmentWorkerDependencies,
): AccessFulfillmentWorker {
  return new AccessFulfillmentWorker(dependencies);
}
