import { z } from "zod";

export const createReservationSchema = z.object({
  local_id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  date: z.string().datetime(),
  guests: z.number().int().min(1),
  notes: z.string().optional(),
});

export type ReservationCreate = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
});

export type UpdateReservationStatus = z.infer<typeof updateReservationStatusSchema>;

