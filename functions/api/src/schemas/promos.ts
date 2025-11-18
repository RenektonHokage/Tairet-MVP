import { z } from "zod";

export const promoUpsertSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  image_url: z.string().url(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type PromoUpsert = z.infer<typeof promoUpsertSchema>;

