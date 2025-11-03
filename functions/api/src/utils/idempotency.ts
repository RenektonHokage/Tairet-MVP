import { supabase } from "../services/supabase";

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

