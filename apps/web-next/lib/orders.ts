import { apiGet, apiPost, apiPatch } from "./api";

export interface Order {
  id: string;
  local_id: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  payment_method?: string;
  transaction_id?: string;
  used_at?: string | null;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  local_id: string;
  quantity: number;
  total_amount: number;
  currency?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiPost<Order>("/orders", input);
}

export async function getOrder(id: string): Promise<Order> {
  return apiGet<Order>(`/orders/${id}`);
}

export async function useOrder(id: string): Promise<Order> {
  return apiPatch<Order>(`/orders/${id}/use`);
}

