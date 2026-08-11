import { createHash } from "node:crypto";

export type BancardConfirmSigningInput = Readonly<{
  shop_process_id: string | number;
  amount: string;
  currency: string;
}>;

export type CanonicalBancardConfirmSigningInput = Readonly<{
  shop_process_id: string;
  amount: string;
  currency: "PYG";
}>;

const DECIMAL_AMOUNT_PATTERN = /^[0-9]+\.[0-9]{2}$/;

function invalidInput(field: "signing_input" | "shop_process_id" | "amount" | "currency" | "private_key"): TypeError {
  return new TypeError(`invalid_${field}`);
}

function canonicalizeShopProcessId(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw invalidInput("shop_process_id");
    }

    return String(value);
  }

  if (typeof value !== "string") {
    throw invalidInput("shop_process_id");
  }

  const canonical = value.trim();
  if (canonical.length === 0) {
    throw invalidInput("shop_process_id");
  }

  return canonical;
}

function canonicalizeAmount(value: unknown): string {
  if (typeof value !== "string") {
    throw invalidInput("amount");
  }

  const canonical = value.trim();
  if (!DECIMAL_AMOUNT_PATTERN.test(canonical)) {
    throw invalidInput("amount");
  }

  return canonical;
}

function canonicalizeCurrency(value: unknown): "PYG" {
  if (typeof value !== "string" || value.trim() !== "PYG") {
    throw invalidInput("currency");
  }

  return "PYG";
}

export function canonicalizeBancardConfirmSigningInput(
  input: BancardConfirmSigningInput,
): CanonicalBancardConfirmSigningInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw invalidInput("signing_input");
  }

  return Object.freeze({
    shop_process_id: canonicalizeShopProcessId(input.shop_process_id),
    amount: canonicalizeAmount(input.amount),
    currency: canonicalizeCurrency(input.currency),
  });
}

function canonicalizePrivateKey(privateKey: string): string {
  if (typeof privateKey !== "string") {
    throw invalidInput("private_key");
  }

  const canonical = privateKey.trim();
  if (canonical.length === 0) {
    throw invalidInput("private_key");
  }

  return canonical;
}

export function signBancardConfirm(
  privateKey: string,
  input: BancardConfirmSigningInput,
): string {
  const canonicalInput = canonicalizeBancardConfirmSigningInput(input);
  const canonicalPrivateKey = canonicalizePrivateKey(privateKey);

  return createHash("md5")
    .update(canonicalPrivateKey, "utf8")
    .update(canonicalInput.shop_process_id, "utf8")
    .update("confirm", "utf8")
    .update(canonicalInput.amount, "utf8")
    .update(canonicalInput.currency, "utf8")
    .digest("hex");
}
