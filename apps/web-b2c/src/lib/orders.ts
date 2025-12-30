// src/lib/orders.ts
import { getApiBase } from "@/lib/api";

export interface Order {
  id: string;
  local_id: string;
  checkin_token: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  payment_method: string | null;
  used_at: string | null;
  created_at: string;
}

/**
 * Obtiene historial de orders por email (endpoint público, sin login)
 */
export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const response = await fetch(
    `${getApiBase()}/public/orders?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData?.error || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Payload para crear una orden free_pass
 */
export interface CreateOrderPayload {
  local_id: string;
  quantity: number;
  total_amount: number;
  currency?: string;
  payment_method: "free_pass";
  customer_email: string;
  customer_name: string;
  customer_last_name: string;
  customer_phone: string;
  customer_document: string;
}

/**
 * Crea una orden (free_pass para MVP)
 */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const response = await fetch(`${getApiBase()}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    
    // Manejar errores de validación Zod (fieldErrors)
    if (errorData?.error?.fieldErrors) {
      const fieldErrors = errorData.error.fieldErrors;
      const messages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${(errors as string[]).join(", ")}`)
        .join("; ");
      throw new Error(messages || "Error de validación");
    }
    
    // Error genérico
    const message = typeof errorData?.error === "string" 
      ? errorData.error 
      : errorData?.error?.formErrors?.join(", ") || `Error ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
