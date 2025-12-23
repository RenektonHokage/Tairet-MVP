import { z } from "zod";

export const createReservationSchema = z.object({
  local_id: z.string().uuid(),
  name: z.string().min(1),
  last_name: z.string().optional(), // Apellido opcional
  email: z.string().email(),
  phone: z.string().min(1),
  date: z.string().datetime(),
  guests: z.number().int().min(1),
  notes: z.string().optional(), // Comentario del cliente
  table_note: z.string().optional(), // Nota interna del local (opcional en creación)
});

export type ReservationCreate = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]).optional(),
  table_note: z.string().nullable().optional(), // Permite actualizar table_note independientemente del status
});

export type UpdateReservationStatus = z.infer<typeof updateReservationStatusSchema>;

