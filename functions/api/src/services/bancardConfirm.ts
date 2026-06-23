import { createHash, timingSafeEqual } from "node:crypto";
import { sendAccessOrderEntriesEmail } from "./accessEmails";
import { supabase } from "./supabase";
import { logger } from "../utils/logger";
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

function result(status: number, body: BancardConfirmHttpBody): BancardConfirmResult {
  return { status, body };
}

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
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

async function issueEntriesForApprovedPayment(input: {
  rpcResult: ConfirmRpcResult;
  shopProcessId: string;
  responseCode: string;
}): Promise<BancardConfirmResult | null> {
  const orderId = input.rpcResult.order_id;
  const paymentAttemptId = input.rpcResult.payment_attempt_id;
  const publicRef = input.rpcResult.public_ref;

  if (!orderId || !paymentAttemptId) {
    logger.error("Bancard confirm approved response missing entry issue identifiers", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      rpcStatus: input.rpcResult.status,
    });
    return result(500, ERROR_BODY);
  }

  const { data, error } = await supabase.rpc("issue_access_entries_for_paid_order", {
    p_order_id: orderId,
    p_payment_attempt_id: paymentAttemptId,
  });

  if (error) {
    logger.error("Failed to call Access Core entry issue RPC", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef,
      errorCode: error.code,
      error: error.message,
    });
    return result(500, ERROR_BODY);
  }

  if (!isRecord(data)) {
    logger.error("Unexpected Access Core entry issue RPC response", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef,
    });
    return result(500, ERROR_BODY);
  }

  const issueResult = data as IssueEntriesRpcResult;
  if (issueResult.ok !== true || issueResult.status !== "issued") {
    logger.error("Access Core entry issue RPC failed", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef: readStringField(data, "public_ref") ?? publicRef,
      errorCode: readNestedErrorCode(data),
    });
    return result(500, ERROR_BODY);
  }

  try {
    const emailResult = await sendAccessOrderEntriesEmail({
      orderId,
      publicRef: readStringField(data, "public_ref") ?? publicRef,
    });
    const emailLogPayload = {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef: readStringField(data, "public_ref") ?? publicRef,
      emailStatus: emailResult.status,
      entriesClaimed: emailResult.entriesClaimed,
      entriesSent: emailResult.entriesSent,
      errorCode: emailResult.errorCode,
    };

    if (emailResult.ok) {
      logger.info("Access Core entries email handled after Bancard confirm", emailLogPayload);
    } else if (
      emailResult.errorCode === "email_sent_update_failed"
      || emailResult.errorCode === "email_sent_partial_update_failed"
    ) {
      logger.error("Access Core entries email sent but status update failed after Bancard confirm", emailLogPayload);
    } else {
      logger.warn("Access Core entries email failed after Bancard confirm", emailLogPayload);
    }
  } catch (emailError) {
    logger.error("Unexpected Access Core entries email failure after Bancard confirm", {
      shopProcessId: input.shopProcessId,
      responseCode: input.responseCode,
      publicRef: readStringField(data, "public_ref") ?? publicRef,
      errorCode: "access_email_unexpected_error",
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  }

  logger.info("Access Core entries issued after Bancard confirm", {
    shopProcessId: input.shopProcessId,
    responseCode: input.responseCode,
    publicRef: readStringField(data, "public_ref") ?? publicRef,
    entriesInserted: readNumberField(data, "inserted_entries"),
    entriesTotal: readNumberField(data, "total_entries"),
    entriesIdempotent: issueResult.idempotent === true,
  });

  return null;
}

async function mapRpcResult(
  data: unknown,
  shopProcessId: string,
  responseCode: string
): Promise<BancardConfirmResult> {
  if (!isRecord(data)) {
    logger.error("Unexpected Bancard confirm RPC response", {
      shopProcessId,
      responseCode,
    });
    return result(500, ERROR_BODY);
  }

  const rpcResult = data as ConfirmRpcResult;
  if (rpcResult.ok === true) {
    if (!["approved", "rejected", "manual_review"].includes(rpcResult.status ?? "")) {
      logger.error("Unexpected Bancard confirm RPC success status", {
        shopProcessId,
        responseCode,
        rpcStatus: rpcResult.status,
      });
      return result(500, ERROR_BODY);
    }

    if (rpcResult.status === "approved") {
      const issueErrorResult = await issueEntriesForApprovedPayment({
        rpcResult,
        shopProcessId,
        responseCode,
      });

      if (issueErrorResult) {
        return issueErrorResult;
      }
    }

    logger.info("Bancard confirm callback processed", {
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
    logger.warn("Bancard confirm RPC rejected invalid request", {
      shopProcessId,
      responseCode,
      errorCode,
    });
    return result(400, ERROR_BODY);
  }

  if (rpcResult.ok === false && errorCode === "payment_attempt_not_found") {
    logger.error("Critical: Bancard confirm payment_attempt_not_found", {
      shopProcessId,
      responseCode,
      errorCode,
    });
    return result(409, ERROR_BODY);
  }

  logger.error("Bancard confirm RPC returned unexpected failure", {
    shopProcessId,
    responseCode,
    errorCode,
  });
  return result(500, ERROR_BODY);
}

export async function confirmBancardAccessPayment(
  input: BancardConfirmInput
): Promise<BancardConfirmResult> {
  const privateKey = getTrimmedEnv("BANCARD_PRIVATE_KEY");
  const { operation } = input;

  if (!privateKey) {
    logger.error("Bancard confirm configuration is missing", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
    });
    return result(500, ERROR_BODY);
  }

  if (!isValidConfirmToken(input, privateKey)) {
    logger.warn("Invalid Bancard confirm token", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
    });
    return result(401, ERROR_BODY);
  }

  const callbackPayload = sanitizeBancardConfirmPayload(operation);
  const { data, error } = await supabase.rpc("confirm_bancard_access_payment", {
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

  if (error) {
    logger.error("Failed to call Bancard confirm RPC", {
      shopProcessId: operation.shop_process_id,
      responseCode: operation.response_code,
      errorCode: error.code,
      error: error.message,
    });
    return result(500, ERROR_BODY);
  }

  return mapRpcResult(data, operation.shop_process_id, operation.response_code);
}
