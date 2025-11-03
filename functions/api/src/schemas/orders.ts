import { z } from "zod";

export const createOrderSchema = z.object({
  localId: z.string().uuid(),
  quantity: z.number().int().min(1),
  // TODO: Agregar campos según schema.sql
});

export type OrderCreate = z.infer<typeof createOrderSchema>;

