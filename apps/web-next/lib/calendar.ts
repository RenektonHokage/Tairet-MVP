import { apiGetWithAuth, apiPatchWithAuth } from "./api";

export interface CalendarDay {
  day: string;
  reservations_total: number;
  reservations_en_revision: number;
  reservations_confirmed: number;
  reservations_cancelled: number;
  orders_paid: number;
  promo_opens: number;
  is_open: boolean;
  note: string | null;
}

export interface CalendarMonthResponse {
  local_id: string;
  month: string;
  days: CalendarDay[];
}

export interface ReservationDetail {
  id: string;
  name: string;
  last_name?: string;
  guests: number;
  date: string;
  status: "en_revision" | "confirmed" | "cancelled";
  notes?: string;
  table_note?: string | null;
  created_at: string;
}

export interface CalendarDayResponse {
  local_id: string;
  local_type: "bar" | "club";
  day: string;
  operation: {
    is_open: boolean;
    note: string | null;
    club_manual_tables: number;
  };
  // Bar-specific
  reservations: ReservationDetail[];
  reservations_total: number;
  // Club-specific
  checkins_count: number;
  // General summary
  orders_summary: {
    count: number;
    total: number;
  };
}

export interface UpdateCalendarDayInput {
  day: string;
  is_open?: boolean;
  note?: string | null;
  club_manual_tables?: number;
}

/**
 * Obtiene el calendario mensual con actividad por día
 */
export async function getCalendarMonth(month: string): Promise<CalendarMonthResponse> {
  return apiGetWithAuth<CalendarMonthResponse>(`/panel/calendar/month?month=${month}`);
}

/**
 * Obtiene el detalle de un día específico
 */
export async function getCalendarDay(day: string): Promise<CalendarDayResponse> {
  return apiGetWithAuth<CalendarDayResponse>(`/panel/calendar/day?day=${day}`);
}

/**
 * Actualiza la operación de un día (is_open y/o note)
 */
export async function updateCalendarDay(
  input: UpdateCalendarDayInput
): Promise<{ day: string; is_open: boolean; note: string | null }> {
  return apiPatchWithAuth<{ day: string; is_open: boolean; note: string | null }>(
    "/panel/calendar/day",
    input
  );
}

