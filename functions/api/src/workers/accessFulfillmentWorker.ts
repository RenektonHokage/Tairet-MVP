import { createHash } from "node:crypto";

import {
  ACCESS_FULFILLMENT_LEASE_SAFETY_MARGIN_MS,
  type AccessFulfillmentConfig,
} from "../config/accessFulfillment";
import type {
  AccessFulfillmentClient,
  AccessEmailPreclaimTerminalFailureErrorCode,
  ClaimEmailDeliveryInput,
  ClaimEmailDeliveryResult,
  ClaimFulfillmentBatchResult,
  CorrelatedEmailDeliveryProcessingResponse,
  RecordEmailDeliveryOutcomeInput,
  RecordEmailDeliveryOutcomeResult,
  RecordEmailPreclaimTerminalFailureInput,
  RecordEmailPreclaimTerminalFailureResult,
  ReleaseFulfillmentLeaseResult,
} from "../services/accessFulfillment";
import { isCorrelatedEmailDeliveryProcessingResponse } from "../services/accessFulfillment";
import {
  ACCESS_ENTRIES_EMAIL_SUBJECT,
  ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
  AccessEmailMessageError,
  calculateAccessEmailRequestPayloadHash,
  canonicalizeAccessEntriesEmailEntries,
  normalizeAccessEmailAddress,
  type AccessEmailMessage,
  type BuiltAccessEntriesEmailMessage,
} from "../services/accessEmailMessage";
import type {
  AccessEmailMessageData,
  AccessEmailMessageDataLoadResult,
  AccessEmailMessageDataReadOptions,
} from "../services/accessEmailMessageData";
import type {
  AccessEmailProvider,
  AccessEmailProviderOutcome,
} from "../services/accessEmailProvider";
import {
  createAbortDeadline,
  type AbortDeadline,
} from "../services/abortDeadline";

export const ACCESS_FULFILLMENT_CORRELATION_HASH_LENGTH = 16;

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAMED_EMAIL_FROM = /^([^<>]+)<([^<>]+)>$/;
const MAX_EMAIL_OBLIGATION_ATTEMPTS = 2;
const MIN_STAGE_WINDOW_MS = 1_000;
const MAX_EMAIL_RETRY_AFTER_SECONDS = 604_800;

export type AccessFulfillmentWorkerClient = Pick<
  AccessFulfillmentClient,
  | "claimFulfillmentBatch"
  | "reconcileOrderFulfillment"
  | "releaseFulfillmentLease"
  | "claimEmailDelivery"
  | "recordEmailDeliveryOutcome"
  | "recordEmailPreclaimTerminalFailure"
>;

export type AccessFulfillmentWorkerConfig = Pick<
  AccessFulfillmentConfig,
  | "batchSize"
  | "pollIntervalMs"
  | "leaseSeconds"
  | "concurrency"
  | "rpcTimeoutMs"
  | "durableEmailDeliveryEnabled"
  | "emailProviderTimeoutMs"
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

export interface AccessFulfillmentEmailCapability {
  load(
    orderId: string,
    options?: AccessEmailMessageDataReadOptions,
  ): Promise<AccessEmailMessageDataLoadResult>;
  build(data: AccessEmailMessageData): Promise<BuiltAccessEntriesEmailMessage>;
  provider: AccessEmailProvider;
}

interface ResolvedAccessFulfillmentEmailCapability {
  readonly load: AccessFulfillmentEmailCapability["load"];
  readonly build: AccessFulfillmentEmailCapability["build"];
  readonly send: AccessEmailProvider["send"];
}

export interface AccessFulfillmentWorkerDependencies {
  client: AccessFulfillmentWorkerClient;
  config: AccessFulfillmentWorkerConfig;
  generateToken: () => string;
  now: () => number;
  sleep: AccessFulfillmentWorkerSleep;
  logger: AccessFulfillmentWorkerLogger;
  createDeadline?: AccessFulfillmentWorkerDeadlineFactory;
  emailCapability?: AccessFulfillmentEmailCapability;
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
  emailAcceptedCount: number;
  emailRetryScheduledCount: number;
  emailAmbiguousCount: number;
  emailSkippedSentCount: number;
  emailUnsettledCount: number;
  emailManualReviewCount: number;
  emailManualReviewUnknownCount: number;
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
  | "email_settled"
  | "failed"
  | "stale"
  | "external_shutdown_released"
  | "local_lease_budget_exhausted";

export type AccessFulfillmentStaleOriginStage =
  | "issuance_reconcile"
  | "issuance_failure_release"
  | "email_defer_release"
  | "shutdown_cleanup_release"
  | "email_preclaim_retry_release"
  | "email_terminal_release"
  | "email_terminal_preclaim_recording"
  | "email_delivery_claim";

interface ItemProcessingResult {
  kind: ItemOutcomeKind;
  releaseFailed?: boolean;
  fatalErrorCode?: string;
  emailAccounting?: EmailAccounting;
}

interface EmailAccounting {
  readonly accepted?: true;
  readonly retryScheduled?: true;
  readonly ambiguous?: true;
  readonly skippedSent?: true;
  readonly unsettled?: true;
  readonly manualReview?: true;
  readonly manualReviewUnknown?: true;
}

type EmailExecutionPhase =
  | "preclaim"
  | "terminal_preclaim_recording"
  | "claim_recovery"
  | "processing_conclusive"
  | "provider_started"
  | "outcome_settlement"
  | "settled";

type EmailClaimConclusion =
  | {
      kind: "processing";
      response: Exclude<
        Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
        { status: "skipped_sent" }
      >;
      conclusiveAttemptStartedAtMs: number;
    }
  | { kind: "skipped" }
  | { kind: "manual_review" }
  | { kind: "stale" }
  | { kind: "not_started" }
  | { kind: "failed"; result: ItemProcessingResult };

type ObligationInvocationConclusion<Response> =
  | {
      kind: "result";
      result: Response;
      startedAtMs: number;
      requestStarted: true;
    }
  | { kind: "deadline_exceeded"; requestStarted: boolean }
  | { kind: "thrown"; requestStarted: boolean }
  | { kind: "budget_exhausted"; requestStarted: false };

type ProviderOutcomeTuple = Readonly<{
  outcome: "accepted" | "failed" | "ambiguous";
  providerMessageId: string | null;
  errorCode: string | null;
  retryAfterSeconds: number | null;
}>;

type OutcomeSettlementConclusion =
  | { kind: "settled"; accounting: EmailAccounting }
  | { kind: "unsettled"; accounting: EmailAccounting; errorCode: string };
type EmailLoadConclusion =
  | { kind: "success"; data: AccessEmailMessageData }
  | {
      kind: "retry";
      errorCode:
        | "order_read_failed"
        | "order_items_read_failed"
        | "entries_read_failed"
        | "source_read_failed";
    }
  | { kind: "terminal"; errorCode: AccessEmailPreclaimTerminalFailureErrorCode }
  | { kind: "failed"; result: ItemProcessingResult };

type EmailBuildConclusion =
  | { kind: "success"; built: BuiltAccessEntriesEmailMessage }
  | { kind: "retry"; errorCode: "qr_generation_failed" }
  | { kind: "terminal"; errorCode: "invalid_recipient" }
  | { kind: "failed"; result: ItemProcessingResult };



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
    emailAcceptedCount: 0,
    emailRetryScheduledCount: 0,
    emailAmbiguousCount: 0,
    emailSkippedSentCount: 0,
    emailUnsettledCount: 0,
    emailManualReviewCount: 0,
    emailManualReviewUnknownCount: 0,
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

function readExactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return null;
    }
    const expected = new Set([...requiredKeys, ...optionalKeys]);
    const names = Object.getOwnPropertyNames(value);
    if (
      names.some((name) => !expected.has(name)) ||
      requiredKeys.some((name) => !names.includes(name))
    ) {
      return null;
    }
    const copy: Record<string, unknown> = {};
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      copy[name] = descriptor.value;
    }
    return copy;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function equalStringArrays(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isValidEmailFrom(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return false;
  }
  if (!value.includes("<") && !value.includes(">")) {
    return SIMPLE_EMAIL.test(value);
  }
  const match = NAMED_EMAIL_FROM.exec(value);
  if (!match?.[1].trim()) {
    return false;
  }
  return SIMPLE_EMAIL.test(match[2].trim());
}

function isCanonicalBase64(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  );
}

function validateLoadedEmailData(
  value: unknown,
  expectedOrderId: string,
): AccessEmailMessageData | null {
  const success = readExactRecord(value, ["kind", "orderId", "data"]);
  if (
    !success ||
    success.kind !== "success" ||
    success.orderId !== expectedOrderId
  ) {
    return null;
  }
  const data = readExactRecord(success.data, [
    "buyerEmail",
    "buyerName",
    "publicRef",
    "sourceName",
    "accessDate",
    "entries",
  ]);
  if (
    !data ||
    !isNonEmptyString(data.buyerEmail) ||
    !isNonEmptyString(data.buyerName) ||
    !isNonEmptyString(data.publicRef) ||
    !isNonEmptyString(data.sourceName) ||
    !isNonEmptyString(data.accessDate) ||
    !Array.isArray(data.entries) ||
    data.entries.length === 0
  ) {
    return null;
  }

  const entryIds = new Set<string>();
  const checkinTokens = new Set<string>();
  const entries: AccessEmailMessageData["entries"][number][] = [];
  for (const valueEntry of data.entries) {
    const entry = readExactRecord(valueEntry, [
      "id",
      "orderItemId",
      "unitIndex",
      "ticketName",
      "attendeeName",
      "attendeeLastName",
      "checkinToken",
    ]);
    if (
      !entry ||
      !isCanonicalUuid(entry.id) ||
      !isCanonicalUuid(entry.orderItemId) ||
      !Number.isSafeInteger(entry.unitIndex) ||
      (entry.unitIndex as number) <= 0 ||
      !isNonEmptyString(entry.ticketName) ||
      !isNonEmptyString(entry.attendeeName) ||
      !isNonEmptyString(entry.attendeeLastName) ||
      !isCanonicalUuid(entry.checkinToken) ||
      entryIds.has(entry.id) ||
      checkinTokens.has(entry.checkinToken)
    ) {
      return null;
    }
    entryIds.add(entry.id);
    checkinTokens.add(entry.checkinToken);
    entries.push(
      Object.freeze({
        id: entry.id,
        orderItemId: entry.orderItemId,
        unitIndex: entry.unitIndex as number,
        ticketName: entry.ticketName,
        attendeeName: entry.attendeeName,
        attendeeLastName: entry.attendeeLastName,
        checkinToken: entry.checkinToken,
      }),
    );
  }

  try {
    const canonical = canonicalizeAccessEntriesEmailEntries(entries);
    if (
      canonical.length !== entries.length ||
      canonical.some((entry, index) => {
        const original = entries[index];
        return (
          !original ||
          entry.id !== original.id ||
          entry.orderItemId !== original.orderItemId ||
          entry.unitIndex !== original.unitIndex ||
          entry.ticketName !== original.ticketName ||
          entry.attendeeName !== original.attendeeName ||
          entry.attendeeLastName !== original.attendeeLastName ||
          entry.checkinToken !== original.checkinToken
        );
      })
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return Object.freeze({
    buyerEmail: data.buyerEmail,
    buyerName: data.buyerName,
    publicRef: data.publicRef,
    sourceName: data.sourceName,
    accessDate: data.accessDate,
    entries: Object.freeze(entries),
  });
}

function validateBuiltEmailMessage(
  value: unknown,
  data: AccessEmailMessageData,
): BuiltAccessEntriesEmailMessage | null {
  const built = readExactRecord(value, [
    "templateVersion",
    "entryIds",
    "message",
    "requestPayloadHash",
  ]);
  if (
    !built ||
    built.templateVersion !== ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION ||
    !Array.isArray(built.entryIds) ||
    built.entryIds.length === 0 ||
    built.entryIds.some((entryId) => !isCanonicalUuid(entryId)) ||
    new Set(built.entryIds).size !== built.entryIds.length ||
    !equalStringArrays(
      built.entryIds as string[],
      data.entries.map((entry) => entry.id),
    ) ||
    typeof built.requestPayloadHash !== "string" ||
    !LOWERCASE_SHA256.test(built.requestPayloadHash)
  ) {
    return null;
  }

  const messageRecord = readExactRecord(built.message, [
    "from",
    "to",
    "subject",
    "html",
    "attachments",
  ]);
  if (
    !messageRecord ||
    !isValidEmailFrom(messageRecord.from) ||
    !Array.isArray(messageRecord.to) ||
    messageRecord.to.length !== 1 ||
    !isNonEmptyString(messageRecord.subject) ||
    messageRecord.subject !== ACCESS_ENTRIES_EMAIL_SUBJECT ||
    !isNonEmptyString(messageRecord.html) ||
    !Array.isArray(messageRecord.attachments) ||
    messageRecord.attachments.length !== built.entryIds.length
  ) {
    return null;
  }

  let expectedRecipient: string;
  try {
    expectedRecipient = normalizeAccessEmailAddress(data.buyerEmail);
  } catch {
    return null;
  }
  if (messageRecord.to[0] !== expectedRecipient) {
    return null;
  }

  const attachments: AccessEmailMessage["attachments"][number][] = [];
  for (const [index, valueAttachment] of messageRecord.attachments.entries()) {
    const attachment = readExactRecord(valueAttachment, [
      "filename",
      "content",
      "contentType",
      "contentId",
    ]);
    if (
      !attachment ||
      attachment.filename !== "entrada-" + (index + 1) + ".png" ||
      !isCanonicalBase64(attachment.content) ||
      attachment.contentType !== "image/png" ||
      attachment.contentId !== "access-entry-qr-" + (index + 1)
    ) {
      return null;
    }
    attachments.push(
      Object.freeze({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        contentId: attachment.contentId,
      }) as AccessEmailMessage["attachments"][number],
    );
  }

  const message: AccessEmailMessage = Object.freeze({
    from: messageRecord.from,
    to: Object.freeze([expectedRecipient]),
    subject: messageRecord.subject,
    html: messageRecord.html,
    attachments: Object.freeze(attachments),
  });
  try {
    if (
      calculateAccessEmailRequestPayloadHash({
        templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
        message,
      }) !== built.requestPayloadHash
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return Object.freeze({
    templateVersion: ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
    entryIds: Object.freeze([...(built.entryIds as string[])]),
    message,
    requestPayloadHash: built.requestPayloadHash,
  });
}

function providerContractAmbiguous(): ProviderOutcomeTuple {
  return Object.freeze({
    outcome: "ambiguous",
    providerMessageId: null,
    errorCode: "worker_email_provider_contract_ambiguous",
    retryAfterSeconds: null,
  });
}

function validRetryAfterSeconds(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= MAX_EMAIL_RETRY_AFTER_SECONDS
  );
}

function validateProviderOutcome(value: unknown): ProviderOutcomeTuple | null {
  const kindDescriptor =
    typeof value === "object" && value !== null
      ? Object.getOwnPropertyDescriptor(value, "kind")
      : undefined;
  if (
    !kindDescriptor ||
    !kindDescriptor.enumerable ||
    !Object.prototype.hasOwnProperty.call(kindDescriptor, "value")
  ) {
    return null;
  }
  const kind = kindDescriptor.value;
  if (kind === "accepted") {
    const accepted = readExactRecord(value, ["kind", "providerMessageId"]);
    if (
      !accepted ||
      !isNonEmptyString(accepted.providerMessageId) ||
      accepted.providerMessageId.trim() !== accepted.providerMessageId
    ) {
      return null;
    }
    return Object.freeze({
      outcome: "accepted",
      providerMessageId: accepted.providerMessageId,
      errorCode: null,
      retryAfterSeconds: null,
    });
  }
  if (kind === "failed_terminal") {
    const failed = readExactRecord(value, ["kind", "errorCode"]);
    if (
      !failed ||
      typeof failed.errorCode !== "string" ||
      !SAFE_ERROR_CODE.test(failed.errorCode)
    ) {
      return null;
    }
    return Object.freeze({
      outcome: "failed",
      providerMessageId: null,
      errorCode: failed.errorCode,
      retryAfterSeconds: null,
    });
  }
  if (kind === "failed_retryable" || kind === "ambiguous") {
    const providerResult = readExactRecord(
      value,
      ["kind", "errorCode"],
      ["retryAfterSeconds"],
    );
    if (
      !providerResult ||
      typeof providerResult.errorCode !== "string" ||
      !SAFE_ERROR_CODE.test(providerResult.errorCode) ||
      ("retryAfterSeconds" in providerResult &&
        !validRetryAfterSeconds(providerResult.retryAfterSeconds))
    ) {
      return null;
    }
    const retryAfterSeconds =
      "retryAfterSeconds" in providerResult
        ? (providerResult.retryAfterSeconds as number)
        : kind === "failed_retryable"
          ? 60
          : null;
    return Object.freeze({
      outcome: kind === "ambiguous" ? "ambiguous" : "failed",
      providerMessageId: null,
      errorCode: providerResult.errorCode,
      retryAfterSeconds,
    });
  }
  return null;
}

export class AccessFulfillmentWorker {
  private lastMonotonicNowMs: number | undefined;
  private fatalState: AccessFulfillmentFatalState | null = null;
  private readonly fatalAbortController = new AbortController();
  private readonly dependencies: AccessFulfillmentWorkerDependencies;
  private readonly emailCapability: ResolvedAccessFulfillmentEmailCapability | null;

  constructor(dependencies: AccessFulfillmentWorkerDependencies) {
    this.dependencies = dependencies;
    this.emailCapability = this.captureEmailCapability();
    if (dependencies.config.durableEmailDeliveryEnabled && !this.emailCapability) {
      this.latchFatalStop("worker_email_capability_invalid");
    }
  }

  private captureEmailCapability(): ResolvedAccessFulfillmentEmailCapability | null {
    if (!this.dependencies.config.durableEmailDeliveryEnabled) {
      return null;
    }
    try {
      const capability = this.dependencies.emailCapability;
      if (typeof capability !== "object" || capability === null) {
        return null;
      }
      const load = capability.load;
      const build = capability.build;
      const provider = capability.provider;
      if (
        typeof load !== "function" ||
        typeof build !== "function" ||
        typeof provider !== "object" ||
        provider === null
      ) {
        return null;
      }
      const send = provider.send;
      if (typeof send !== "function") {
        return null;
      }
      return Object.freeze({
        load: Function.prototype.bind.call(load, capability),
        build: Function.prototype.bind.call(build, capability),
        send: Function.prototype.bind.call(send, provider),
      }) as ResolvedAccessFulfillmentEmailCapability;
    } catch {
      return null;
    }
  }

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
    const outcomes: Array<ItemProcessingResult | undefined> = Array.from({
      length: items.length,
    });
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
          outcomes[index] = this.latchedFatalItemResult(
            "worker_monotonic_clock_invalid",
          );
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
          const fatal = this.latchFatalStop("worker_item_unexpected_error");
          outcomes[index] = this.latchedFatalItemResult(fatal.errorCode);
          return;
        }
        outcomes[index] = outcome;
        if (this.fatalState) {
          return;
        }
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));

    const fatalAfterRunners = this.fatalState;
    if (fatalAfterRunners) {
      const summary = this.summarize(items.length, outcomes);
      return {
        summary,
        fatalErrorCode: fatalAfterRunners.errorCode,
      };
    }

    const pendingItems = items.flatMap((item, index) =>
      started[index] ? [] : [{ index, item }],
    );
    if (pendingItems.length > 0) {
      const pendingOutcomes = await this.releasePendingItems(
        pendingItems,
        reconcileLeaseToken,
        tokenHash,
        conservativeLocalLeaseDeadlineMs,
      );
      for (const pending of pendingOutcomes) {
        outcomes[pending.index] = pending.outcome;
      }
      const fatalAfterPendingCleanup = this.fatalState;
      if (fatalAfterPendingCleanup) {
        return {
          summary: this.summarize(items.length, outcomes),
          fatalErrorCode: fatalAfterPendingCleanup.errorCode,
        };
      }
    }

    const fatalAfterCleanup = this.fatalState;
    if (fatalAfterCleanup) {
      return {
        summary: this.summarize(items.length, outcomes),
        fatalErrorCode: fatalAfterCleanup.errorCode,
      };
    }

    return {
      summary: this.summarize(items.length, outcomes),
    };
  }

  private async releasePendingItems(
    items: readonly { readonly index: number; readonly item: ClaimedItem }[],
    reconcileLeaseToken: string,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
  ): Promise<
    Array<{ readonly index: number; readonly outcome: ItemProcessingResult }>
  > {
    const outcomes: Array<
      { readonly index: number; readonly outcome: ItemProcessingResult } | undefined
    > = Array.from({ length: items.length });
    let nextIndex = 0;

    const runner = async (): Promise<void> => {
      while (!this.fatalState && nextIndex < items.length) {
        if (this.fatalState) {
          return;
        }
        const index = nextIndex;
        nextIndex += 1;
        const pending = items[index];
        if (!pending) {
          continue;
        }
        const outcome = await this.releaseForExternalShutdown(
          pending.item,
          reconcileLeaseToken,
          tokenHash,
          conservativeLocalLeaseDeadlineMs,
        );
        outcomes[index] = { index: pending.index, outcome };
        if (this.fatalState) {
          return;
        }
      }
    };

    const runnerCount = Math.min(this.dependencies.config.concurrency, items.length);
    await Promise.all(Array.from({ length: runnerCount }, () => runner()));
    return outcomes.filter(
      (
        value,
      ): value is { readonly index: number; readonly outcome: ItemProcessingResult } =>
        value !== undefined,
    );
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
      if (this.dependencies.config.durableEmailDeliveryEnabled) {
        const capability = this.emailCapability;
        if (!capability) {
          return this.latchedFatalItemResult(
            "worker_email_capability_invalid",
          );
        }
        return this.processDurableEmail(
          item,
          reconcileLeaseToken,
          tokenHash,
          startedAt,
          conservativeLocalLeaseDeadlineMs,
          signal,
          capability,
        );
      }
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

  private async processDurableEmail(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
    capability: ResolvedAccessFulfillmentEmailCapability,
  ): Promise<ItemProcessingResult> {
    let phase: EmailExecutionPhase = "preclaim";
    const claimDeadlineMs =
      conservativeLocalLeaseDeadlineMs - this.dependencies.config.rpcTimeoutMs;

    const loaded = await this.loadEmailPreclaim(
      item,
      reconcileLeaseToken,
      tokenHash,
      startedAt,
      conservativeLocalLeaseDeadlineMs,
      claimDeadlineMs,
      signal,
      capability,
    );
    if (loaded.kind === "failed") {
      return loaded.result;
    }
    if (loaded.kind === "retry") {
      return this.releaseEmailPreclaimRetry(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        loaded.errorCode,
      );
    }
    if (loaded.kind === "terminal") {
      phase = "terminal_preclaim_recording";
      return this.recordEmailPreclaimTerminalWithRecovery(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        loaded.errorCode,
        phase,
      );
    }

    const built = await this.buildEmailPreclaim(
      item,
      reconcileLeaseToken,
      tokenHash,
      startedAt,
      conservativeLocalLeaseDeadlineMs,
      claimDeadlineMs,
      signal,
      capability,
      loaded.data,
    );
    if (built.kind === "failed") {
      return built.result;
    }
    if (built.kind === "retry") {
      return this.releaseEmailPreclaimRetry(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        built.errorCode,
      );
    }
    if (built.kind === "terminal") {
      phase = "terminal_preclaim_recording";
      return this.recordEmailPreclaimTerminalWithRecovery(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        built.errorCode,
        phase,
      );
    }

    const fatalBeforeClaim = this.fatalState;
    if (fatalBeforeClaim) {
      return this.latchedFatalItemResult(fatalBeforeClaim.errorCode);
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

    phase = "claim_recovery";
    const claim = await this.claimEmailDeliveryWithRecovery(
      item,
      reconcileLeaseToken,
      tokenHash,
      startedAt,
      conservativeLocalLeaseDeadlineMs,
      claimDeadlineMs,
      signal,
      built.built,
      phase,
    );
    if (claim.kind === "failed") {
      return claim.result;
    }
    if (claim.kind === "stale") {
      return this.emailObligationStale(
        item,
        tokenHash,
        "email_delivery_claim",
      );
    }
    if (claim.kind === "not_started") {
      return this.releaseEmailPreclaimRetry(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        null,
      );
    }
    if (claim.kind === "skipped") {
      return this.emailSettled({ skippedSent: true });
    }
    if (claim.kind === "manual_review") {
      return this.emailSettled({ manualReview: true });
    }

    const processing = claim.response;
    if (!isCorrelatedEmailDeliveryProcessingResponse(processing)) {
      return this.settleLegacyEmailProcessing(
        item,
        reconcileLeaseToken,
        tokenHash,
        conservativeLocalLeaseDeadlineMs,
        processing,
      );
    }

    phase = "processing_conclusive";
    this.safeLog(
      "info",
      "access_fulfillment_email_claimed",
      this.emailMetadata(item, tokenHash, phase, {
        attemptHash: accessFulfillmentCorrelationHash(
          processing.delivery_attempt_id,
        ),
        idempotent: processing.idempotent,
        entryCount: processing.entry_count,
      }),
    );

    const providerTuple = await this.invokeEmailProviderOnce(
      item,
      tokenHash,
      conservativeLocalLeaseDeadlineMs,
      claim.conclusiveAttemptStartedAtMs,
      processing,
      built.built,
      signal,
      capability,
    );
    phase = "outcome_settlement";
    const frozenOutcomeRequest: Readonly<RecordEmailDeliveryOutcomeInput> =
      Object.freeze({
        orderId: item.order_id,
        deliveryAttemptId: processing.delivery_attempt_id,
        reconcileLeaseToken,
        reconcileLeaseEpoch: item.reconcile_lease_epoch,
        outcome: providerTuple.outcome,
        providerMessageId: providerTuple.providerMessageId,
        errorCode: providerTuple.errorCode,
        retryAfterSeconds: providerTuple.retryAfterSeconds,
      });
    const settlement = await this.settleEmailOutcomeWithRecovery(
      item,
      tokenHash,
      conservativeLocalLeaseDeadlineMs,
      frozenOutcomeRequest,
      phase,
    );
    if (settlement.kind === "unsettled") {
      return {
        kind: "failed",
        fatalErrorCode: settlement.errorCode,
        emailAccounting: settlement.accounting,
      };
    }

    phase = "settled";
    this.safeLog(
      "info",
      "access_fulfillment_email_outcome_settled",
      this.emailMetadata(item, tokenHash, phase, {
        attemptHash: accessFulfillmentCorrelationHash(
          processing.delivery_attempt_id,
        ),
        outcome: providerTuple.outcome,
      }),
    );
    return this.emailSettled(settlement.accounting);
  }

  private async loadEmailPreclaim(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    claimDeadlineMs: number,
    signal: AbortSignal,
    capability: ResolvedAccessFulfillmentEmailCapability,
  ): Promise<EmailLoadConclusion> {
    const timeoutMs = this.emailPreclaimTimeoutMs(claimDeadlineMs);
    if (timeoutMs === undefined) {
      return {
        kind: "failed",
        result: this.latchedFatalItemResult(
          this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
        ),
      };
    }
    if (timeoutMs <= 0) {
      return {
        kind: "failed",
        result: await this.releaseEmailPreclaimRetry(
          item,
          reconcileLeaseToken,
          tokenHash,
          startedAt,
          conservativeLocalLeaseDeadlineMs,
          signal,
          null,
        ),
      };
    }

    const invocation = await this.invokeWithDeadline(
      timeoutMs,
      signal,
      (requestSignal) =>
        capability.load(item.order_id, Object.freeze({ signal: requestSignal })),
    );
    if (invocation.kind === "fatal_abort") {
      return {
        kind: "failed",
        result: this.latchedFatalItemResult(invocation.errorCode),
      };
    }
    if (invocation.kind === "external_abort") {
      return {
        kind: "failed",
        result: await this.releaseForExternalShutdown(
          item,
          reconcileLeaseToken,
          tokenHash,
          conservativeLocalLeaseDeadlineMs,
          startedAt,
        ),
      };
    }
    if (
      invocation.kind === "deadline_exceeded" ||
      invocation.kind === "thrown"
    ) {
      return {
        kind: "failed",
        result: this.emailFatal("worker_email_loader_contract_invalid"),
      };
    }

    let data: AccessEmailMessageData | null = null;
    try {
      data = validateLoadedEmailData(
        invocation.result as unknown,
        item.order_id,
      );
    } catch {
      data = null;
    }
    if (data) {
      return { kind: "success", data };
    }

    const result = readExactRecord(invocation.result as unknown, [
      "kind",
      "errorCode",
    ]);
    if (!result || typeof result.errorCode !== "string") {
      return {
        kind: "failed",
        result: this.emailFatal("worker_email_loader_contract_invalid"),
      };
    }

    if (result.kind === "retryable_error") {
      switch (result.errorCode) {
        case "order_read_failed":
        case "order_items_read_failed":
        case "entries_read_failed":
        case "source_read_failed":
          return { kind: "retry", errorCode: result.errorCode };
        default:
          return {
            kind: "failed",
            result: this.emailFatal("worker_email_loader_contract_invalid"),
          };
      }
    }
    if (result.kind === "terminal_error") {
      switch (result.errorCode) {
        case "order_invalid":
        case "order_items_invalid":
        case "entries_not_found":
        case "entries_invalid":
        case "entry_count_mismatch":
        case "entry_not_deliverable":
        case "source_invalid":
          return { kind: "terminal", errorCode: result.errorCode };
        case "order_not_found":
        case "order_not_paid":
          return {
            kind: "failed",
            result: this.emailFatal(result.errorCode),
          };
        default:
          return {
            kind: "failed",
            result: this.emailFatal("worker_email_loader_contract_invalid"),
          };
      }
    }
    if (
      result.kind === "aborted" &&
      result.errorCode === "email_message_data_load_aborted"
    ) {
      if (this.fatalState) {
        return {
          kind: "failed",
          result: this.latchedFatalItemResult(this.fatalState.errorCode),
        };
      }
      if (signal.aborted) {
        return {
          kind: "failed",
          result: await this.releaseForExternalShutdown(
            item,
            reconcileLeaseToken,
            tokenHash,
            conservativeLocalLeaseDeadlineMs,
            startedAt,
          ),
        };
      }
    }
    return {
      kind: "failed",
      result: this.emailFatal("worker_email_loader_contract_invalid"),
    };
  }

  private async buildEmailPreclaim(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    claimDeadlineMs: number,
    signal: AbortSignal,
    capability: ResolvedAccessFulfillmentEmailCapability,
    data: AccessEmailMessageData,
  ): Promise<EmailBuildConclusion> {
    const timeoutMs = this.emailPreclaimTimeoutMs(claimDeadlineMs);
    if (timeoutMs === undefined) {
      return {
        kind: "failed",
        result: this.latchedFatalItemResult(
          this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
        ),
      };
    }
    if (timeoutMs <= 0) {
      return {
        kind: "failed",
        result: await this.releaseEmailPreclaimRetry(
          item,
          reconcileLeaseToken,
          tokenHash,
          startedAt,
          conservativeLocalLeaseDeadlineMs,
          signal,
          null,
        ),
      };
    }

    const invocation = await this.invokeWithDeadline(
      timeoutMs,
      signal,
      async () => {
        try {
          return {
            kind: "success" as const,
            value: await capability.build(data),
          };
        } catch (error) {
          return error instanceof AccessEmailMessageError
            ? { kind: "error" as const, errorCode: error.code }
            : { kind: "thrown" as const };
        }
      },
    );
    if (invocation.kind === "fatal_abort") {
      return {
        kind: "failed",
        result: this.latchedFatalItemResult(invocation.errorCode),
      };
    }
    if (invocation.kind === "external_abort") {
      return {
        kind: "failed",
        result: await this.releaseForExternalShutdown(
          item,
          reconcileLeaseToken,
          tokenHash,
          conservativeLocalLeaseDeadlineMs,
          startedAt,
        ),
      };
    }
    if (
      invocation.kind === "deadline_exceeded" ||
      invocation.kind === "thrown"
    ) {
      return {
        kind: "failed",
        result: this.emailFatal("worker_email_builder_contract_invalid"),
      };
    }

    if (invocation.result.kind === "success") {
      let built: BuiltAccessEntriesEmailMessage | null = null;
      try {
        built = validateBuiltEmailMessage(invocation.result.value, data);
      } catch {
        built = null;
      }
      return built
        ? { kind: "success", built }
        : {
            kind: "failed",
            result: this.emailFatal("worker_email_builder_contract_invalid"),
          };
    }
    if (invocation.result.kind === "error") {
      switch (invocation.result.errorCode) {
        case "qr_generation_failed":
          return { kind: "retry", errorCode: "qr_generation_failed" };
        case "invalid_recipient":
          return { kind: "terminal", errorCode: "invalid_recipient" };
        case "invalid_from":
        case "duplicate_entry_id":
        case "invalid_entry":
        case "invalid_access_date":
        case "invalid_template_version":
          return {
            kind: "failed",
            result: this.emailFatal(invocation.result.errorCode),
          };
      }
    }
    return {
      kind: "failed",
      result: this.emailFatal("worker_email_builder_contract_invalid"),
    };
  }

  private emailPreclaimTimeoutMs(parentDeadlineMs: number): number | undefined {
    const nowMs = this.readMonotonicNow();
    if (nowMs === undefined) {
      return undefined;
    }
    const remainingMs = parentDeadlineMs - nowMs;
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return 0;
    }
    return Math.min(this.dependencies.config.rpcTimeoutMs, remainingMs);
  }

  private async releaseEmailPreclaimRetry(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
    errorCode: string | null,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeRelease = this.fatalState;
    if (fatalBeforeRelease) {
      return this.latchedFatalItemResult(fatalBeforeRelease.errorCode);
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
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      this.dependencies.config.leaseSeconds,
      errorCode,
      conservativeLocalLeaseDeadlineMs,
    );
    if (release.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(startedAt, release.observedAtMs);
    }
    if (release.kind === "fatal") {
      return this.latchedFatalItemResult(release.errorCode);
    }
    if (release.kind === "stale") {
      return this.logStaleLease(
        item,
        tokenHash,
        "email_preclaim_retry_release",
        startedAt,
      );
    }
    if (release.kind === "failed") {
      return this.logReleaseFailure(
        item,
        tokenHash,
        release,
        errorCode ?? "worker_email_claim_recovery_exhausted",
        startedAt,
      );
    }

    const durationMs = this.durationMs(startedAt);
    if (durationMs === undefined) {
      return this.latchedFatalItemResult(
        this.fatalState?.errorCode ?? "worker_monotonic_clock_invalid",
      );
    }
    this.safeLog(
      "warn",
      "access_fulfillment_email_preclaim_retry_scheduled",
      this.emailMetadata(item, tokenHash, "preclaim", {
        ...(errorCode === null ? {} : { errorCode }),
        durationMs,
      }),
    );
    return this.emailSettled({ retryScheduled: true });
  }

  private async releaseEmailTerminalConclusion(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    accounting: EmailAccounting,
  ): Promise<ItemProcessingResult> {
    const release = await this.safeRelease(
      item,
      reconcileLeaseToken,
      0,
      null,
      conservativeLocalLeaseDeadlineMs,
    );
    if (release.kind === "local_lease_budget_exhausted") {
      return this.localLeaseBudgetExhausted(startedAt, release.observedAtMs);
    }
    if (release.kind === "fatal") {
      return this.latchedFatalItemResult(release.errorCode);
    }
    if (release.kind === "stale") {
      return this.logStaleLease(
        item,
        tokenHash,
        "email_terminal_release",
        startedAt,
      );
    }
    if (release.kind === "failed") {
      return this.logReleaseFailure(
        item,
        tokenHash,
        release,
        "worker_release_failed",
        startedAt,
      );
    }
    if (accounting.skippedSent) {
      this.safeLog(
        "info",
        "access_fulfillment_email_skipped_sent",
        this.emailMetadata(item, tokenHash, "settled"),
      );
    }
    return this.emailSettled(accounting);
  }

  private emailSettled(accounting: EmailAccounting): ItemProcessingResult {
    return {
      kind: "email_settled",
      emailAccounting: Object.freeze({ ...accounting }),
    };
  }

  private emailFatal(
    errorCode: string,
    accounting?: EmailAccounting,
  ): ItemProcessingResult {
    const fatal = this.latchFatalStop(errorCode);
    return {
      kind: "failed",
      fatalErrorCode: fatal.errorCode,
      ...(accounting
        ? { emailAccounting: Object.freeze({ ...accounting }) }
        : {}),
    };
  }

  private emailUnsettled(
    item: ClaimedItem,
    tokenHash: string,
    phase: EmailExecutionPhase,
    errorCode: string,
  ): ItemProcessingResult {
    this.safeLog(
      "error",
      "access_fulfillment_email_unsettled",
      this.emailMetadata(item, tokenHash, phase, { errorCode }),
    );
    return this.emailFatal(errorCode, { unsettled: true });
  }


  private async recordEmailPreclaimTerminalWithRecovery(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    signal: AbortSignal,
    errorCode: AccessEmailPreclaimTerminalFailureErrorCode,
    phase: EmailExecutionPhase,
  ): Promise<ItemProcessingResult> {
    const fatalBeforeMutation = this.fatalState;
    if (fatalBeforeMutation) {
      return this.latchedFatalItemResult(fatalBeforeMutation.errorCode);
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

    const request: Readonly<RecordEmailPreclaimTerminalFailureInput> =
      Object.freeze({
        orderId: item.order_id,
        reconcileLeaseToken,
        reconcileLeaseEpoch: item.reconcile_lease_epoch,
        emailGeneration: item.email_generation,
        errorCode,
      });
    let requestStarted = false;

    for (
      let attempt = 0;
      attempt < MAX_EMAIL_OBLIGATION_ATTEMPTS;
      attempt += 1
    ) {
      if (!requestStarted) {
        const fatalBeforeAttempt = this.fatalState;
        if (fatalBeforeAttempt) {
          return this.latchedFatalItemResult(fatalBeforeAttempt.errorCode);
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
      }

      const invocation =
        await this.invokeEmailObligationAttempt<RecordEmailPreclaimTerminalFailureResult>(
          conservativeLocalLeaseDeadlineMs,
          attempt,
          (requestSignal) =>
            this.dependencies.client.recordEmailPreclaimTerminalFailure(
              request,
              { signal: requestSignal },
            ),
        );
      requestStarted ||= invocation.kind !== "budget_exhausted" &&
        invocation.requestStarted !== false;

      if (invocation.kind === "budget_exhausted") {
        if (!requestStarted) {
          return this.releaseEmailPreclaimRetry(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
            conservativeLocalLeaseDeadlineMs,
            signal,
            errorCode,
          );
        }
        break;
      }
      if (
        invocation.kind === "deadline_exceeded" ||
        invocation.kind === "thrown"
      ) {
        continue;
      }

      const result = invocation.result;
      if (result.kind === "transport_error") {
        continue;
      }
      if (result.kind === "success") {
        if (
          result.response.order_id === item.order_id &&
          result.response.generation === item.email_generation &&
          result.response.epoch === item.reconcile_lease_epoch &&
          result.response.error_code === errorCode &&
          result.response.status === "manual_review" &&
          result.response.terminal === true &&
          typeof result.response.idempotent === "boolean"
        ) {
          this.safeLog(
            "info",
            "access_fulfillment_email_terminal_recorded",
            this.emailMetadata(item, tokenHash, phase, {
              errorCode,
              idempotent: result.response.idempotent,
              manualReview: true,
            }),
          );
          return this.emailSettled({ manualReview: true });
        }
        continue;
      }
      if (result.kind === "business_error") {
        const code = result.response.error.code;
        if (code === "concurrency_conflict") {
          continue;
        }
        if (
          "order_id" in result.response &&
          result.response.order_id !== undefined &&
          result.response.order_id !== item.order_id
        ) {
          continue;
        }
        switch (code) {
          case "stale_lease":
          case "generation_mismatch":
            return this.emailObligationStale(
              item,
              tokenHash,
              "email_terminal_preclaim_recording",
            );
          case "email_already_sent":
            return this.releaseEmailTerminalConclusion(
              item,
              reconcileLeaseToken,
              tokenHash,
              startedAt,
              conservativeLocalLeaseDeadlineMs,
              { skippedSent: true },
            );
          case "provider_outcome_required":
          case "delivery_state_conflict":
            return this.emailUnsettled(item, tokenHash, phase, code);
          case "invalid_request":
          case "invalid_error_code":
          case "order_not_found":
          case "fulfillment_not_found":
          case "internal_error":
            return this.emailFatal(code);
        }
      }
    }

    if (!requestStarted) {
      return this.releaseEmailPreclaimRetry(
        item,
        reconcileLeaseToken,
        tokenHash,
        startedAt,
        conservativeLocalLeaseDeadlineMs,
        signal,
        errorCode,
      );
    }

    return this.emailUnsettled(
      item,
      tokenHash,
      phase,
      "worker_email_terminal_preclaim_recovery_exhausted",
    );
  }

  private async claimEmailDeliveryWithRecovery(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    startedAt: number,
    conservativeLocalLeaseDeadlineMs: number,
    claimDeadlineMs: number,
    signal: AbortSignal,
    built: BuiltAccessEntriesEmailMessage,
    phase: EmailExecutionPhase,
  ): Promise<EmailClaimConclusion> {
    const fatalBeforeMutation = this.fatalState;
    if (fatalBeforeMutation) {
      return {
        kind: "failed",
        result: this.latchedFatalItemResult(fatalBeforeMutation.errorCode),
      };
    }
    if (signal.aborted) {
      return {
        kind: "failed",
        result: await this.releaseForExternalShutdown(
          item,
          reconcileLeaseToken,
          tokenHash,
          conservativeLocalLeaseDeadlineMs,
          startedAt,
        ),
      };
    }

    const request: Readonly<ClaimEmailDeliveryInput> = Object.freeze({
      orderId: item.order_id,
      reconcileLeaseToken,
      reconcileLeaseEpoch: item.reconcile_lease_epoch,
      entryIds: Object.freeze([...built.entryIds]),
      requestPayloadHash: built.requestPayloadHash,
      templateVersion: built.templateVersion,
      provider: "resend",
    });
    let requestStarted = false;

    for (
      let attempt = 0;
      attempt < MAX_EMAIL_OBLIGATION_ATTEMPTS;
      attempt += 1
    ) {
      if (!requestStarted) {
        const fatalBeforeAttempt = this.fatalState;
        if (fatalBeforeAttempt) {
          return {
            kind: "failed",
            result: this.latchedFatalItemResult(fatalBeforeAttempt.errorCode),
          };
        }
        if (signal.aborted) {
          return {
            kind: "failed",
            result: await this.releaseForExternalShutdown(
              item,
              reconcileLeaseToken,
              tokenHash,
              conservativeLocalLeaseDeadlineMs,
              startedAt,
            ),
          };
        }
      }

      const invocation =
        await this.invokeEmailObligationAttempt<ClaimEmailDeliveryResult>(
          claimDeadlineMs,
          attempt,
          (requestSignal) =>
            this.dependencies.client.claimEmailDelivery(request, {
              signal: requestSignal,
            }),
        );
      requestStarted ||= invocation.kind !== "budget_exhausted" &&
        invocation.requestStarted !== false;

      if (invocation.kind === "budget_exhausted") {
        if (!requestStarted) {
          return { kind: "not_started" };
        }
        break;
      }
      if (
        invocation.kind === "deadline_exceeded" ||
        invocation.kind === "thrown"
      ) {
        continue;
      }

      const result = invocation.result;
      if (result.kind === "transport_error") {
        continue;
      }
      if (result.kind === "malformed_response" || result.kind === "unknown_status") {
        return {
          kind: "failed",
          result: this.emailUnsettled(
            item,
            tokenHash,
            phase,
            "worker_email_claim_correlation_mismatch",
          ),
        };
      }
      if (result.kind === "success") {
        if (result.response.status === "skipped_sent") {
          if (
            result.response.order_id !== item.order_id ||
            result.response.generation !== item.email_generation ||
            result.response.epoch !== item.reconcile_lease_epoch
          ) {
            return {
              kind: "failed",
              result: this.emailUnsettled(
                item,
                tokenHash,
                phase,
                "worker_email_claim_correlation_mismatch",
              ),
            };
          }
          const released = await this.releaseEmailTerminalConclusion(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
            conservativeLocalLeaseDeadlineMs,
            { skippedSent: true },
          );
          return released.emailAccounting?.skippedSent
            ? { kind: "skipped" }
            : { kind: "failed", result: released };
        }

        const correlated = isCorrelatedEmailDeliveryProcessingResponse(
          result.response,
        )
          ? this.validateCorrelatedEmailProcessing(
              result.response,
              item,
              built,
            )
          : null;
        if (correlated) {
          return {
            kind: "processing",
            response: correlated,
            conclusiveAttemptStartedAtMs: invocation.startedAtMs,
          };
        }
        if (!isCorrelatedEmailDeliveryProcessingResponse(result.response)) {
          const legacy = this.validateLegacyEmailProcessing(
            result.response,
            item,
            built,
          );
          if (legacy) {
            return {
              kind: "processing",
              response: legacy,
              conclusiveAttemptStartedAtMs: invocation.startedAtMs,
            };
          }
        }
        return {
          kind: "failed",
          result: this.emailUnsettled(
            item,
            tokenHash,
            phase,
            "worker_email_claim_correlation_mismatch",
          ),
        };
      }

      const code = result.response.error.code;
      if (code === "concurrency_conflict") {
        continue;
      }
      if (
        result.response.order_id !== undefined &&
        result.response.order_id !== item.order_id
      ) {
        return {
          kind: "failed",
          result: this.emailUnsettled(
            item,
            tokenHash,
            phase,
            "worker_email_claim_correlation_mismatch",
          ),
        };
      }
      switch (code) {
        case "stale_lease":
          return { kind: "stale" };
        case "ambiguous_idempotency_window_expired":
        case "delivery_payload_drift":
        case "delivery_state_conflict":
          return { kind: "manual_review" };
        case "email_manual_review": {
          const released = await this.releaseEmailTerminalConclusion(
            item,
            reconcileLeaseToken,
            tokenHash,
            startedAt,
            conservativeLocalLeaseDeadlineMs,
            { manualReview: true },
          );
          return released.emailAccounting?.manualReview
            ? { kind: "manual_review" }
            : { kind: "failed", result: released };
        }
        case "invalid_request":
        case "invalid_provider":
        case "order_not_found":
        case "fulfillment_not_found":
          return {
            kind: "failed",
            result: this.emailFatal(code),
          };
        case "issuance_manual_review":
        case "issuance_not_complete":
        case "multiple_approved_payment_attempts":
        case "fulfillment_attempt_mismatch":
        case "unsupported_approved_provider":
        case "order_not_paid":
        case "internal_error":
          return {
            kind: "failed",
            result: this.emailUnsettled(item, tokenHash, phase, code),
          };
        default:
          return {
            kind: "failed",
            result: this.emailUnsettled(
              item,
              tokenHash,
              phase,
              "worker_email_claim_recovery_exhausted",
            ),
          };
      }
    }
    if (!requestStarted) {
      return { kind: "not_started" };
    }

    return {
      kind: "failed",
      result: this.emailUnsettled(
        item,
        tokenHash,
        phase,
        "worker_email_claim_recovery_exhausted",
      ),
    };
  }

  private validateCorrelatedEmailProcessing(
    response: CorrelatedEmailDeliveryProcessingResponse,
    item: ClaimedItem,
    built: BuiltAccessEntriesEmailMessage,
  ): CorrelatedEmailDeliveryProcessingResponse | null {
    if (
      !isCorrelatedEmailDeliveryProcessingResponse(response) ||
      response.order_id !== item.order_id ||
      response.generation !== item.email_generation ||
      response.epoch !== item.reconcile_lease_epoch ||
      response.provider !== "resend" ||
      !isCanonicalUuid(response.delivery_attempt_id) ||
      response.idempotency_key !==
        "access-email-delivery/" + response.delivery_attempt_id ||
      !equalStringArrays(response.entry_ids, built.entryIds) ||
      new Set(response.entry_ids).size !== response.entry_ids.length ||
      response.entry_count !== built.entryIds.length ||
      response.request_payload_hash !== built.requestPayloadHash ||
      response.template_version !== built.templateVersion ||
      !LOWERCASE_SHA256.test(response.entry_snapshot_hash) ||
      !Number.isSafeInteger(response.idempotency_remaining_ms) ||
      response.idempotency_remaining_ms < 0
    ) {
      return null;
    }
    const entryIds = [...response.entry_ids];
    Object.freeze(entryIds);
    return Object.freeze({
      ...response,
      entry_ids: entryIds,
    });
  }

  private validateLegacyEmailProcessing(
    value: unknown,
    item: ClaimedItem,
    built: BuiltAccessEntriesEmailMessage,
  ): Exclude<
    Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
    CorrelatedEmailDeliveryProcessingResponse | { status: "skipped_sent" }
  > | null {
    const response = readExactRecord(value, [
      "ok",
      "status",
      "order_id",
      "delivery_attempt_id",
      "generation",
      "provider",
      "idempotency_key",
      "entry_ids",
      "entry_snapshot_hash",
      "template_version",
      "epoch",
      "idempotent",
    ]);
    if (
      !response ||
      response.ok !== true ||
      response.status !== "processing" ||
      response.order_id !== item.order_id ||
      response.generation !== item.email_generation ||
      response.epoch !== item.reconcile_lease_epoch ||
      response.provider !== "resend" ||
      !isCanonicalUuid(response.delivery_attempt_id) ||
      response.idempotency_key !==
        "access-email-delivery/" + response.delivery_attempt_id ||
      !Array.isArray(response.entry_ids) ||
      response.entry_ids.some((entryId) => !isCanonicalUuid(entryId)) ||
      !equalStringArrays(response.entry_ids as string[], built.entryIds) ||
      new Set(response.entry_ids).size !== response.entry_ids.length ||
      typeof response.entry_snapshot_hash !== "string" ||
      !LOWERCASE_SHA256.test(response.entry_snapshot_hash) ||
      response.template_version !== built.templateVersion ||
      typeof response.idempotent !== "boolean"
    ) {
      return null;
    }
    return Object.freeze({
      ok: true,
      status: "processing",
      order_id: response.order_id,
      delivery_attempt_id: response.delivery_attempt_id,
      generation: response.generation,
      provider: "resend",
      idempotency_key: response.idempotency_key,
      entry_ids: Object.freeze([...(response.entry_ids as string[])]),
      entry_snapshot_hash: response.entry_snapshot_hash,
      template_version: response.template_version,
      epoch: response.epoch,
      idempotent: response.idempotent,
    }) as Exclude<
      Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
      CorrelatedEmailDeliveryProcessingResponse | { status: "skipped_sent" }
    >;
  }


  private async settleLegacyEmailProcessing(
    item: ClaimedItem,
    reconcileLeaseToken: string,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
    processing: Exclude<
      Extract<ClaimEmailDeliveryResult, { kind: "success" }>["response"],
      CorrelatedEmailDeliveryProcessingResponse | { status: "skipped_sent" }
    >,
  ): Promise<ItemProcessingResult> {
    const request: Readonly<RecordEmailDeliveryOutcomeInput> = Object.freeze({
      orderId: item.order_id,
      deliveryAttemptId: processing.delivery_attempt_id,
      reconcileLeaseToken,
      reconcileLeaseEpoch: item.reconcile_lease_epoch,
      outcome: "ambiguous",
      providerMessageId: null,
      errorCode: "worker_email_claim_correlation_required",
      retryAfterSeconds: 60,
    });
    const settlement = await this.settleEmailOutcomeWithRecovery(
      item,
      tokenHash,
      conservativeLocalLeaseDeadlineMs,
      request,
      "outcome_settlement",
    );
    if (settlement.kind === "unsettled") {
      return {
        kind: "failed",
        fatalErrorCode: settlement.errorCode,
        emailAccounting: settlement.accounting,
      };
    }

    const fatal = this.latchFatalStop(
      "worker_email_claim_correlation_required",
    );
    return {
      kind: "email_settled",
      fatalErrorCode: fatal.errorCode,
      emailAccounting: settlement.accounting,
    };
  }

  private async invokeEmailProviderOnce(
    item: ClaimedItem,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
    conclusiveClaimAttemptStartedAtMs: number,
    processing: CorrelatedEmailDeliveryProcessingResponse,
    built: BuiltAccessEntriesEmailMessage,
    signal: AbortSignal,
    capability: ResolvedAccessFulfillmentEmailCapability,
  ): Promise<ProviderOutcomeTuple> {
    if (this.fatalState || signal.aborted) {
      return Object.freeze({
        outcome: "failed",
        providerMessageId: null,
        errorCode: "provider_call_not_started_aborted",
        retryAfterSeconds: 60,
      });
    }

    const nowMs = this.readObligationMonotonicNow();
    if (nowMs === undefined || this.fatalState || signal.aborted) {
      return Object.freeze({
        outcome: "failed",
        providerMessageId: null,
        errorCode: "provider_call_not_started_aborted",
        retryAfterSeconds: 60,
      });
    }
    const initialBudget = this.providerBudgetAt(
      conservativeLocalLeaseDeadlineMs,
      conclusiveClaimAttemptStartedAtMs,
      processing.idempotency_remaining_ms,
      nowMs,
    );
    if (
      initialBudget.effectiveProviderTimeoutMs < MIN_STAGE_WINDOW_MS ||
      initialBudget.conservativeIdempotencyRemainingMs <
        initialBudget.effectiveProviderTimeoutMs + MIN_STAGE_WINDOW_MS
    ) {
      return Object.freeze({
        outcome: "failed",
        providerMessageId: null,
        errorCode: "worker_email_idempotency_window_insufficient",
        retryAfterSeconds: 60,
      });
    }

    let providerDeadline: AbortDeadline | undefined;
    let combinedSignal: CombinedAbortSignal | undefined;
    let removeAbortListener = (): void => undefined;
    let providerStarted = false;
    try {
      providerDeadline = (
        this.dependencies.createDeadline ?? createAbortDeadline
      )(initialBudget.effectiveProviderTimeoutMs);
      combinedSignal = combineAbortSignals([
        providerDeadline.signal,
        signal,
        this.fatalAbortController.signal,
      ]);

      const abortPromise = new Promise<{ kind: "aborted" }>((resolve) => {
        const handleAbort = (): void => resolve({ kind: "aborted" });
        combinedSignal?.signal.addEventListener("abort", handleAbort, {
          once: true,
        });
        removeAbortListener = () =>
          combinedSignal?.signal.removeEventListener("abort", handleAbort);
      });

      const finalNowMs = this.readObligationMonotonicNow();
      if (
        finalNowMs === undefined ||
        this.fatalState ||
        signal.aborted ||
        providerDeadline.signal.aborted ||
        combinedSignal.signal.aborted
      ) {
        return Object.freeze({
          outcome: "failed",
          providerMessageId: null,
          errorCode: "provider_call_not_started_aborted",
          retryAfterSeconds: 60,
        });
      }
      const finalBudget = this.providerBudgetAt(
        conservativeLocalLeaseDeadlineMs,
        conclusiveClaimAttemptStartedAtMs,
        processing.idempotency_remaining_ms,
        finalNowMs,
      );
      if (
        finalBudget.localProviderCapacityMs <
          initialBudget.effectiveProviderTimeoutMs ||
        finalBudget.conservativeIdempotencyRemainingMs <
          initialBudget.effectiveProviderTimeoutMs + MIN_STAGE_WINDOW_MS
      ) {
        return Object.freeze({
          outcome: "failed",
          providerMessageId: null,
          errorCode: "worker_email_idempotency_window_insufficient",
          retryAfterSeconds: 60,
        });
      }

      const providerInput = Object.freeze({
        idempotencyKey: processing.idempotency_key,
        requestPayloadHash: built.requestPayloadHash,
        templateVersion: built.templateVersion,
        message: built.message,
      });
      let providerPromise: Promise<
        | { kind: "result"; result: AccessEmailProviderOutcome }
        | { kind: "thrown" }
      >;
      try {
        providerStarted = true;
        providerPromise = Promise.resolve(
          capability.send(providerInput, {
            signal: combinedSignal.signal,
          }),
        ).then(
          (result) => ({ kind: "result" as const, result }),
          () => ({ kind: "thrown" as const }),
        );
      } catch {
        return providerContractAmbiguous();
      }

      const conclusion = await Promise.race([
        providerPromise,
        abortPromise,
      ]);
      let tuple: ProviderOutcomeTuple;
      if (
        conclusion.kind === "aborted" ||
        conclusion.kind === "thrown" ||
        combinedSignal.signal.aborted
      ) {
        tuple = providerContractAmbiguous();
      } else {
        try {
          tuple =
            validateProviderOutcome(conclusion.result) ??
            providerContractAmbiguous();
        } catch {
          tuple = providerContractAmbiguous();
        }
      }
      this.safeLog(
        "info",
        "access_fulfillment_email_provider_completed",
        this.emailMetadata(item, tokenHash, "provider_started", {
          attemptHash: accessFulfillmentCorrelationHash(
            processing.delivery_attempt_id,
          ),
          outcome: tuple.outcome,
          ...(tuple.errorCode === null
            ? {}
            : { errorCode: tuple.errorCode }),
        }),
      );
      return tuple;
    } catch {
      return providerStarted
        ? providerContractAmbiguous()
        : Object.freeze({
            outcome: "failed",
            providerMessageId: null,
            errorCode: "provider_call_not_started_aborted",
            retryAfterSeconds: 60,
          });
    } finally {
      try {
        removeAbortListener();
      } catch {
        // Cleanup is best effort after the provider conclusion is frozen.
      }
      try {
        combinedSignal?.dispose();
      } catch {
        // Cleanup must not suppress mandatory outcome settlement.
      }
      try {
        providerDeadline?.dispose();
      } catch {
        // Cleanup must not suppress mandatory outcome settlement.
      }
    }
  }

  private providerBudgetAt(
    conservativeLocalLeaseDeadlineMs: number,
    conclusiveClaimAttemptStartedAtMs: number,
    sqlIdempotencyRemainingMs: number,
    nowMs: number,
  ): {
    conservativeIdempotencyRemainingMs: number;
    localProviderCapacityMs: number;
    effectiveProviderTimeoutMs: number;
  } {
    const elapsedSinceConclusiveClaimAttemptStartedMs = Math.max(
      0,
      nowMs - conclusiveClaimAttemptStartedAtMs,
    );
    const conservativeIdempotencyRemainingMs = Math.max(
      0,
      sqlIdempotencyRemainingMs -
        elapsedSinceConclusiveClaimAttemptStartedMs,
    );
    const localLeaseRemainingMs = Math.max(
      0,
      conservativeLocalLeaseDeadlineMs - nowMs,
    );
    const localProviderCapacityMs = Math.max(
      0,
      localLeaseRemainingMs -
        this.dependencies.config.rpcTimeoutMs -
        MIN_STAGE_WINDOW_MS,
    );
    return {
      conservativeIdempotencyRemainingMs,
      localProviderCapacityMs,
      effectiveProviderTimeoutMs: Math.min(
        this.dependencies.config.emailProviderTimeoutMs,
        localProviderCapacityMs,
      ),
    };
  }

  private async settleEmailOutcomeWithRecovery(
    item: ClaimedItem,
    tokenHash: string,
    conservativeLocalLeaseDeadlineMs: number,
    request: Readonly<RecordEmailDeliveryOutcomeInput>,
    phase: EmailExecutionPhase,
  ): Promise<OutcomeSettlementConclusion> {
    for (
      let attempt = 0;
      attempt < MAX_EMAIL_OBLIGATION_ATTEMPTS;
      attempt += 1
    ) {
      const invocation =
        await this.invokeEmailObligationAttempt<RecordEmailDeliveryOutcomeResult>(
          conservativeLocalLeaseDeadlineMs,
          attempt,
          (requestSignal) =>
            this.dependencies.client.recordEmailDeliveryOutcome(request, {
              signal: requestSignal,
            }),
        );
      if (invocation.kind === "budget_exhausted") {
        break;
      }
      if (
        invocation.kind === "deadline_exceeded" ||
        invocation.kind === "thrown"
      ) {
        continue;
      }

      const result = invocation.result;
      if (result.kind === "transport_error") {
        continue;
      }
      if (result.kind === "success") {
        if (
          result.response.order_id !== item.order_id ||
          result.response.delivery_attempt_id !== request.deliveryAttemptId
        ) {
          return this.outcomeSettlementUnsettled(
            item,
            tokenHash,
            phase,
            "worker_email_outcome_settlement_exhausted",
          );
        }
        const accounting = this.accountEmailSettlementSuccess(
          request,
          result.response,
        );
        if (!accounting) {
          return this.outcomeSettlementUnsettled(
            item,
            tokenHash,
            phase,
            "worker_email_outcome_settlement_exhausted",
          );
        }
        return { kind: "settled", accounting };
      }
      if (result.kind === "business_error") {
        const code = result.response.error.code;
        if (code === "concurrency_conflict") {
          continue;
        }
        switch (code) {
          case "stale_lease":
          case "outcome_conflict":
          case "provider_message_conflict":
          case "delivery_attempt_mismatch":
          case "delivery_attempt_not_found":
          case "order_not_found":
          case "fulfillment_not_found":
          case "invalid_request":
          case "internal_error":
            return this.outcomeSettlementUnsettled(
              item,
              tokenHash,
              phase,
              code,
            );
          default:
            return this.outcomeSettlementUnsettled(
              item,
              tokenHash,
              phase,
              "worker_email_outcome_settlement_exhausted",
            );
        }
      }
      return this.outcomeSettlementUnsettled(
        item,
        tokenHash,
        phase,
        "worker_email_outcome_settlement_exhausted",
      );
    }

    return this.outcomeSettlementUnsettled(
      item,
      tokenHash,
      phase,
      "worker_email_outcome_settlement_exhausted",
    );
  }

  private accountEmailSettlementSuccess(
    request: Readonly<RecordEmailDeliveryOutcomeInput>,
    response: Extract<
      RecordEmailDeliveryOutcomeResult,
      { kind: "success" }
    >["response"],
  ): EmailAccounting | null {
    if (response.status === "accepted") {
      if (request.outcome !== "accepted") {
        return null;
      }
      return Object.freeze({
        accepted: true,
        ...(response.manual_review ? { manualReview: true as const } : {}),
      });
    }

    if (response.idempotent === true) {
      if (
        (response.status !== "failed" && response.status !== "ambiguous") ||
        response.status !== request.outcome
      ) {
        return null;
      }
      return Object.freeze({
        ...(request.outcome === "ambiguous"
          ? { ambiguous: true as const }
          : request.retryAfterSeconds !== null
            ? { retryScheduled: true as const }
            : {}),
        manualReviewUnknown: true,
      });
    }

    if (request.outcome === "accepted") {
      return null;
    }
    if (
      (response.status === "failed" && request.outcome !== "failed") ||
      (response.status === "ambiguous" &&
        request.outcome !== "ambiguous")
    ) {
      return null;
    }
    return Object.freeze({
      ...(request.outcome === "ambiguous"
        ? { ambiguous: true as const }
        : response.retryable
          ? { retryScheduled: true as const }
          : {}),
      ...(response.manual_review ? { manualReview: true as const } : {}),
    });
  }

  private outcomeSettlementUnsettled(
    item: ClaimedItem,
    tokenHash: string,
    phase: EmailExecutionPhase,
    errorCode: string,
  ): OutcomeSettlementConclusion {
    this.safeLog(
      "error",
      "access_fulfillment_email_unsettled",
      this.emailMetadata(item, tokenHash, phase, { errorCode }),
    );
    const fatal = this.latchFatalStop(errorCode);
    return {
      kind: "unsettled",
      accounting: Object.freeze({ unsettled: true }),
      errorCode: fatal.errorCode,
    };
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

  private async invokeEmailObligationAttempt<Response>(
    parentDeadlineMs: number,
    attemptsAlreadyMade: number,
    invoke: (signal: AbortSignal) => Promise<Response>,
  ): Promise<ObligationInvocationConclusion<Response>> {
    const attemptsRemaining =
      MAX_EMAIL_OBLIGATION_ATTEMPTS - attemptsAlreadyMade;
    const budgetNowMs = this.readObligationMonotonicNow();
    if (
      budgetNowMs === undefined ||
      attemptsRemaining <= 0 ||
      !Number.isFinite(parentDeadlineMs)
    ) {
      return { kind: "budget_exhausted", requestStarted: false };
    }
    const remainingParentBudgetMs = parentDeadlineMs - budgetNowMs;
    const attemptTimeoutMs = Math.min(
      this.dependencies.config.rpcTimeoutMs,
      Math.floor(remainingParentBudgetMs / attemptsRemaining),
    );
    if (
      !Number.isFinite(attemptTimeoutMs) ||
      attemptTimeoutMs < MIN_STAGE_WINDOW_MS
    ) {
      return { kind: "budget_exhausted", requestStarted: false };
    }

    let deadline: AbortDeadline;
    try {
      deadline = (this.dependencies.createDeadline ?? createAbortDeadline)(
        attemptTimeoutMs,
      );
    } catch {
      return { kind: "thrown", requestStarted: false };
    }

    let removeAbortListener = (): void => undefined;
    let requestStarted = false;
    try {
      if (deadline.signal.aborted) {
        return { kind: "deadline_exceeded", requestStarted: false };
      }
      const startedAtMs = this.readObligationMonotonicNow();
      if (startedAtMs === undefined || deadline.signal.aborted) {
        return { kind: "deadline_exceeded", requestStarted: false };
      }

      const abortPromise = new Promise<{ kind: "aborted" }>((resolve) => {
        const handleAbort = (): void => resolve({ kind: "aborted" });
        deadline.signal.addEventListener("abort", handleAbort, { once: true });
        removeAbortListener = () =>
          deadline.signal.removeEventListener("abort", handleAbort);
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
        return { kind: "thrown", requestStarted };
      }

      if (deadline.signal.aborted) {
        return { kind: "deadline_exceeded", requestStarted };
      }
      const conclusion = await Promise.race([
        operationPromise,
        abortPromise,
      ]);
      if (deadline.signal.aborted || conclusion.kind === "aborted") {
        return { kind: "deadline_exceeded", requestStarted };
      }
      if (conclusion.kind === "thrown") {
        return { kind: "thrown", requestStarted };
      }
      return {
        kind: "result",
        result: conclusion.result,
        startedAtMs,
        requestStarted: true,
      };
    } finally {
      removeAbortListener();
      deadline.dispose();
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
      kind: "failed",
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
    return {
      kind: "local_lease_budget_exhausted",
      fatalErrorCode: fatal.errorCode,
    };
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

  private emailObligationStale(
    item: ClaimedItem,
    tokenHash: string,
    originStage: AccessFulfillmentStaleOriginStage,
  ): ItemProcessingResult {
    this.safeLog(
      "warn",
      "access_fulfillment_stale_lease",
      this.itemMetadata(item, tokenHash, {
        originStage,
        errorCode: "stale_lease",
      }),
    );
    return { kind: "stale" };
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
    return this.readMonotonicNowInternal(false);
  }

  private readObligationMonotonicNow(): number | undefined {
    return this.readMonotonicNowInternal(true);
  }

  private readMonotonicNowInternal(
    allowAfterFatal: boolean,
  ): number | undefined {
    if (!allowAfterFatal && this.fatalState) {
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

  private emailMetadata(
    item: ClaimedItem,
    tokenHash: string,
    phase: EmailExecutionPhase,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      tokenHash,
      orderHash: accessFulfillmentCorrelationHash(item.order_id),
      generation: item.email_generation,
      epoch: item.reconcile_lease_epoch,
      phase,
      ...extra,
    };
  }

  private summarize(
    claimedCount: number,
    outcomes: readonly (ItemProcessingResult | undefined)[],
  ): AccessFulfillmentCycleSummary {
    const summary = emptySummary(claimedCount);
    for (const outcome of outcomes) {
      if (!outcome) {
        continue;
      }
      switch (outcome.kind) {
        case "reconciled":
          summary.reconciledCount += 1;
          break;
        case "deferred":
          summary.deferredCount += 1;
          break;
        case "email_settled":
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
      const email = outcome.emailAccounting;
      if (email?.accepted) {
        summary.emailAcceptedCount += 1;
      }
      if (email?.retryScheduled) {
        summary.emailRetryScheduledCount += 1;
      }
      if (email?.ambiguous) {
        summary.emailAmbiguousCount += 1;
      }
      if (email?.skippedSent) {
        summary.emailSkippedSentCount += 1;
      }
      if (email?.unsettled) {
        summary.emailUnsettledCount += 1;
      }
      if (email?.manualReview) {
        summary.emailManualReviewCount += 1;
      }
      if (email?.manualReviewUnknown) {
        summary.emailManualReviewUnknownCount += 1;
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
