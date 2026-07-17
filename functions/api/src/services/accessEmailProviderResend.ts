import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
} from "resend";

import {
  ACCESS_FULFILLMENT_LIMITS,
} from "../config/accessFulfillment";
import {
  ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION,
  calculateAccessEmailRequestPayloadHash,
  type AccessEmailAttachment,
  type AccessEmailMessage,
} from "./accessEmailMessage";
import type {
  AccessEmailProvider,
  AccessEmailProviderOutcome,
  AccessEmailProviderSendInput,
  AccessEmailProviderSendOptions,
} from "./accessEmailProvider";
import {
  createAbortDeadline,
  type AbortDeadline,
  type AbortDeadlineScheduler,
} from "./abortDeadline";

const IDEMPOTENCY_KEY_PATTERN =
  /^access-email-delivery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAMED_FROM_PATTERN = /^([^<>]+)<([^<>]+)>$/;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HTTP_DATE_PATTERN =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MIN_RETRY_AFTER_SECONDS = 1;
const MAX_RETRY_AFTER_SECONDS = 3_600;

const RESEND_ERROR_NAMES = new Set([
  "invalid_idempotency_key",
  "validation_error",
  "missing_api_key",
  "restricted_api_key",
  "invalid_api_key",
  "not_found",
  "method_not_allowed",
  "invalid_idempotent_request",
  "concurrent_idempotent_requests",
  "invalid_attachment",
  "invalid_from_address",
  "invalid_access",
  "invalid_parameter",
  "invalid_region",
  "missing_required_field",
  "monthly_quota_exceeded",
  "daily_quota_exceeded",
  "rate_limit_exceeded",
  "security_error",
  "application_error",
  "internal_server_error",
]);

const TERMINAL_RESEND_ERROR_STATUSES: Readonly<
  Record<string, number>
> = Object.freeze({
  invalid_idempotency_key: 400,
  validation_error: 400,
  missing_api_key: 401,
  restricted_api_key: 401,
  invalid_api_key: 403,
  not_found: 404,
  method_not_allowed: 405,
  invalid_idempotent_request: 409,
  invalid_attachment: 422,
  invalid_from_address: 422,
  invalid_access: 422,
  invalid_parameter: 422,
  invalid_region: 422,
  missing_required_field: 422,
  monthly_quota_exceeded: 422,
  daily_quota_exceeded: 429,
  security_error: 451,
});

export type ResendAccessEmailProviderErrorCode =
  | "provider_invalid_input"
  | "provider_payload_hash_mismatch"
  | "provider_template_unsupported"
  | "provider_idempotency_key_invalid"
  | "provider_call_not_started_aborted"
  | "provider_call_not_started_failed"
  | "resend_request_rejected"
  | "resend_rate_limited"
  | "resend_concurrent_request"
  | "resend_server_error"
  | "resend_timeout"
  | "resend_external_abort"
  | "resend_transport_ambiguous"
  | "resend_malformed_response"
  | "resend_unknown_error";

export interface ResendAccessEmailClient {
  readonly emails: {
    send(
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions,
    ): Promise<CreateEmailResponse>;
  };
}

export interface CreateResendAccessEmailProviderOptions {
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly client?: ResendAccessEmailClient;
  readonly clientFactory?: (apiKey: string) => ResendAccessEmailClient;
  readonly scheduler?: AbortDeadlineScheduler;
  readonly now?: () => number;
}

interface ResendErrorClassificationInput {
  readonly error: unknown;
  readonly headers: unknown;
  readonly nowMs: number;
}

type ResendErrorOutcome = Extract<
  AccessEmailProviderOutcome,
  { kind: "failed_retryable" | "failed_terminal" | "ambiguous" }
>;

type AcceptedOutcome = Extract<
  AccessEmailProviderOutcome,
  { kind: "accepted" }
>;
type FailedRetryableOutcome = Extract<
  AccessEmailProviderOutcome,
  { kind: "failed_retryable" }
>;
type FailedTerminalOutcome = Extract<
  AccessEmailProviderOutcome,
  { kind: "failed_terminal" }
>;
type AmbiguousOutcome = Extract<
  AccessEmailProviderOutcome,
  { kind: "ambiguous" }
>;

interface ParsedResendError {
  readonly name: string;
  readonly statusCode: number | null;
}

interface ValidatedProviderInput {
  readonly idempotencyKey: string;
  readonly payload: CreateEmailOptions;
}

type ProviderInputValidation =
  | {
      readonly valid: true;
      readonly input: ValidatedProviderInput;
    }
  | {
      readonly valid: false;
      readonly errorCode: ResendAccessEmailProviderErrorCode;
    };

type ProviderSettlement =
  | { readonly kind: "response"; readonly response: unknown }
  | { readonly kind: "thrown" };

type ProviderRaceSettlement =
  | ProviderSettlement
  | { readonly kind: "aborted" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    Object.getOwnPropertySymbols(value).length === 0 &&
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEmailAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    !value.includes("\r") &&
    !value.includes("\n") &&
    EMAIL_PATTERN.test(value)
  );
}

function isEmailFrom(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return false;
  }

  if (!value.includes("<") && !value.includes(">")) {
    return EMAIL_PATTERN.test(value);
  }

  const namedFrom = NAMED_FROM_PATTERN.exec(value);
  if (!namedFrom) {
    return false;
  }

  const displayName = namedFrom[1].trim();
  const address = namedFrom[2].trim();
  return (
    displayName.length > 0 &&
    EMAIL_PATTERN.test(address) &&
    value === `${displayName} <${address}>`
  );
}

function copyValidAttachment(value: unknown): AccessEmailAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    Object.getOwnPropertySymbols(value).length !== 0 ||
    keys.some(
      (key) =>
        key !== "filename" &&
        key !== "content" &&
        key !== "contentType" &&
        key !== "contentId",
    ) ||
    !keys.includes("filename") ||
    !keys.includes("content") ||
    !keys.includes("contentType")
  ) {
    return null;
  }

  const filename = value.filename;
  const content = value.content;
  const contentType = value.contentType;
  const contentId = value.contentId;

  if (
    !isNonEmptyString(filename) ||
    filename.includes("\r") ||
    filename.includes("\n") ||
    !isNonEmptyString(content) ||
    !BASE64_PATTERN.test(content) ||
    !isNonEmptyString(contentType) ||
    contentType.includes("\r") ||
    contentType.includes("\n")
  ) {
    return null;
  }

  if (
    contentId !== undefined &&
    (!isNonEmptyString(contentId) ||
      contentId.includes("\r") ||
      contentId.includes("\n"))
  ) {
    return null;
  }

  return Object.freeze({
    filename,
    content,
    contentType,
    ...(contentId === undefined ? {} : { contentId }),
  });
}

function copyValidMessage(value: unknown): AccessEmailMessage | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["from", "to", "subject", "html", "attachments"])
  ) {
    return null;
  }

  const from = value.from;
  const to = value.to;
  const subject = value.subject;
  const html = value.html;
  const attachments = value.attachments;

  if (
    !isEmailFrom(from) ||
    !Array.isArray(to) ||
    to.length === 0 ||
    !isNonEmptyString(subject) ||
    subject.includes("\r") ||
    subject.includes("\n") ||
    !isNonEmptyString(html) ||
    !Array.isArray(attachments) ||
    attachments.length === 0
  ) {
    return null;
  }

  const recipientCopies = [...to];
  if (
    recipientCopies.length === 0 ||
    !recipientCopies.every(isEmailAddress)
  ) {
    return null;
  }

  const attachmentCopies: AccessEmailAttachment[] = [];
  for (const attachment of attachments) {
    const copy = copyValidAttachment(attachment);
    if (!copy) {
      return null;
    }
    attachmentCopies.push(copy);
  }
  if (attachmentCopies.length === 0) {
    return null;
  }

  return Object.freeze({
    from,
    to: Object.freeze(recipientCopies),
    subject,
    html,
    attachments: Object.freeze(attachmentCopies),
  });
}

function validateInput(input: unknown): ProviderInputValidation {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, [
      "idempotencyKey",
      "requestPayloadHash",
      "templateVersion",
      "message",
    ])
  ) {
    return { valid: false, errorCode: "provider_invalid_input" };
  }

  const idempotencyKey = input.idempotencyKey;
  const requestPayloadHash = input.requestPayloadHash;
  const templateVersion = input.templateVersion;
  const message = copyValidMessage(input.message);

  if (
    typeof idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  ) {
    return { valid: false, errorCode: "provider_idempotency_key_invalid" };
  }

  if (
    typeof requestPayloadHash !== "string" ||
    !SHA256_PATTERN.test(requestPayloadHash)
  ) {
    return { valid: false, errorCode: "provider_invalid_input" };
  }

  if (templateVersion !== ACCESS_ENTRIES_EMAIL_TEMPLATE_VERSION) {
    return { valid: false, errorCode: "provider_template_unsupported" };
  }

  if (!message) {
    return { valid: false, errorCode: "provider_invalid_input" };
  }

  const calculatedHash = calculateAccessEmailRequestPayloadHash({
    templateVersion,
    message,
  });
  if (calculatedHash !== requestPayloadHash) {
    return { valid: false, errorCode: "provider_payload_hash_mismatch" };
  }

  return {
    valid: true,
    input: {
      idempotencyKey,
      payload: createResendPayload(message),
    },
  };
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    isRecord(value) &&
    typeof value.aborted === "boolean" &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function readExternalSignal(
  options: unknown,
): { readonly valid: true; readonly signal?: AbortSignal } | { readonly valid: false } {
  if (options === undefined) {
    return { valid: true };
  }

  if (!isRecord(options)) {
    return { valid: false };
  }

  const keys = Object.keys(options);
  if (
    Object.getOwnPropertySymbols(options).length !== 0 ||
    keys.some((key) => key !== "signal")
  ) {
    return { valid: false };
  }

  const signal = options.signal;
  if (signal === undefined) {
    return { valid: true };
  }

  return isAbortSignal(signal)
    ? { valid: true, signal }
    : { valid: false };
}

function accepted(providerMessageId: string): AcceptedOutcome {
  return Object.freeze({ kind: "accepted", providerMessageId });
}

function failedRetryable(
  errorCode: ResendAccessEmailProviderErrorCode,
  retryAfterSeconds?: number,
): FailedRetryableOutcome {
  return Object.freeze({
    kind: "failed_retryable",
    errorCode,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
}

function failedTerminal(
  errorCode: ResendAccessEmailProviderErrorCode,
): FailedTerminalOutcome {
  return Object.freeze({ kind: "failed_terminal", errorCode });
}

function ambiguous(
  errorCode: ResendAccessEmailProviderErrorCode,
): AmbiguousOutcome {
  return Object.freeze({ kind: "ambiguous", errorCode });
}

function parseResendError(error: unknown): ParsedResendError | null {
  if (!isRecord(error) || !hasOnlyKeys(error, ["name", "statusCode", "message"])) {
    return null;
  }

  const name = error.name;
  const statusCode = error.statusCode;
  const message = error.message;
  if (
    typeof name !== "string" ||
    typeof message !== "string" ||
    statusCode !== null &&
    (!Number.isInteger(statusCode) ||
      typeof statusCode !== "number" ||
      statusCode < 100 ||
      statusCode > 599)
  ) {
    return null;
  }

  return { name, statusCode };
}

function readRetryAfterHeader(headers: unknown): string | undefined {
  try {
    if (!isRecord(headers)) {
      return undefined;
    }

    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === "retry-after" && typeof value === "string") {
        return value;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function clampRetryAfter(seconds: number): number {
  return Math.min(
    MAX_RETRY_AFTER_SECONDS,
    Math.max(MIN_RETRY_AFTER_SECONDS, seconds),
  );
}

function parseRetryAfterSeconds(headers: unknown, nowMs: number): number {
  const value = readRetryAfterHeader(headers)?.trim();
  if (!value) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds)
      ? clampRetryAfter(seconds)
      : DEFAULT_RETRY_AFTER_SECONDS;
  }

  if (!HTTP_DATE_PATTERN.test(value)) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  const dateMs = Date.parse(value);
  if (
    !Number.isFinite(dateMs) ||
    new Date(dateMs).toUTCString() !== value ||
    !Number.isFinite(nowMs)
  ) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  const seconds = Math.ceil((dateMs - nowMs) / 1_000);
  return Number.isSafeInteger(seconds)
    ? clampRetryAfter(seconds)
    : DEFAULT_RETRY_AFTER_SECONDS;
}

export function classifyResendError(
  input: ResendErrorClassificationInput,
): ResendErrorOutcome {
  let parsed: ParsedResendError | null;
  let headers: unknown;
  let nowMs: number;
  try {
    parsed = parseResendError(input.error);
    headers = input.headers;
    nowMs = input.nowMs;
  } catch {
    return ambiguous("resend_malformed_response");
  }

  if (!parsed) {
    return ambiguous("resend_malformed_response");
  }

  const { name, statusCode } = parsed;
  if (!RESEND_ERROR_NAMES.has(name)) {
    return ambiguous("resend_unknown_error");
  }

  if (statusCode !== null && statusCode >= 500) {
    return ambiguous("resend_server_error");
  }

  if (name === "concurrent_idempotent_requests") {
    return statusCode === 409
      ? ambiguous("resend_concurrent_request")
      : ambiguous("resend_unknown_error");
  }

  if (name === "rate_limit_exceeded") {
    return statusCode === 429
      ? failedRetryable(
          "resend_rate_limited",
          parseRetryAfterSeconds(headers, nowMs),
        )
      : ambiguous("resend_unknown_error");
  }

  if (name === "application_error") {
    if (statusCode === 429) {
      return failedRetryable(
        "resend_rate_limited",
        parseRetryAfterSeconds(headers, nowMs),
      );
    }

    return ambiguous(
      statusCode === null
        ? "resend_transport_ambiguous"
        : "resend_unknown_error",
    );
  }

  if (name === "internal_server_error") {
    return ambiguous(
      statusCode === null ? "resend_transport_ambiguous" : "resend_unknown_error",
    );
  }

  const terminalStatuses = TERMINAL_RESEND_ERROR_STATUSES[name];
  if (terminalStatuses !== undefined) {
    return statusCode === terminalStatuses
      ? failedTerminal("resend_request_rejected")
      : ambiguous("resend_unknown_error");
  }

  return ambiguous("resend_unknown_error");
}

function createResendPayload(message: AccessEmailMessage): CreateEmailOptions {
  return {
    from: message.from,
    to: [...message.to],
    subject: message.subject,
    html: message.html,
    attachments: message.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      ...(attachment.contentId === undefined
        ? {}
        : { contentId: attachment.contentId }),
    })),
  };
}

type ResendEmailRequestOptionsWithSignal = CreateEmailRequestOptions & {
  readonly signal: AbortSignal;
};

type ResendEmailSendWithSignal = (
  payload: CreateEmailOptions,
  options: ResendEmailRequestOptionsWithSignal,
) => Promise<CreateEmailResponse>;

function sendResendEmailWithSignal(
  client: ResendAccessEmailClient,
  payload: CreateEmailOptions,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<CreateEmailResponse> {
  const requestOptions: ResendEmailRequestOptionsWithSignal = {
    idempotencyKey,
    signal,
  };

  /*
   * Compatibility seam pinned to Resend 6.6.0: Emails.send forwards options
   * unchanged, and Resend.post spreads them into the fetch RequestInit. The
   * public type omits signal, so this one cast must be re-audited on upgrades.
   */
  const sendWithSignal = client.emails.send as ResendEmailSendWithSignal;
  return sendWithSignal.call(client.emails, payload, requestOptions);
}

function classifyResendResponse(
  response: unknown,
  nowMs: number,
): AccessEmailProviderOutcome {
  try {
    if (!isRecord(response)) {
      return ambiguous("resend_malformed_response");
    }

    const responseKeys = Object.keys(response);
    if (
      Object.getOwnPropertySymbols(response).length !== 0 ||
      !responseKeys.includes("data") ||
      responseKeys.some(
        (key) => key !== "data" && key !== "error" && key !== "headers",
      )
    ) {
      return ambiguous("resend_malformed_response");
    }

    const data = response.data;
    const responseHasOwnError = responseKeys.includes("error");
    const error = responseHasOwnError ? response.error : undefined;
    const headers = responseKeys.includes("headers")
      ? response.headers
      : undefined;

    if ((error === null || error === undefined) && isRecord(data)) {
      const providerMessageId = data.id;
      if (
        !hasOnlyKeys(data, ["id"]) ||
        typeof providerMessageId !== "string" ||
        providerMessageId.trim().length === 0
      ) {
        return ambiguous("resend_malformed_response");
      }

      return accepted(providerMessageId.trim());
    }

    if (responseHasOwnError && isRecord(error) && data === null) {
      return classifyResendError({ error, headers, nowMs });
    }

    return ambiguous("resend_malformed_response");
  } catch {
    return ambiguous("resend_malformed_response");
  }
}

function cleanupDeadline(
  deadline: AbortDeadline | undefined,
  removeAbortListener: (() => void) | undefined,
): void {
  try {
    removeAbortListener?.();
  } catch {
    // Cleanup is best-effort; the provider outcome remains sanitized.
  }

  try {
    deadline?.dispose();
  } catch {
    // An injected cancellation hook must not escape the provider contract.
  }
}

function isClient(value: unknown): value is ResendAccessEmailClient {
  try {
    return (
      isRecord(value) &&
      isRecord(value.emails) &&
      typeof value.emails.send === "function"
    );
  } catch {
    return false;
  }
}

function createDefaultResendClient(apiKey: string): ResendAccessEmailClient {
  return new Resend(apiKey);
}

export function createResendAccessEmailProvider(
  options: CreateResendAccessEmailProviderOptions,
): AccessEmailProvider {
  let apiKey: string;
  let client: ResendAccessEmailClient | undefined;
  let clientFactory: (apiKey: string) => ResendAccessEmailClient;
  let timeoutMs: number;
  let scheduler: AbortDeadlineScheduler | undefined;
  let now: () => number;

  try {
    if (!isRecord(options)) {
      throw new Error("invalid provider configuration");
    }

    const configuredApiKey = options.apiKey;
    const configuredTimeoutMs = options.timeoutMs;
    const configuredClientOption = options.client;
    const configuredClientFactory = options.clientFactory;
    const configuredScheduler = options.scheduler;
    const configuredNow = options.now;
    if (
      typeof configuredApiKey !== "string" ||
      configuredApiKey.trim().length === 0 ||
      configuredApiKey.trim() !== configuredApiKey ||
      typeof configuredTimeoutMs !== "number" ||
      !Number.isSafeInteger(configuredTimeoutMs) ||
      configuredTimeoutMs <
        ACCESS_FULFILLMENT_LIMITS.emailProviderTimeoutMs.min ||
      configuredTimeoutMs >
        ACCESS_FULFILLMENT_LIMITS.emailProviderTimeoutMs.max ||
      (configuredClientFactory !== undefined &&
        typeof configuredClientFactory !== "function") ||
      (configuredClientOption !== undefined &&
        configuredClientFactory !== undefined) ||
      (configuredScheduler !== undefined &&
        typeof configuredScheduler !== "function") ||
      (configuredNow !== undefined && typeof configuredNow !== "function")
    ) {
      throw new Error("invalid provider configuration");
    }

    if (configuredClientOption !== undefined && !isClient(configuredClientOption)) {
      throw new Error("invalid provider client");
    }

    apiKey = configuredApiKey;
    client = configuredClientOption;
    clientFactory = configuredClientFactory ?? createDefaultResendClient;
    timeoutMs = configuredTimeoutMs;
    scheduler = configuredScheduler;
    now = configuredNow ?? Date.now;
  } catch {
    throw new Error("Unable to initialize Resend access email provider");
  }

  return Object.freeze({
    async send(
      input: AccessEmailProviderSendInput,
      sendOptions?: AccessEmailProviderSendOptions,
    ): Promise<AccessEmailProviderOutcome> {
      let validatedInput: ValidatedProviderInput;
      let externalSignal: AbortSignal | undefined;

      try {
        const validation = validateInput(input);
        if (!validation.valid) {
          return failedTerminal(validation.errorCode);
        }
        validatedInput = validation.input;

        const externalSignalResult = readExternalSignal(sendOptions);
        if (!externalSignalResult.valid) {
          return failedTerminal("provider_invalid_input");
        }
        externalSignal = externalSignalResult.signal;

        if (externalSignal?.aborted) {
          return failedRetryable("provider_call_not_started_aborted");
        }
      } catch {
        return failedTerminal("provider_invalid_input");
      }

      let deadline: AbortDeadline | undefined;
      let removeAbortListener: (() => void) | undefined;
      let providerCallStarted = false;

      try {
        deadline = createAbortDeadline(timeoutMs, externalSignal, scheduler);
        if (deadline.signal.aborted) {
          return failedRetryable("provider_call_not_started_aborted");
        }

        let activeClient = client;
        if (!activeClient) {
          const createdClient = clientFactory(apiKey);
          if (!isClient(createdClient)) {
            throw new Error("invalid provider client");
          }
          client = createdClient;
          activeClient = createdClient;
        }

        if (deadline.signal.aborted) {
          return failedRetryable("provider_call_not_started_aborted");
        }

        let abortListener: (() => void) | undefined;
        const abortSettlement = new Promise<ProviderRaceSettlement>((resolve) => {
          abortListener = () => {
            queueMicrotask(() => resolve({ kind: "aborted" }));
          };
          deadline?.signal.addEventListener("abort", abortListener, { once: true });
        });
        removeAbortListener = () => {
          if (abortListener) {
            deadline?.signal.removeEventListener("abort", abortListener);
          }
        };

        providerCallStarted = true;
        const providerOperation = Promise.resolve(
          sendResendEmailWithSignal(
            activeClient,
            validatedInput.payload,
            validatedInput.idempotencyKey,
            deadline.signal,
          ),
        );
        const providerSettlement: Promise<ProviderSettlement> =
          providerOperation.then(
            (response) => ({ kind: "response", response }),
            () => ({ kind: "thrown" }),
          );

        const settlement = await Promise.race([
          providerSettlement,
          abortSettlement,
        ]);

        if (settlement.kind === "response") {
          let nowMs = Number.NaN;
          try {
            nowMs = now();
          } catch {
            // Invalid clocks only disable HTTP-date Retry-After parsing.
          }
          return classifyResendResponse(settlement.response, nowMs);
        }

        if (settlement.kind === "aborted") {
          if (deadline.didTimeout()) {
            return ambiguous("resend_timeout");
          }
          if (deadline.wasExternallyAborted()) {
            return ambiguous("resend_external_abort");
          }
        }

        return ambiguous("resend_transport_ambiguous");
      } catch {
        return providerCallStarted
          ? ambiguous("resend_transport_ambiguous")
          : failedRetryable("provider_call_not_started_failed");
      } finally {
        cleanupDeadline(deadline, removeAbortListener);
      }
    },
  });
}
