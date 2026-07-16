import { createHash } from "node:crypto";

import type { AccessFulfillmentConfig } from "../config/accessFulfillment";
import type {
  AccessFulfillmentClient,
  ClaimFulfillmentBatchResult,
  ReleaseFulfillmentLeaseResult,
} from "../services/accessFulfillment";

export const ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH = 16;

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export type AccessFulfillmentWorkerClient = Pick<
  AccessFulfillmentClient,
  "claimFulfillmentBatch" | "reconcileOrderFulfillment" | "releaseFulfillmentLease"
>;

export type AccessFulfillmentWorkerConfig = Pick<
  AccessFulfillmentConfig,
  "batchSize" | "pollIntervalMs" | "leaseSeconds" | "concurrency"
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

export interface AccessFulfillmentWorkerDependencies {
  client: AccessFulfillmentWorkerClient;
  config: AccessFulfillmentWorkerConfig;
  generateToken: () => string;
  now: () => number;
  sleep: AccessFulfillmentWorkerSleep;
  logger: AccessFulfillmentWorkerLogger;
}

export interface AccessFulfillmentCycleSummary {
  claimedCount: number;
  reconciledCount: number;
  deferredCount: number;
  failedCount: number;
  staleCount: number;
  shutdownReleasedCount: number;
  releaseFailedCount: number;
}

export type AccessFulfillmentRunOnceResult =
  | { kind: "empty"; summary: AccessFulfillmentCycleSummary }
  | { kind: "completed"; summary: AccessFulfillmentCycleSummary }
  | { kind: "shutdown"; summary: AccessFulfillmentCycleSummary }
  | {
      kind: "fatal";
      errorCode: string;
      summary: AccessFulfillmentCycleSummary;
    };

export type AccessFulfillmentRunLoopResult =
  | { kind: "stopped" }
  | { kind: "fatal"; errorCode: string };

type ClaimConclusion =
  | { kind: "success"; result: ClaimedBatch }
  | { kind: "shutdown" }
  | { kind: "fatal"; errorCode: string };

type ReleaseConclusion =
  | { kind: "released"; terminal: boolean }
  | { kind: "stale" }
  | { kind: "failed"; errorCode: string }
  | { kind: "fatal"; errorCode: "provider_outcome_required" };

type ItemOutcomeKind = "reconciled" | "deferred" | "failed" | "stale" | "shutdown_released";

interface ItemProcessingResult {
  kind: ItemOutcomeKind;
  releaseFailed?: boolean;
  fatalErrorCode?: string;
}

interface ProcessItemsResult {
  summary: AccessFulfillmentCycleSummary;
  fatalErrorCode?: string;
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
  constructor(private readonly dependencies: AccessFulfillmentWorkerDependencies) {}

  async runOnce(signal: AbortSignal): Promise<AccessFulfillmentRunOnceResult> {
    if (signal.aborted) {
      return { kind: "shutdown", summary: emptySummary() };
    }

    const reconcileLeaseToken = this.dependencies.generateToken();
    const tokenHash = accessFulfillmentCorrelationHash(reconcileLeaseToken);
    const claim = await this.claimWithRecovery(reconcileLeaseToken, tokenHash, signal);

    if (claim.kind === "shutdown") {
      return { kind: "shutdown", summary: emptySummary() };
    }

    if (claim.kind === "fatal") {
      return {
        kind: "fatal",
        errorCode: claim.errorCode,
        summary: emptySummary(),
      };
    }

    const items = claim.result.response.items;
    if (items.length === 0) {
      return { kind: "empty", summary: emptySummary() };
    }

    const processed = await this.processItems(items, reconcileLeaseToken, tokenHash, signal);
    if (processed.fatalErrorCode) {
      return {
        kind: "fatal",
        errorCode: processed.fatalErrorCode,
        summary: processed.summary,
      };
    }

    if (signal.aborted) {
      return { kind: "shutdown", summary: processed.summary };
    }

    return { kind: "completed", summary: processed.summary };
  }

  async runLoop(signal: AbortSignal): Promise<AccessFulfillmentRunLoopResult> {
    while (!signal.aborted) {
      const result = await this.runOnce(signal);
      if (result.kind === "fatal") {
        return { kind: "fatal", errorCode: result.errorCode };
      }

      if (result.kind === "shutdown") {
        return { kind: "stopped" };
      }

      if (result.kind === "empty") {
        try {
          await this.dependencies.sleep(this.dependencies.config.pollIntervalMs, signal);
        } catch {
          if (signal.aborted) {
            return { kind: "stopped" };
          }
          this.safeLog("error", "access_fulfillment_worker_stopped", {
            errorCode: "worker_poll_sleep_failed",
          });
          return { kind: "fatal", errorCode: "worker_poll_sleep_failed" };
        }
      }
    }

    return { kind: "stopped" };
  }

  private async claimWithRecovery(
    reconcileLeaseToken: string,
    tokenHash: string,
    signal: AbortSignal,
  ): Promise<ClaimConclusion> {
    const startedAt = this.safeNow();
    let retryAttempt = 0;

    while (!signal.aborted) {
      let result: ClaimFulfillmentBatchResult;
      try {
        result = await this.dependencies.client.claimFulfillmentBatch({
          reconcileLeaseToken,
          limit: this.dependencies.config.batchSize,
          leaseSeconds: this.dependencies.config.leaseSeconds,
        });
      } catch {
        result = {
          kind: "transport_error",
          rpc: "claim_access_fulfillment_batch",
          message: "Supabase RPC transport failed",
        };
      }

      if (result.kind === "success") {
        const metadata = {
          tokenHash,
          claimedCount: result.response.claimed_count,
          idempotent: result.response.idempotent,
          durationMs: this.durationMs(startedAt),
        };
        if (result.response.claimed_count === 0) {
          this.safeLog("info", "access_fulfillment_batch_empty", metadata);
        } else {
          this.safeLog("info", "access_fulfillment_batch_claimed", metadata);
        }
        return { kind: "success", result };
      }

      if (signal.aborted) {
        return { kind: "shutdown" };
      }

      if (result.kind === "malformed_response") {
        this.safeLog("error", "access_fulfillment_batch_claim_failed", {
          tokenHash,
          errorCode: "worker_claim_malformed_response",
          durationMs: this.durationMs(startedAt),
        });
        return { kind: "fatal", errorCode: "worker_claim_malformed_response" };
      }

      if (result.kind === "business_error" && result.response.retryable !== true) {
        const errorCode = safeErrorCode(
          result.response.error.code,
          "worker_claim_business_error",
        );
        this.safeLog("error", "access_fulfillment_batch_claim_failed", {
          tokenHash,
          errorCode,
          durationMs: this.durationMs(startedAt),
        });
        return { kind: "fatal", errorCode };
      }

      retryAttempt += 1;
      const delayMs = accessFulfillmentClaimRetryDelayMs(
        retryAttempt,
        this.dependencies.config,
      );
      const errorCode =
        result.kind === "business_error"
          ? safeErrorCode(result.response.error.code, "worker_claim_business_error")
          : "worker_claim_transport_error";
      this.safeLog("warn", "access_fulfillment_batch_claim_failed", {
        tokenHash,
        errorCode,
        retryAttempt,
        delayMs,
        durationMs: this.durationMs(startedAt),
      });

      try {
        await this.dependencies.sleep(delayMs, signal);
      } catch {
        if (signal.aborted) {
          return { kind: "shutdown" };
        }
        this.safeLog("error", "access_fulfillment_batch_claim_failed", {
          tokenHash,
          errorCode: "worker_claim_retry_sleep_failed",
          durationMs: this.durationMs(startedAt),
        });
        return { kind: "fatal", errorCode: "worker_claim_retry_sleep_failed" };
      }
    }

    return { kind: "shutdown" };
  }

  private async processItems(
    items: readonly ClaimedItem[],
    reconcileLeaseToken: string,
    tokenHash: string,
    signal: AbortSignal,
  ): Promise<ProcessItemsResult> {
    const started = Array.from({ length: items.length }, () => false);
    const outcomes: ItemProcessingResult[] = [];
    let nextIndex = 0;
    let fatalErrorCode: string | undefined;

    const runner = async (): Promise<void> => {
      while (!signal.aborted && !fatalErrorCode) {
        const index = nextIndex;
        if (index >= items.length) {
          return;
        }
        nextIndex += 1;
        started[index] = true;
        const item = items[index];
        if (!item) {
          continue;
        }

        let outcome: ItemProcessingResult;
        const startedAt = this.safeNow();
        try {
          outcome = await this.processItem(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
          );
        } catch {
          outcome = await this.recoverUnexpectedItem(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
          );
        }
        outcomes.push(outcome);
        if (outcome.fatalErrorCode && !fatalErrorCode) {
          fatalErrorCode = outcome.fatalErrorCode;
        }
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));

    const pendingItems = items.filter((_item, index) => !started[index]);
    if (pendingItems.length > 0) {
      const pendingOutcomes = await this.releasePendingItems(
        pendingItems,
        reconcileLeaseToken,
        tokenHash,
      );
      outcomes.push(...pendingOutcomes);
      fatalErrorCode ??= pendingOutcomes.find((outcome) => outcome.fatalErrorCode)
        ?.fatalErrorCode;
    }

    return {
      summary: this.summarize(items.length, outcomes),
      ...(fatalErrorCode ? { fatalErrorCode } : {}),
    };
  }

  private async releasePendingItems(
    items: readonly ClaimedItem[],
    reconcileLeaseToken: string,
    tokenHash: string,
  ): Promise<ItemProcessingResult[]> {
    const outcomes: ItemProcessingResult[] = [];
    let nextIndex = 0;

    const runner = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (!item) {
          continue;
        }
        outcomes.push(
          await this.releaseForShutdown(item, reconcileLeaseToken, tokenHash),
        );
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));
    return outcomes;
  }

  private async processItem(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
  ): Promise<ItemProcessingResult> {
    if (item.work_type === "email") {
      return this.deferEmail(item, reconcileLeaseToken, tokenHash, startedAt);
    }
    return this.reconcileIssuance(
      item,
      reconcileLeaseToken,
      tokenHash,
      startedAt,
    );
  }

  private async reconcileIssuance(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
  ): Promise<ItemProcessingResult> {
    let result;
    try {
      result = await this.dependencies.client.reconcileOrderFulfillment({
        orderId: item.order_id,
        paymentAttemptId: item.approved_payment_attempt_id,
        reconcileLeaseToken,
        reconcileLeaseEpoch: item.reconcile_lease_epoch,
      });
    } catch {
      return this.releaseAfterFailure(
        item,
        reconcileLeaseToken,
        tokenHash,
        "worker_reconcile_transport_error",
        startedAt,
      );
    }

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
        );
      }
      this.safeLog(
        "info",
        "access_fulfillment_item_reconciled",
        this.itemMetadata(item, tokenHash, {
          idempotent: result.response.idempotent,
          durationMs: this.durationMs(startedAt),
        }),
      );
      return { kind: "reconciled" };
    }

    if (
      result.kind === "business_error" &&
      result.response.error.code === "stale_lease"
    ) {
      this.logStaleLease(item, tokenHash, "stale_lease", startedAt);
      return { kind: "stale" };
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
    );
  }

  private async deferEmail(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
  ): Promise<ItemProcessingResult> {
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      this.dependencies.config.leaseSeconds,
      null,
    );

    if (release.kind === "released") {
      this.safeLog(
        "info",
        "access_fulfillment_item_deferred",
        this.itemMetadata(item, tokenHash, {
          terminal: release.terminal,
          durationMs: this.durationMs(startedAt),
        }),
      );
      return { kind: "deferred" };
    }

    if (release.kind === "stale") {
      this.logStaleLease(item, tokenHash, "stale_lease", startedAt);
      return { kind: "stale" };
    }

    return this.logReleaseFailure(
      item,
      tokenHash,
      release,
      "worker_email_defer_failed",
      startedAt,
    );
  }

  private async recoverUnexpectedItem(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
  ): Promise<ItemProcessingResult> {
    const recovered = await this.releaseAfterFailure(
      item,
      reconcileLeaseToken,
      tokenHash,
      "worker_item_unexpected_error",
      startedAt,
    );
    return {
      ...recovered,
      fatalErrorCode:
        recovered.fatalErrorCode ?? "worker_item_unexpected_error",
    };
  }

  private async releaseAfterFailure(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    errorCode: string,
    startedAt: number,
  ): Promise<ItemProcessingResult> {
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      this.dependencies.config.leaseSeconds,
      errorCode,
    );

    if (release.kind === "stale") {
      this.logStaleLease(item, tokenHash, errorCode, startedAt);
      return { kind: "stale" };
    }

    if (release.kind !== "released") {
      return this.logReleaseFailure(item, tokenHash, release, errorCode, startedAt);
    }

    this.safeLog(
      "warn",
      "access_fulfillment_item_failed",
      this.itemMetadata(item, tokenHash, {
        errorCode,
        leaseReleased: true,
        terminal: release.terminal,
        durationMs: this.durationMs(startedAt),
      }),
    );
    return { kind: "failed" };
  }

  private async releaseForShutdown(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
  ): Promise<ItemProcessingResult> {
    const startedAt = this.safeNow();
    const release = await this.safeRelease(item, reconcileLeaseToken, 0, null);
    if (release.kind === "released") {
      this.safeLog(
        "info",
        "access_fulfillment_item_deferred",
        this.itemMetadata(item, tokenHash, {
          shutdown: true,
          terminal: release.terminal,
          durationMs: this.durationMs(startedAt),
        }),
      );
      return { kind: "shutdown_released" };
    }

    if (release.kind === "stale") {
      this.logStaleLease(item, tokenHash, "stale_lease", startedAt);
      return { kind: "stale" };
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
  ): Promise<ReleaseConclusion> {
    let result: ReleaseFulfillmentLeaseResult;
    try {
      result = await this.dependencies.client.releaseFulfillmentLease({
        orderId: item.order_id,
        reconcileLeaseToken,
        reconcileLeaseEpoch: item.reconcile_lease_epoch,
        retryAfterSeconds,
        errorCode,
      });
    } catch {
      return { kind: "failed", errorCode: "worker_release_transport_error" };
    }

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
        return { kind: "fatal", errorCode: "provider_outcome_required" };
      }
    }

    return { kind: "failed", errorCode: releaseFailureCode(result) };
  }

  private logReleaseFailure(
    item: ClaimedItem,
    tokenHash: string,
    release: Extract<ReleaseConclusion, { kind: "failed" | "fatal" }>,
    itemErrorCode: string,
    startedAt: number,
  ): ItemProcessingResult {
    this.safeLog(
      "error",
      "access_fulfillment_item_failed",
      this.itemMetadata(item, tokenHash, {
        errorCode: itemErrorCode,
        releaseErrorCode: release.errorCode,
        durationMs: this.durationMs(startedAt),
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
    errorCode: string,
    startedAt: number,
  ): void {
    this.safeLog(
      "warn",
      "access_fulfillment_stale_lease",
      this.itemMetadata(item, tokenHash, {
        errorCode,
        durationMs: this.durationMs(startedAt),
      }),
    );
  }

  private durationMs(startedAt: number): number {
    const duration = this.safeNow() - startedAt;
    return Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0;
  }

  private safeNow(): number {
    try {
      const value = this.dependencies.now();
      return Number.isFinite(value) ? value : Number.NaN;
    } catch {
      return Number.NaN;
    }
  }

  private safeLog(
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
        case "shutdown_released":
          summary.shutdownReleasedCount += 1;
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
