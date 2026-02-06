import { z } from "zod";

export const calendarMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in format YYYY-MM"),
});

export const calendarDayQuerySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Day must be in format YYYY-MM-DD"),
});

export const updateCalendarDaySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Day must be in format YYYY-MM-DD"),
  is_open: z.boolean().optional(),
  note: z.string().max(200).nullable().optional(),
  // club_manual_tables: solo para clubs, entero no negativo
  club_manual_tables: z
    .number()
    .int("club_manual_tables debe ser un entero")
    .nonnegative("club_manual_tables debe ser >= 0")
    .optional(),
  // tables_whatsapp: solo para clubs, entero no negativo
  tables_whatsapp: z
    .number()
    .int("tables_whatsapp debe ser un entero")
    .nonnegative("tables_whatsapp debe ser >= 0")
    .optional(),
  // tables_tairet: solo para clubs, entero no negativo
  tables_tairet: z
    .number()
    .int("tables_tairet debe ser un entero")
    .nonnegative("tables_tairet debe ser >= 0")
    .optional(),
});

export type UpdateCalendarDay = z.infer<typeof updateCalendarDaySchema>;

