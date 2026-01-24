import { z } from "zod";

// Metadata opcional para tracking de mesas (enriquecer métricas)
const whatsappClickMetadataSchema = z.object({
  table_type_id: z.string().uuid().optional(),
  table_name: z.string().optional(),
  table_price: z.number().optional(),
}).optional();

export const whatsappClickSchema = z.object({
  local_id: z.string().uuid(),
  phone: z.string().optional(),
  source: z.string().optional(),
  metadata: whatsappClickMetadataSchema,
});

export type WhatsappClickInput = z.infer<typeof whatsappClickSchema>;
