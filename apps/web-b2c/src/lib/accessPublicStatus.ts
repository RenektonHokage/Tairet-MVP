import { z } from "zod";

export const POLL_INTERVAL_MS = 3_000;
export const MAX_POLL_MS = 60_000;

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

export interface AccessPublicStatusOrder {
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
  readonly venue_name: string | null;
}

export interface AccessPublicStatusResponse {
  readonly ok: true;
  readonly order: AccessPublicStatusOrder;
}

const publicRefSchema = z.string().regex(/^acc_[0-9a-f]{32}$/);
const paymentStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "cancelled",
  "manual_review",
  "expired",
]);
const fulfillmentStatusSchema = z.enum([
  "not_started",
  "pending",
  "issued",
  "manual_review",
]);
const emailStatusSchema = z.enum([
  "not_started",
  "pending",
  "retry_scheduled",
  "sent",
  "manual_review",
]);
const timestampSchema = z.string().min(1).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "invalid timestamp",
);

const accessPublicStatusOrderSchema = z
  .object({
    ref: publicRefSchema,
    status: paymentStatusSchema,
    source_type: z.enum(["local", "event"]),
    access_date: z.string().min(1),
    amount_gs: z.number().int().nonnegative().safe(),
    currency: z.string().min(1),
    expires_at: timestampSchema.nullable(),
    fulfillment: z
      .object({
        status: fulfillmentStatusSchema,
      })
      .strict(),
    email: z
      .object({
        status: emailStatusSchema,
      })
      .strict(),
    venue_name: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((order, context) => {
    if (
      order.status !== "paid" &&
      (order.fulfillment.status !== "not_started" || order.email.status !== "not_started")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Non-paid orders cannot assert fulfillment or email progress",
        path: ["fulfillment"],
      });
    }
  });

const accessPublicStatusResponseSchema = z
  .object({
    ok: z.literal(true),
    order: accessPublicStatusOrderSchema,
  })
  .strict();

export function parseAccessPublicStatus(input: unknown): AccessPublicStatusResponse {
  return accessPublicStatusResponseSchema.parse(input);
}

export type AccessPublicStatusFetchResult =
  | Readonly<{ kind: "found"; order: AccessPublicStatusOrder }>
  | Readonly<{ kind: "not_found" }>;

export interface AccessPublicStatusHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type AccessPublicStatusFetch = (
  input: string,
  init: Readonly<{
    method: "GET";
    headers: Readonly<Record<string, string>>;
    signal: AbortSignal;
  }>,
) => Promise<AccessPublicStatusHttpResponse>;

export type AccessPublicStatusFetchErrorCode = "http_error" | "invalid_response";

export class AccessPublicStatusFetchError extends Error {
  readonly code: AccessPublicStatusFetchErrorCode;

  constructor(code: AccessPublicStatusFetchErrorCode) {
    super(code);
    this.name = "AccessPublicStatusFetchError";
    this.code = code;
  }
}

export async function fetchAccessPublicStatus(
  apiBase: string,
  ref: string,
  signal: AbortSignal,
  fetchImpl: AccessPublicStatusFetch = globalThis.fetch as AccessPublicStatusFetch,
): Promise<AccessPublicStatusFetchResult> {
  const base = apiBase.replace(/\/+$/, "");
  const response = await fetchImpl(
    `${base}/payments/access/status?ref=${encodeURIComponent(ref)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  if (response.status === 404) {
    return { kind: "not_found" };
  }

  if (!response.ok) {
    throw new AccessPublicStatusFetchError("http_error");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AccessPublicStatusFetchError("invalid_response");
  }

  let parsed: AccessPublicStatusResponse;
  try {
    parsed = parseAccessPublicStatus(payload);
  } catch {
    throw new AccessPublicStatusFetchError("invalid_response");
  }

  if (parsed.order.ref !== ref) {
    throw new AccessPublicStatusFetchError("invalid_response");
  }

  return {
    kind: "found",
    order: parsed.order,
  };
}

export type AccessPublicStatusPrimaryState =
  | "payment_pending"
  | "payment_cancelled"
  | "payment_expired"
  | "payment_manual_review"
  | "fulfillment_pending"
  | "fulfillment_manual_review"
  | "email_pending"
  | "email_retry_scheduled"
  | "email_sent"
  | "email_manual_review"
  | "not_found"
  | "initial_error"
  | "poll_timeout";

export type AccessPublicStatusWarning =
  | "poll_error"
  | "refresh_error"
  | "not_found_after_valid"
  | "poll_timeout";

function assertNever(value: never): never {
  throw new Error(`Unhandled public status: ${String(value)}`);
}

export function deriveAccessPublicStatusPrimary(
  order: AccessPublicStatusOrder,
): Exclude<AccessPublicStatusPrimaryState, "not_found" | "initial_error" | "poll_timeout"> {
  switch (order.status) {
    case "pending_payment":
      return "payment_pending";
    case "cancelled":
      return "payment_cancelled";
    case "expired":
      return "payment_expired";
    case "manual_review":
      return "payment_manual_review";
    case "paid":
      break;
    default:
      return assertNever(order.status);
  }

  switch (order.fulfillment.status) {
    case "not_started":
    case "pending":
      return "fulfillment_pending";
    case "manual_review":
      return "fulfillment_manual_review";
    case "issued":
      break;
    default:
      return assertNever(order.fulfillment.status);
  }

  switch (order.email.status) {
    case "not_started":
    case "pending":
      return "email_pending";
    case "retry_scheduled":
      return "email_retry_scheduled";
    case "sent":
      return "email_sent";
    case "manual_review":
      return "email_manual_review";
    default:
      return assertNever(order.email.status);
  }
}

export function shouldAutoPoll(order: AccessPublicStatusOrder): boolean {
  switch (order.status) {
    case "pending_payment":
      return true;
    case "cancelled":
    case "expired":
    case "manual_review":
      return false;
    case "paid":
      break;
    default:
      return assertNever(order.status);
  }

  switch (order.fulfillment.status) {
    case "not_started":
    case "pending":
      return true;
    case "manual_review":
      return false;
    case "issued":
      break;
    default:
      return assertNever(order.fulfillment.status);
  }

  switch (order.email.status) {
    case "not_started":
    case "pending":
    case "retry_scheduled":
      return true;
    case "sent":
    case "manual_review":
      return false;
    default:
      return assertNever(order.email.status);
  }
}

export type AccessPublicStatusRequestKind = "initial" | "poll" | "refresh";

export interface AccessPublicStatusControllerState {
  readonly ref: string;
  readonly order: AccessPublicStatusOrder | null;
  readonly primary: AccessPublicStatusPrimaryState | null;
  readonly warning: AccessPublicStatusWarning | null;
  readonly requestKind: AccessPublicStatusRequestKind | null;
  readonly isAutoPolling: boolean;
}

export const EMPTY_ACCESS_PUBLIC_STATUS_STATE: AccessPublicStatusControllerState = Object.freeze({
  ref: "",
  order: null,
  primary: null,
  warning: null,
  requestKind: null,
  isAutoPolling: false,
});

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export interface AccessPublicStatusScheduler {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface AccessPublicStatusControllerDependencies {
  readonly fetchStatus: (
    ref: string,
    signal: AbortSignal,
  ) => Promise<AccessPublicStatusFetchResult>;
  readonly now?: () => number;
  readonly scheduler?: AccessPublicStatusScheduler;
  readonly createAbortController?: () => AbortController;
  readonly pollIntervalMs?: number;
  readonly maxPollMs?: number;
}

export interface AccessPublicStatusController {
  getState(): AccessPublicStatusControllerState;
  subscribe(listener: (state: AccessPublicStatusControllerState) => void): () => void;
  start(ref: string): void;
  refresh(): boolean;
  dispose(): void;
}

export function monotonicNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    const value = performance.now();
    if (Number.isFinite(value)) return value;
  }
  return Date.now();
}

const browserScheduler: AccessPublicStatusScheduler = {
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  },
};

export function createAccessPublicStatusController(
  dependencies: AccessPublicStatusControllerDependencies,
): AccessPublicStatusController {
  const scheduler = dependencies.scheduler ?? browserScheduler;
  const now = dependencies.now ?? monotonicNow;
  const createAbortController = dependencies.createAbortController ?? (() => new AbortController());
  const pollIntervalMs = dependencies.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxPollMs = dependencies.maxPollMs ?? MAX_POLL_MS;

  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error("pollIntervalMs must be a non-negative finite number");
  }
  if (!Number.isFinite(maxPollMs) || maxPollMs < 0) {
    throw new Error("maxPollMs must be a non-negative finite number");
  }

  const listeners = new Set<(state: AccessPublicStatusControllerState) => void>();
  let state = EMPTY_ACCESS_PUBLIC_STATUS_STATE;
  let currentRef = "";
  let lastValidOrder: AccessPublicStatusOrder | null = null;
  let primary: AccessPublicStatusPrimaryState | null = null;
  let warning: AccessPublicStatusWarning | null = null;
  let requestKind: AccessPublicStatusRequestKind | null = null;
  let isAutoPolling = false;
  let deadlineAt = 0;
  let generation = 0;
  let requestSequence = 0;
  let disposed = false;
  let pollTimer: TimerHandle | null = null;
  let deadlineTimer: TimerHandle | null = null;
  let activeRequest:
    | Readonly<{
        generation: number;
        id: number;
        controller: AbortController;
      }>
    | null = null;

  function readNow(): number {
    const value = now();
    return Number.isFinite(value) ? value : monotonicNow();
  }

  function publish(): void {
    state = Object.freeze({
      ref: currentRef,
      order: lastValidOrder,
      primary,
      warning,
      requestKind,
      isAutoPolling,
    });
    for (const listener of listeners) listener(state);
  }

  function clearPollTimer(): void {
    if (pollTimer === null) return;
    scheduler.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function clearDeadlineTimer(): void {
    if (deadlineTimer === null) return;
    scheduler.clearTimeout(deadlineTimer);
    deadlineTimer = null;
  }

  function abortActiveRequest(): void {
    const request = activeRequest;
    activeRequest = null;
    if (request) request.controller.abort();
  }

  function stopAutoPolling(): void {
    isAutoPolling = false;
    clearPollTimer();
    clearDeadlineTimer();
  }

  function reachTimeout(): void {
    if (!isAutoPolling) return;
    stopAutoPolling();
    abortActiveRequest();
    requestKind = null;
    if (lastValidOrder) {
      primary = deriveAccessPublicStatusPrimary(lastValidOrder);
      warning = "poll_timeout";
    } else {
      primary = "poll_timeout";
      warning = null;
    }
    publish();
  }

  function deadlineReached(): boolean {
    return isAutoPolling && readNow() >= deadlineAt;
  }

  function scheduleDeadline(): void {
    clearDeadlineTimer();
    const remainingMs = deadlineAt - readNow();
    if (remainingMs <= 0) {
      reachTimeout();
      return;
    }
    deadlineTimer = scheduler.setTimeout(() => {
      deadlineTimer = null;
      reachTimeout();
    }, remainingMs);
  }

  function scheduleNextPoll(): void {
    clearPollTimer();
    if (!isAutoPolling || !lastValidOrder || !shouldAutoPoll(lastValidOrder)) return;

    const completedAt = readNow();
    if (completedAt >= deadlineAt) {
      reachTimeout();
      return;
    }

    if (completedAt + pollIntervalMs >= deadlineAt) return;

    pollTimer = scheduler.setTimeout(() => {
      pollTimer = null;
      if (deadlineReached()) {
        reachTimeout();
        return;
      }
      void issueRequest("poll");
    }, pollIntervalMs);
  }

  function isCurrentRequest(requestGeneration: number, requestId: number): boolean {
    return (
      !disposed &&
      generation === requestGeneration &&
      activeRequest?.generation === requestGeneration &&
      activeRequest.id === requestId
    );
  }

  function handleFound(
    order: AccessPublicStatusOrder,
    autoWasActive: boolean,
  ): void {
    lastValidOrder = order;
    primary = deriveAccessPublicStatusPrimary(order);
    warning = null;

    if (autoWasActive && isAutoPolling && shouldAutoPoll(order)) {
      publish();
      scheduleNextPoll();
      return;
    }

    stopAutoPolling();
    publish();
  }

  function handleNotFound(): void {
    stopAutoPolling();
    if (lastValidOrder) {
      primary = deriveAccessPublicStatusPrimary(lastValidOrder);
      warning = "not_found_after_valid";
    } else {
      primary = "not_found";
      warning = null;
    }
    publish();
  }

  function handleRequestError(kind: AccessPublicStatusRequestKind): void {
    stopAutoPolling();
    if (lastValidOrder) {
      primary = deriveAccessPublicStatusPrimary(lastValidOrder);
      warning = kind === "refresh" ? "refresh_error" : "poll_error";
    } else if (kind !== "refresh" || primary === null) {
      primary = "initial_error";
      warning = null;
    }
    publish();
  }

  async function issueRequest(kind: AccessPublicStatusRequestKind): Promise<boolean> {
    if (disposed || !currentRef || activeRequest) return false;

    if (isAutoPolling && deadlineReached()) {
      reachTimeout();
      if (kind !== "refresh") return false;
    }

    if (kind === "refresh") clearPollTimer();

    const requestGeneration = generation;
    const requestId = ++requestSequence;
    const controller = createAbortController();
    const autoWasActive = isAutoPolling;
    activeRequest = {
      generation: requestGeneration,
      id: requestId,
      controller,
    };
    requestKind = kind;
    publish();

    try {
      const result = await dependencies.fetchStatus(currentRef, controller.signal);
      if (!isCurrentRequest(requestGeneration, requestId)) return false;
      activeRequest = null;
      requestKind = null;

      if (autoWasActive && deadlineReached()) {
        reachTimeout();
        return true;
      }

      if (result.kind === "not_found") {
        handleNotFound();
        return true;
      }

      handleFound(result.order, autoWasActive);
      return true;
    } catch {
      if (!isCurrentRequest(requestGeneration, requestId)) return false;
      activeRequest = null;
      requestKind = null;

      if (autoWasActive && deadlineReached()) {
        reachTimeout();
        return true;
      }

      handleRequestError(kind);
      return true;
    }
  }

  const controller: AccessPublicStatusController = {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(ref) {
      if (disposed) return;

      generation += 1;
      stopAutoPolling();
      abortActiveRequest();
      currentRef = ref.trim();
      lastValidOrder = null;
      primary = null;
      warning = null;
      requestKind = null;
      publish();

      if (!currentRef) {
        primary = "not_found";
        publish();
        return;
      }

      isAutoPolling = true;
      deadlineAt = readNow() + maxPollMs;
      scheduleDeadline();
      if (isAutoPolling) void issueRequest("initial");
    },
    refresh() {
      if (disposed || !currentRef || activeRequest) return false;
      void issueRequest("refresh");
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      stopAutoPolling();
      abortActiveRequest();
      requestKind = null;
      listeners.clear();
    },
  };

  return controller;
}
