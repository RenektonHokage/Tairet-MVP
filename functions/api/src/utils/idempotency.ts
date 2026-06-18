import { createHash } from "node:crypto";
import { supabase } from "../services/supabase";

function normalizeForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableJson(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForStableJson(record[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalizeForStableJson(value));
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/**
 * Verifica si un evento de pago ya fue procesado (idempotencia)
 */
export async function isPaymentEventProcessed(
  transactionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("payment_events")
    .select("id")
    .eq("transaction_id", transactionId)
    .single();

  return !!data;
}

