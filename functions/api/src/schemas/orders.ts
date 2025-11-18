import { z } from "zod";

export const createOrderSchema = z.object({
  local_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  total_amount: z.number().positive(),
  currency: z.string().default("PYG"),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
});

export type OrderCreate = z.infer<typeof createOrderSchema>;

