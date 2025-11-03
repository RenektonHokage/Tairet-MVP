import { z } from "zod";

export const promoUpsertSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // TODO: Agregar campos según schema.sql
});

export type PromoUpsert = z.infer<typeof promoUpsertSchema>;

