import { z } from "zod";

export const createReservationSchema = z.object({
  local_id: z.string().uuid(),
  name: z.string().min(1),
  last_name: z.string().optional(), // Apellido opcional
  email: z.string().email(),
  phone: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  guests: z.number().int().min(1).max(15),
  notes: z.string().optional(), // Comentario del cliente
});

export type ReservationCreate = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  expected_status: z.enum(["en_revision", "confirmed"]).optional(),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  table_note: z.string().nullable().optional(), // Permite actualizar table_note independientemente del status
  cancel_reason: z.string().trim().min(1).refine(
    value => Array.from(value).length <= 160,
    "El motivo no puede superar los 160 caracteres."
  ).optional(),
});

export type UpdateReservationStatus = z.infer<typeof updateReservationStatusSchema>;

