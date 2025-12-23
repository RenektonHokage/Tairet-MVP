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
});

export type UpdateCalendarDay = z.infer<typeof updateCalendarDaySchema>;

