import { createHash, timingSafeEqual } from "node:crypto";
import {
  AccessFulfillmentConfigError,
  loadLegacyDirectEmailEnabled,
  type AccessFulfillmentEnv,
} from "../config/accessFulfillment";
import { logger as defaultLogger } from "../utils/logger";
import type { BancardConfirmInput } from "../schemas/bancardConfirm";

type BancardConfirmHttpBody = {
  status: "success" | "error";
};

export interface BancardConfirmResult {
  status: number;
  body: BancardConfirmHttpBody;
}

interface ConfirmRpcError {
  code?: string;
  message?: string;
}

type BancardConfirmRpcName =
  | "confirm_bancard_access_payment"
  | "issue_access_entries_for_paid_order";

interface BancardConfirmRpcResponse {
  data: unknown;
  error: ConfirmRpcError | null;
}

type BancardConfirmRpc = (
  name: BancardConfirmRpcName,
  parameters: Record<string, unknown>,
) => Promise<BancardConfirmRpcResponse>;

type LegacyEmailSender =
  typeof import("./accessEmails").sendAccessOrderEntriesEmail;

interface BancardConfirmLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface BancardConfirmDependencies {
  readonly env?: AccessFulfillmentEnv;
  readonly rpc?: BancardConfirmRpc;
  readonly logger?: BancardConfirmLogger;
  readonly loadLegacyEmailSender?: () => Promise<LegacyEmailSender>;
}

interface BancardConfirmExecutionContext {
  readonly legacyDirectEmailEnabled: boolean;
  readonly rpc: BancardConfirmRpc;
  readonly logger: BancardConfirmLogger;
  readonly loadLegacyEmailSender: () => Promise<LegacyEmailSender>;
}

interface ConfirmRpcResult {
  ok?: boolean;
  status?: string;
  idempotent?: boolean;
  manual_review?: boolean;
  order_id?: string;
  payment_attempt_id?: string;
  public_ref?: string;
  error?: ConfirmRpcError;
}

interface IssueEntriesRpcResult {
  ok?: boolean;
  status?: string;
  public_ref?: string;
  expected_entries?: number;
  existing_entries_before?: number;
  inserted_entries?: number;
  total_entries?: number;
  idempotent?: boolean;
  error?: ConfirmRpcError;
}

const SUCCESS_BODY: BancardConfirmHttpBody = { status: "success" };
const ERROR_BODY: BancardConfirmHttpBody = { status: "error" };

async function defaultBancardConfirmRpc(
  name: BancardConfirmRpcName,
  parameters: Record<string, unknown>,
): Promise<BancardConfirmRpcResponse> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase.rpc(name, parameters);
  return { data, error };
}

async function defaultLoadLegacyEmailSender(): Promise<LegacyEmailSender> {
  const { sendAccessOrderEntriesEmail } = await import("./accessEmails");
  return sendAccessOrderEntriesEmail;
}

function result(status: number, body: BancardConfirmHttpBody): BancardConfirmResult {
  return { status, body };
}

function getTrimmedEnv(env: AccessFulfillmentEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readNestedErrorCode(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.error)) return null;
  return typeof data.error.code === "string" ? data.error.code : null;
}

function readStringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumberField(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function md5Hex(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function isValidConfirmToken(input: BancardConfirmInput, privateKey: string): boolean {
  const { operation } = input;
  const expectedToken = md5Hex(
    `${privateKey}${operation.shop_process_id}confirm${operation.amount}${operation.currency}`
  );

  const expectedBuffer = Buffer.from(expectedToken, "hex");
  const receivedBuffer = Buffer.from(operation.token, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function addOptional(payload: Record<string, unknown>, key: string, value: string | null): void {
  if (value !== null) {
    payload[key] = value;
  }
}

function sanitizeBancardConfirmPayload(
  operation: BancardConfirmInput["operation"]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    shop_process_id: operation.shop_process_id,
    amount: operation.amount,
    currency: operation.currency,
    response_code: operation.response_code,
    received_at: new Date().toISOString(),
  };

  addOptional(payload, "response", operation.response);
  addOptional(payload, "response_details", operation.response_details);
  addOptional(payload, "extended_response_description", operation.extended_response_description);
  addOptional(payload, "iva_amount", operation.iva_amount);
  addOptional(payload, "authorization_number", operation.authorization_number);
  addOptional(payload, "ticket_number", operation.ticket_number);
  addOptional(payload, "response_description", operation.response_description);

  return payload;
}

async function issueEntriesForApprovedPayment(
  input: {
    rpcResult: ConfirmRpcResult;
    shopProcessId: string;
    responseCode: string;
  },
  context: BancardConfirmExecutionContext,
): Promise<BancardConfirmResult | null> {
  const orderId = input.rpcResult.order_id;
  const paymentAttemptId = input.rpcResult.payment_attempt_id;
  const publicRef = input.rpcResult.public_ref;

  if (!orderId || !paymentAttemptId) {
    context.logger.error("Bancard confirm approved response missing entry issue identifiers", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      rpcStatus: input.rpcResult.status,
    });
    return result(500, ERROR_BODY);
  }

  let rpcResponse: BancardConfirmRpcResponse;
  try {
    rpcResponse = await context.rpc("issue_access_entries_for_paid_order", {
      p_order_id: orderId,
      p_payment_attempt_id: paymentAttemptId,
    });
  } catch {
    context.logger.error("Failed to call Access Core entry issue RPC", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef,
      errorCode: "rpc_transport_error",
    });
    return result(500, ERROR_BODY);
  }
  const { data, error } = rpcResponse;

  if (error) {
    context.logger.error("Failed to call Access Core entry issue RPC", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef,
      errorCode: error.code,
    });
    return result(500, ERROR_BODY);
  }

  if (!isRecord(data)) {
    context.logger.error("Unexpected Access Core entry issue RPC response", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef,
    });
    return result(500, ERROR_BODY);
  }

  const issueResult = data as IssueEntriesRpcResult;
  if (issueResult.ok !== true || issueResult.status !== "issued") {
    context.logger.error("Access Core entry issue RPC failed", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef: readStringField(data, "public_ref") ?? publicRef,
      errorCode: readNestedErrorCode(data),
    });
    return result(500, ERROR_BODY);
  }

  const issuedPublicRef = readStringField(data, "public_ref") ?? publicRef;
  if (!context.legacyDirectEmailEnabled) {
    context.logger.info(
      "Access Core legacy entries email skipped by authority gate after Bancard confirm",
      {
        shopProcessId: input.shopProcessId,
        responseCode: input.responseCode,
        publicRef: issuedPublicRef,
        errorCode: "legacy_email_authority_disabled",
      },
    );
  } else {
    try {
      const sendAccessOrderEntriesEmail =
        await context.loadLegacyEmailSender();
      const emailResult = await sendAccessOrderEntriesEmail({
        orderId,
        publicRef: issuedPublicRef,
      });
      const emailLogPayload = {
        shopProcessId: input.shopProcessId,
        responseCode: input.responseCode,
        publicRef: issuedPublicRef,
        emailStatus: emailResult.status,
        entriesClaimed: emailResult.entriesClaimed,
        entriesSent: emailResult.entriesSent,
        errorCode: emailResult.errorCode,
      };

      if (emailResult.ok) {
        context.logger.info(
          "Access Core entries email handled after Bancard confirm",
          emailLogPayload,
        );
      } else if (
        emailResult.errorCode === "email_sent_update_failed"
        || emailResult.errorCode === "email_sent_partial_update_failed"
      ) {
        context.logger.error(
          "Access Core entries email sent but status update failed after Bancard confirm",
          emailLogPayload,
        );
      } else {
        context.logger.warn(
          "Access Core entries email failed after Bancard confirm",
          emailLogPayload,
        );
      }
    } catch {
      context.logger.error(
        "Unexpected Access Core entries email failure after Bancard confirm",
        {
          shopProcessId: input.shopProcessId,
          responseCode: input.responseCode,
          publicRef: issuedPublicRef,
          errorCode: "access_email_unexpected_error",
        },
      );
    }
  }

  context.logger.info("Access Core entries issued after Bancard confirm", {
    shopProcessId: input.shopProcessId,
    responseCode: input.responseCode,
    publicRef: issuedPublicRef,
    entriesInserted: readNumberField(data, "inserted_entries"),
    entriesTotal: readNumberField(data, "total_entries"),
    entriesIdempotent: issueResult.idempotent === true,
  });

  return null;
}

async function mapRpcResult(
  data: unknown,
  shopProcessId: string,
  responseCode: string,
  context: BancardConfirmExecutionContext,
): Promise<BancardConfirmResult> {
  if (!isRecord(data)) {
    context.logger.error("Unexpected Bancard confirm RPC response", {
      shopProcessId,
      responseCode,
    });
    return result(500, ERROR_BODY);
  }

  const rpcResult = data as ConfirmRpcResult;
  if (rpcResult.ok === true) {
    if (!["approved", "rejected", "manual_review"].includes(rpcResult.status ?? "")) {
      context.logger.error("Unexpected Bancard confirm RPC success status", {
        shopProcessId,
        responseCode,
        rpcStatus: rpcResult.status,
      });
      return result(500, ERROR_BODY);
    }

    if (rpcResult.status === "approved") {
      const issueErrorResult = await issueEntriesForApprovedPayment(
        {
          rpcResult,
          shopProcessId,
          responseCode,
        },
        context,
      );

      if (issueErrorResult) {
        return issueErrorResult;
      }
    }

    context.logger.info("Bancard confirm callback processed", {
      shopProcessId,
      responseCode,
      rpcStatus: rpcResult.status,
      manualReview: rpcResult.manual_review === true,
      idempotent: rpcResult.idempotent === true,
    });
    return result(200, SUCCESS_BODY);
  }

  const errorCode = readNestedErrorCode(data);
  if (rpcResult.ok === false && errorCode === "invalid_request") {
    context.logger.warn("Bancard confirm RPC rejected invalid request", {
      shopProcessId,
      responseCode,
      errorCode,
    });
    return result(400, ERROR_BODY);
  }

  if (rpcResult.ok === false && errorCode === "payment_attempt_not_found") {
    context.logger.error("Critical: Bancard confirm payment_attempt_not_found", {
      shopProcessId,
      responseCode,
      errorCode,
    });
    return result(409, ERROR_BODY);
  }

  context.logger.error("Bancard confirm RPC returned unexpected failure", {
    shopProcessId,
    responseCode,
    errorCode,
  });
  return result(500, ERROR_BODY);
}

export async function confirmBancardAccessPayment(
  input: BancardConfirmInput,
  dependencies: BancardConfirmDependencies = {},
): Promise<BancardConfirmResult> {
  const env = dependencies.env ?? process.env;
  const callbackLogger = dependencies.logger ?? defaultLogger;
  const privateKey = getTrimmedEnv(env, "BANCARD_PRIVATE_KEY");
  const { operation } = input;

  if (!privateKey) {
    callbackLogger.error("Bancard confirm configuration is missing", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
    });
    return result(500, ERROR_BODY);
  }

  if (!isValidConfirmToken(input, privateKey)) {
    callbackLogger.warn("Invalid Bancard confirm token", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
    });
    return result(401, ERROR_BODY);
  }

  let legacyDirectEmailEnabled: boolean;
  try {
    legacyDirectEmailEnabled = loadLegacyDirectEmailEnabled(env);
  } catch (error) {
    const field =
      error instanceof AccessFulfillmentConfigError
        ? error.field
        : "ACCESS_LEGACY_DIRECT_EMAIL_ENABLED";
    callbackLogger.error(
      "Bancard confirm legacy email authority configuration is invalid",
      {
        shopProcessId: operation.shop_process_id,
        responseCode: operation.response_code,
        errorCode: "invalid_access_fulfillment_configuration",
        field,
      },
    );
    return result(500, ERROR_BODY);
  }

  const context: BancardConfirmExecutionContext = Object.freeze({
    legacyDirectEmailEnabled,
    rpc: dependencies.rpc ?? defaultBancardConfirmRpc,
    logger: callbackLogger,
    loadLegacyEmailSender:
      dependencies.loadLegacyEmailSender ?? defaultLoadLegacyEmailSender,
  });

  const callbackPayload = sanitizeBancardConfirmPayload(operation);
  let rpcResponse: BancardConfirmRpcResponse;
  try {
    rpcResponse = await context.rpc("confirm_bancard_access_payment", {
      p_shop_process_id: operation.shop_process_id,
      p_amount: operation.amount,
      p_currency: operation.currency,
      p_response: operation.response,
      p_response_code: operation.response_code,
      p_response_details: operation.response_details,
      p_response_description: operation.response_description,
      p_authorization_number: operation.authorization_number,
      p_ticket_number: operation.ticket_number,
      p_callback_payload: callbackPayload,
    });
  } catch {
    callbackLogger.error("Failed to call Bancard confirm RPC", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
      errorCode: "rpc_transport_error",
    });
    return result(500, ERROR_BODY);
  }
  const { data, error } = rpcResponse;

  if (error) {
    callbackLogger.error("Failed to call Bancard confirm RPC", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
      errorCode: error.code,
    });
    return result(500, ERROR_BODY);
  }

  return mapRpcResult(
    data,
    operation.shop_process_id,
    operation.response_code,
    context,
  );
}
