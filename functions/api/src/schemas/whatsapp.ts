import { z } from "zod";

export const whatsappClickSchema = z.object({
  local_id: z.string().uuid(),
  phone: z.string().optional(),
  source: z.string().optional(),
});

export type WhatsappClickInput = z.infer<typeof whatsappClickSchema>;
