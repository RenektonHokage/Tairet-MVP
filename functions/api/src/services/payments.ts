import { supabase } from "./supabase";

// Interfaz genérica para callbacks de pagos (Bancard/Dinelco)
export interface PaymentCallback {
  orderId: string;
  transactionId: string;
  status: "approved" | "rejected" | "pending";
  amount: number;
  currency: string;
  signature?: string;
}

export async function handlePaymentCallback(
  callback: PaymentCallback
): Promise<void> {
  // TODO: Verificar idempotencia usando payment_events
  // TODO: Validar firma si aplica
  // TODO: Actualizar order con estado de pago
  // TODO: Enviar email de confirmación si aprobado
  
  const { orderId, transactionId, status } = callback;
  
  // Verificar idempotencia (tabla payment_events con unique index)
  const { data: existing } = await supabase
    .from("payment_events")
    .select("id")
    .eq("transaction_id", transactionId)
    .single();

  if (existing) {
    // Ya procesado, retornar sin error (idempotencia)
    return;
  }

  // Registrar evento
  await supabase.from("payment_events").insert({
    order_id: orderId,
    transaction_id: transactionId,
    status,
    payload: callback,
  });

  // TODO: Actualizar order
  // await supabase.from("orders").update({ ... }).eq("id", orderId);
}

