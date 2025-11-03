import { z } from "zod";

export const createReservationSchema = z.object({
  localId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  date: z.string().datetime(),
  guests: z.number().int().min(1),
  // TODO: Agregar campos según schema.sql
});

export type ReservationCreate = z.infer<typeof createReservationSchema>;

