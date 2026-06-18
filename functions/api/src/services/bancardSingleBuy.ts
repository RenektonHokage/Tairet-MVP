import { createHash } from "node:crypto";
import { supabase } from "./supabase";
import { logger } from "../utils/logger";
import { sha256Hex } from "../utils/idempotency";
import type { AccessBancardSingleBuyInput } from "../schemas/accessBancardSingleBuy";

const PROVIDER = "bancard";
const PROVIDER_OPERATION = "single_buy";
const IDEMPOTENCY_LOCK_MS = 120_000;
const IDEMPOTENCY_EXPIRES_MS = 24 * 60 * 60 * 1000;
const MAX_SHOP_PROCESS_ID_RETRIES = 3;
const DEFAULT_BANCARD_TIMEOUT_MS = 15_000;
const MIN_BANCARD_TIMEOUT_MS = 1_000;
const MAX_BANCARD_TIMEOUT_MS = 30_000;

type PublicErrorCode =
  | "invalid_request"
  | "quantity_limit_exceeded"
  | "idempotency_conflict"
  | "checkout_in_progress"
  | "checkout_failed"
  | "stock_unconfigured"
  | "sold_out"
  | "bancard_config_missing"
  | "bancard_http_error"
  | "bancard_timeout"
  | "bancard_ambiguous"
  | "internal_error";

interface PublicErrorBody {
  ok: false;
  error: {
    code: PublicErrorCode;
    message: string;
  };
}

interface PublicSuccessBody {
  ok: true;
  public_ref: string;
  expires_at: string;
  amount_gs: number;
  currency: "PYG";
  provider_amount_text: string;
  provider: typeof PROVIDER;
  provider_operation: typeof PROVIDER_OPERATION;
  shop_process_id: string;
  process_id: string;
  iframe: {
    public_key: string;
    process_id: string;
  };
}

export interface BancardSingleBuyResult {
  status: number;
  body: PublicSuccessBody | PublicErrorBody;
}

interface BancardConfig {
  publicKey: string;
  privateKey: string;
  baseUrl: string;
  b2cBaseUrl: string;
  environment: string | null;
  timeoutMs: number;
}

interface IdempotencyRow {
  id: string;
  request_hash: string;
  status: "processing" | "succeeded" | "failed" | "manual_review" | "expired";
  response_payload: unknown;
  error_payload: unknown;
  locked_until: string | null;
}

interface PaidCheckoutRpcSuccess {
  ok: true;
  order_id: string;
  public_ref: string;
  status: string;
  expires_at: string;
  payment_attempt_id: string;
  provider: string;
  provider_operation: string;
  amount_gs: number;
  currency: "PYG";
  provider_amount_text: string;
}

interface PaidCheckoutRpcFailure {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
}

type PaidCheckoutRpcResult = PaidCheckoutRpcSuccess | PaidCheckoutRpcFailure;

interface ShopProcessAssignment {
  shopProcessId: string;
  requestPayload: Record<string, unknown>;
  providerPayload: Record<string, unknown>;
}

function publicError(code: PublicErrorCode, message: string): PublicErrorBody {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function statusForErrorCode(code: PublicErrorCode): number {
  switch (code) {
    case "invalid_request":
    case "quantity_limit_exceeded":
      return 400;
    case "idempotency_conflict":
    case "checkout_in_progress":
    case "stock_unconfigured":
    case "sold_out":
      return 409;
    case "bancard_timeout":
    case "bancard_ambiguous":
      return 202;
    case "bancard_http_error":
      return 502;
    case "checkout_failed":
      return 400;
    case "bancard_config_missing":
    case "internal_error":
    default:
      return 500;
  }
}

function resultFromError(code: PublicErrorCode, message: string): BancardSingleBuyResult {
  return {
    status: statusForErrorCode(code),
    body: publicError(code, message),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function clampTimeoutMs(rawValue: string | null): number {
  if (!rawValue) return DEFAULT_BANCARD_TIMEOUT_MS;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BANCARD_TIMEOUT_MS;

  return Math.min(Math.max(parsed, MIN_BANCARD_TIMEOUT_MS), MAX_BANCARD_TIMEOUT_MS);
}

function getBancardConfig(): BancardConfig | null {
  const publicKey = getTrimmedEnv("BANCARD_PUBLIC_KEY");
  const privateKey = getTrimmedEnv("BANCARD_PRIVATE_KEY");
  const baseUrl = getTrimmedEnv("BANCARD_BASE_URL");
  const b2cBaseUrl = getTrimmedEnv("B2C_BASE_URL");

  if (!publicKey || !privateKey || !baseUrl || !b2cBaseUrl) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    b2cBaseUrl: b2cBaseUrl.replace(/\/+$/, ""),
    environment: getTrimmedEnv("BANCARD_ENVIRONMENT"),
    timeoutMs: clampTimeoutMs(getTrimmedEnv("BANCARD_HTTP_TIMEOUT_MS")),
  };
}

function normalizedRequestPayload(input: AccessBancardSingleBuyInput): Record<string, unknown> {
  return {
    source_type: input.source_type,
    local_id: input.source_type === "local" ? input.local_id ?? null : null,
    event_id: input.source_type === "event" ? input.event_id ?? null : null,
    access_date: input.access_date,
    buyer: input.buyer,
    items: [...input.items]
      .sort((left, right) => left.access_ticket_type_id.localeCompare(right.access_ticket_type_id))
      .map((item) => ({
        access_ticket_type_id: item.access_ticket_type_id,
        quantity: item.quantity,
      })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;

  const directValue = value[key];
  if (typeof directValue === "string" && directValue.trim().length > 0) {
    return directValue.trim();
  }

  return null;
}

function readNestedString(value: unknown, firstKey: string, secondKey: string): string | null {
  if (!isRecord(value)) return null;
  return readString(value[firstKey], secondKey);
}

function sanitizeProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item));
  }

  if (isRecord(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
      if (/(token|private|secret|authorization|cookie|password|card|cvv|pan)/i.test(key)) {
        acc[key] = "[redacted]";
      } else {
        acc[key] = sanitizeProviderPayload(value[key]);
      }
      return acc;
    }, {});
  }

  if (typeof value === "string" && value.length > 1000) {
    return `${value.slice(0, 1000)}...`;
  }

  return value;
}

function parseProviderResponseBody(text: string): unknown {
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      raw: text.length > 1000 ? `${text.slice(0, 1000)}...` : text,
    };
  }
}

function isPublicSuccessBody(value: unknown): value is PublicSuccessBody {
  return isRecord(value) && value.ok === true && typeof value.public_ref === "string";
}

function isPublicErrorBody(value: unknown): value is PublicErrorBody {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function rpcErrorToPublicError(errorCode: string | undefined, message: string | undefined): PublicErrorBody {
  if (errorCode === "stock_unconfigured") {
    return publicError("stock_unconfigured", message ?? "Stock is unconfigured");
  }

  if (errorCode === "sold_out") {
    return publicError("sold_out", message ?? "Sold out");
  }

  if (errorCode === "internal_error") {
    return publicError("internal_error", "Internal error");
  }

  return publicError("checkout_failed", message ?? "Checkout failed");
}

function normalizeAmountGs(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parsePaidCheckoutSuccess(value: unknown): PaidCheckoutRpcSuccess | null {
  if (!isRecord(value) || value.ok !== true) return null;

  const amountGs = normalizeAmountGs(value.amount_gs);
  if (
    typeof value.order_id !== "string" ||
    typeof value.public_ref !== "string" ||
    typeof value.status !== "string" ||
    typeof value.expires_at !== "string" ||
    typeof value.payment_attempt_id !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.provider_operation !== "string" ||
    amountGs === null ||
    value.currency !== "PYG" ||
    typeof value.provider_amount_text !== "string"
  ) {
    return null;
  }

  return {
    ok: true,
    order_id: value.order_id,
    public_ref: value.public_ref,
    status: value.status,
    expires_at: value.expires_at,
    payment_attempt_id: value.payment_attempt_id,
    provider: value.provider,
    provider_operation: value.provider_operation,
    amount_gs: amountGs,
    currency: "PYG",
    provider_amount_text: value.provider_amount_text,
  };
}

async function getExistingIdempotencyRow(idempotencyKey: string): Promise<IdempotencyRow | null> {
  const { data, error } = await supabase
    .from("access_checkout_idempotency_keys")
    .select("id, request_hash, status, response_payload, error_payload, locked_until")
    .eq("provider", PROVIDER)
    .eq("provider_operation", PROVIDER_OPERATION)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    logger.error("Failed to fetch Access Core idempotency row", { error: error.message });
    return null;
  }

  return data as IdempotencyRow | null;
}

async function createIdempotencyRow(input: AccessBancardSingleBuyInput, requestHash: string): Promise<BancardSingleBuyResult | { id: string }> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + IDEMPOTENCY_LOCK_MS).toISOString();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_EXPIRES_MS).toISOString();

  const { data, error } = await supabase
    .from("access_checkout_idempotency_keys")
    .insert({
      provider: PROVIDER,
      provider_operation: PROVIDER_OPERATION,
      idempotency_key: input.idempotency_key,
      request_hash: requestHash,
      status: "processing",
      locked_until: lockedUntil,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return { id: data.id as string };
  }

  if (error?.code !== "23505") {
    logger.error("Failed to create Access Core idempotency row", { error: error?.message });
    return resultFromError("internal_error", "Internal error");
  }

  const existing = await getExistingIdempotencyRow(input.idempotency_key);
  if (!existing) {
    return resultFromError("internal_error", "Internal error");
  }

  if (existing.request_hash !== requestHash) {
    return resultFromError("idempotency_conflict", "Idempotency key was already used with a different request");
  }

  if (existing.status === "succeeded") {
    if (isPublicSuccessBody(existing.response_payload)) {
      return { status: 200, body: existing.response_payload };
    }

    return resultFromError("internal_error", "Internal error");
  }

  if (existing.status === "failed") {
    if (isPublicErrorBody(existing.error_payload)) {
      return { status: statusForErrorCode(existing.error_payload.error.code), body: existing.error_payload };
    }

    return resultFromError("internal_error", "Internal error");
  }

  if (existing.status === "manual_review") {
    return resultFromError("bancard_ambiguous", "Payment is under manual review");
  }

  // V1 does not reclaim expired/old processing locks to avoid duplicate Bancard calls.
  return resultFromError("checkout_in_progress", "Checkout is already in progress");
}

async function closeIdempotency(
  id: string,
  status: "succeeded" | "failed" | "manual_review",
  payload: PublicSuccessBody | PublicErrorBody,
  orderId: string | null,
  paymentAttemptId: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (orderId && paymentAttemptId) {
    updatePayload.order_id = orderId;
    updatePayload.payment_attempt_id = paymentAttemptId;
  }

  if (status === "succeeded") {
    updatePayload.response_payload = payload;
    updatePayload.completed_at = now;
  } else {
    const errorPayload = payload as PublicErrorBody;
    updatePayload.error_payload = errorPayload;
    updatePayload.last_error = errorPayload.error.message;
    if (status === "failed") {
      updatePayload.failed_at = now;
    }
  }

  const { data, error } = await supabase
    .from("access_checkout_idempotency_keys")
    .update(updatePayload)
    .eq("id", id)
    .eq("status", "processing")
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to close Access Core idempotency row: ${error.message}`);
  }

  if (!data?.id || data.status !== status) {
    throw new Error("Access Core idempotency row was not closed");
  }
}

async function finishBeforeProviderCall(
  id: string,
  status: number,
  body: PublicErrorBody,
  orderId: string | null,
  paymentAttemptId: string | null
): Promise<BancardSingleBuyResult> {
  try {
    await closeIdempotency(id, "failed", body, orderId, paymentAttemptId);
    return { status, body };
  } catch (error) {
    logger.error("Failed to close Access Core idempotency before provider call", {
      id,
      error: errorMessage(error),
    });
    return resultFromError("internal_error", "Internal error");
  }
}

async function closeAfterProviderCall(
  id: string,
  status: "failed" | "manual_review",
  body: PublicErrorBody,
  orderId: string,
  paymentAttemptId: string
): Promise<void> {
  try {
    await closeIdempotency(id, status, body, orderId, paymentAttemptId);
  } catch (error) {
    logger.error("Critical: failed to close Access Core idempotency after provider call", {
      id,
      status,
      orderId,
      paymentAttemptId,
      error: errorMessage(error),
    });
  }
}

async function createPaidCheckout(input: AccessBancardSingleBuyInput): Promise<PaidCheckoutRpcResult | null> {
  const { data, error } = await supabase.rpc("create_access_paid_checkout", {
    p_source_type: input.source_type,
    p_local_id: input.source_type === "local" ? input.local_id ?? null : null,
    p_event_id: input.source_type === "event" ? input.event_id ?? null : null,
    p_access_date: input.access_date,
    p_buyer: input.buyer,
    p_items: input.items,
    p_provider: PROVIDER,
    p_provider_operation: PROVIDER_OPERATION,
  });

  if (error) {
    logger.error("Failed to call create_access_paid_checkout", { error: error.message });
    return null;
  }

  return data as PaidCheckoutRpcResult;
}

async function getNextShopProcessId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("next_bancard_shop_process_id");

  if (error || typeof data !== "string" || !/^[0-9]{15}$/.test(data)) {
    logger.error("Failed to generate Bancard shop_process_id", {
      error: error?.message,
    });
    return null;
  }

  return data;
}

function buildUrls(config: BancardConfig, publicRef: string): { returnUrl: string; cancelUrl: string } {
  const ref = encodeURIComponent(publicRef);
  return {
    returnUrl: `${config.b2cBaseUrl}/payments/access/status?ref=${ref}`,
    cancelUrl: `${config.b2cBaseUrl}/payments/access/status?ref=${ref}&cancelled=1`,
  };
}

function buildBancardPayload(
  config: BancardConfig,
  checkout: PaidCheckoutRpcSuccess,
  shopProcessId: string
): { requestPayload: Record<string, unknown>; providerPayload: Record<string, unknown> } {
  const { returnUrl, cancelUrl } = buildUrls(config, checkout.public_ref);
  const description = "Tairet Ticket";
  const token = createHash("md5")
    .update(`${config.privateKey}${shopProcessId}${checkout.provider_amount_text}${checkout.currency}`)
    .digest("hex");

  const requestPayload = {
    public_key: config.publicKey,
    operation: {
      shop_process_id: shopProcessId,
      amount: checkout.provider_amount_text,
      currency: checkout.currency,
      description,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const providerPayload = {
    public_key: config.publicKey,
    operation: {
      token,
      shop_process_id: shopProcessId,
      amount: checkout.provider_amount_text,
      currency: checkout.currency,
      description,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  return { requestPayload, providerPayload };
}

async function assignShopProcessId(
  config: BancardConfig,
  checkout: PaidCheckoutRpcSuccess
): Promise<ShopProcessAssignment | null> {
  for (let attempt = 1; attempt <= MAX_SHOP_PROCESS_ID_RETRIES; attempt += 1) {
    const shopProcessId = await getNextShopProcessId();
    if (!shopProcessId) return null;

    const { requestPayload, providerPayload } = buildBancardPayload(config, checkout, shopProcessId);
    const { data, error } = await supabase
      .from("payment_attempts")
      .update({
        provider_attempt_ref: shopProcessId,
        request_payload: {
          provider: PROVIDER,
          provider_operation: PROVIDER_OPERATION,
          endpoint: `${config.baseUrl}/vpos/api/0.3/single_buy`,
          payload: requestPayload,
          environment: config.environment,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkout.payment_attempt_id)
      .eq("status", "created")
      .eq("provider", PROVIDER)
      .eq("provider_operation", PROVIDER_OPERATION)
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return { shopProcessId, requestPayload, providerPayload };
    }

    if (error?.code === "23505") {
      logger.warn("Bancard shop_process_id collision, retrying", { attempt });
      continue;
    }

    logger.error("Failed to persist Bancard shop_process_id", {
      paymentAttemptId: checkout.payment_attempt_id,
      error: error?.message,
    });
    return null;
  }

  logger.error("Could not assign Bancard shop_process_id after retries", {
    paymentAttemptId: checkout.payment_attempt_id,
  });
  return null;
}

async function updatePaymentAttemptStatus(
  paymentAttemptId: string,
  status: "provider_ready" | "technical_error" | "manual_review",
  responsePayload: unknown,
  message: string | null
): Promise<boolean> {
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status,
    response_payload: responsePayload,
    updated_at: now,
  };

  if (status === "provider_ready") {
    updatePayload.provider_ready_at = now;
  }

  if (status === "technical_error" && message) {
    updatePayload.last_error = message;
  }

  if (status === "manual_review" && message) {
    updatePayload.manual_review_reason = message;
  }

  const { data, error } = await supabase
    .from("payment_attempts")
    .update(updatePayload)
    .eq("id", paymentAttemptId)
    .eq("status", "created")
    .eq("provider", PROVIDER)
    .eq("provider_operation", PROVIDER_OPERATION)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    logger.error("Failed to update payment_attempt status", {
      paymentAttemptId,
      status,
      error: error?.message,
    });
    return false;
  }

  return true;
}

async function moveReservationsToManualHold(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("access_stock_reservations")
    .update({ status: "manual_hold" })
    .eq("order_id", orderId)
    .eq("status", "reserved");

  if (error) {
    logger.error("Failed to move Access Core reservations to manual_hold", {
      orderId,
      error: error.message,
    });
  }
}

async function callBancardSingleBuy(
  config: BancardConfig,
  providerPayload: Record<string, unknown>
): Promise<
  | { kind: "response"; httpStatus: number; body: unknown }
  | { kind: "timeout"; error: string }
  | { kind: "network_error"; error: string }
> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/vpos/api/0.3/single_buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(providerPayload),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    return {
      kind: "response",
      httpStatus: response.status,
      body: parseProviderResponseBody(bodyText),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return timedOut || (error instanceof Error && error.name === "AbortError")
      ? { kind: "timeout", error: message }
      : { kind: "network_error", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function extractBancardProcessId(body: unknown): string | null {
  return (
    readString(body, "process_id") ??
    readString(body, "processId") ??
    readNestedString(body, "operation", "process_id") ??
    readNestedString(body, "operation", "processId")
  );
}

function extractBancardStatus(body: unknown): string | null {
  return readString(body, "status")?.toLowerCase() ?? readNestedString(body, "operation", "status")?.toLowerCase() ?? null;
}

function publicSuccess(
  config: BancardConfig,
  checkout: PaidCheckoutRpcSuccess,
  shopProcessId: string,
  processId: string
): PublicSuccessBody {
  return {
    ok: true,
    public_ref: checkout.public_ref,
    expires_at: checkout.expires_at,
    amount_gs: checkout.amount_gs,
    currency: "PYG",
    provider_amount_text: checkout.provider_amount_text,
    provider: PROVIDER,
    provider_operation: PROVIDER_OPERATION,
    shop_process_id: shopProcessId,
    process_id: processId,
    iframe: {
      public_key: config.publicKey,
      process_id: processId,
    },
  };
}

export async function createAccessBancardSingleBuy(input: AccessBancardSingleBuyInput): Promise<BancardSingleBuyResult> {
  const config = getBancardConfig();
  if (!config) {
    return resultFromError("bancard_config_missing", "Bancard configuration is missing");
  }

  const requestHash = sha256Hex(normalizedRequestPayload(input));
  const idempotency = await createIdempotencyRow(input, requestHash);
  if ("status" in idempotency) {
    return idempotency;
  }

  const rpcResult = await createPaidCheckout(input);
  if (!rpcResult) {
    const body = publicError("internal_error", "Internal error");
    return finishBeforeProviderCall(idempotency.id, 500, body, null, null);
  }

  if (rpcResult.ok === false) {
    const body = rpcErrorToPublicError(rpcResult.error?.code, rpcResult.error?.message);
    return finishBeforeProviderCall(idempotency.id, statusForErrorCode(body.error.code), body, null, null);
  }

  const checkout = parsePaidCheckoutSuccess(rpcResult);
  if (!checkout || checkout.provider !== PROVIDER || checkout.provider_operation !== PROVIDER_OPERATION) {
    const body = publicError("internal_error", "Internal error");
    return finishBeforeProviderCall(idempotency.id, 500, body, null, null);
  }

  const assignment = await assignShopProcessId(config, checkout);
  if (!assignment) {
    const body = publicError("internal_error", "Internal error");
    const technicalErrorUpdated = await updatePaymentAttemptStatus(
      checkout.payment_attempt_id,
      "technical_error",
      null,
      body.error.message
    );

    if (!technicalErrorUpdated) {
      logger.error("Critical: failed to mark payment_attempt technical_error before Bancard call", {
        orderId: checkout.order_id,
        paymentAttemptId: checkout.payment_attempt_id,
      });
    }

    return finishBeforeProviderCall(
      idempotency.id,
      500,
      body,
      checkout.order_id,
      checkout.payment_attempt_id
    );
  }

  const providerResult = await callBancardSingleBuy(config, assignment.providerPayload);

  if (providerResult.kind !== "response") {
    const errorCode = providerResult.kind === "timeout" ? "bancard_timeout" : "bancard_ambiguous";
    const body = publicError(errorCode, providerResult.kind === "timeout" ? "Bancard request timed out" : "Bancard request is ambiguous");
    await updatePaymentAttemptStatus(checkout.payment_attempt_id, "manual_review", null, body.error.message);
    await moveReservationsToManualHold(checkout.order_id);
    await closeAfterProviderCall(
      idempotency.id,
      "manual_review",
      body,
      checkout.order_id,
      checkout.payment_attempt_id
    );
    return { status: 202, body };
  }

  const sanitizedResponse = {
    http_status: providerResult.httpStatus,
    body: sanitizeProviderPayload(providerResult.body),
  };
  const providerStatus = extractBancardStatus(providerResult.body);
  const processId = extractBancardProcessId(providerResult.body);

  if (providerResult.httpStatus >= 200 && providerResult.httpStatus < 300 && providerStatus === "success" && processId) {
    const body = publicSuccess(config, checkout, assignment.shopProcessId, processId);
    const updated = await updatePaymentAttemptStatus(checkout.payment_attempt_id, "provider_ready", sanitizedResponse, null);

    if (!updated) {
      const ambiguousBody = publicError("bancard_ambiguous", "Bancard response received but local update failed");
      await moveReservationsToManualHold(checkout.order_id);
      await closeAfterProviderCall(
        idempotency.id,
        "manual_review",
        ambiguousBody,
        checkout.order_id,
        checkout.payment_attempt_id
      );
      return { status: 202, body: ambiguousBody };
    }

    try {
      await closeIdempotency(idempotency.id, "succeeded", body, checkout.order_id, checkout.payment_attempt_id);
    } catch (error) {
      const ambiguousBody = publicError("bancard_ambiguous", "Bancard response received but idempotency close failed");
      logger.error("Critical: failed to close Access Core idempotency after Bancard success", {
        id: idempotency.id,
        orderId: checkout.order_id,
        paymentAttemptId: checkout.payment_attempt_id,
        error: errorMessage(error),
      });
      await closeAfterProviderCall(
        idempotency.id,
        "manual_review",
        ambiguousBody,
        checkout.order_id,
        checkout.payment_attempt_id
      );
      return {
        status: 202,
        body: ambiguousBody,
      };
    }

    return { status: 200, body };
  }

  const body = publicError("bancard_http_error", "Bancard request failed");
  const updated = await updatePaymentAttemptStatus(checkout.payment_attempt_id, "technical_error", sanitizedResponse, body.error.message);
  if (!updated) {
    const ambiguousBody = publicError("bancard_ambiguous", "Bancard response received but local update failed");
    await moveReservationsToManualHold(checkout.order_id);
    await closeAfterProviderCall(
      idempotency.id,
      "manual_review",
      ambiguousBody,
      checkout.order_id,
      checkout.payment_attempt_id
    );
    return { status: 202, body: ambiguousBody };
  }

  try {
    await closeIdempotency(idempotency.id, "failed", body, checkout.order_id, checkout.payment_attempt_id);
  } catch (error) {
    const ambiguousBody = publicError("bancard_ambiguous", "Bancard response received but idempotency close failed");
    logger.error("Critical: failed to close Access Core idempotency after Bancard error", {
      id: idempotency.id,
      orderId: checkout.order_id,
      paymentAttemptId: checkout.payment_attempt_id,
      error: errorMessage(error),
    });
    await closeAfterProviderCall(
      idempotency.id,
      "manual_review",
      ambiguousBody,
      checkout.order_id,
      checkout.payment_attempt_id
    );
    return {
      status: 202,
      body: ambiguousBody,
    };
  }

  return { status: 502, body };
}
