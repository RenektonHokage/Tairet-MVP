import { z } from "zod";

export const promoUpsertSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  image_url: z.string().url(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type PromoUpsert = z.infer<typeof promoUpsertSchema>;

// Schema for PATCH - all fields optional
export const promoUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  image_url: z.string().url().optional(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type PromoUpdate = z.infer<typeof promoUpdateSchema>;

// Schema for reorder endpoint
export const promoReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type PromoReorder = z.infer<typeof promoReorderSchema>;
