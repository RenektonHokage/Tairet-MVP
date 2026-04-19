import type {
  CalendarDay,
  CalendarDayResponse,
  CalendarMonthResponse,
  ReservationDetail,
} from "@/lib/calendar";
import type { DemoScenario } from "./runtime";

export interface DemoCalendarDayOverride {
  is_open?: boolean;
  note?: string | null;
  tables_whatsapp?: number;
  tables_tairet?: number;
}

const BAR_GUESTS = [
  ["Lucia", "Benitez"],
  ["Mateo", "Sosa"],
  ["Carla", "Rojas"],
  ["Diego", "Mendez"],
  ["Julia", "Fernandez"],
  ["Tomas", "Morinigo"],
];

const CLUB_LOCAL_ID = "demo-discoteca";
const BAR_LOCAL_ID = "demo-bar";

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, 1);
}

function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function getLocalId(scenario: DemoScenario): string {
  return scenario === "bar" ? BAR_LOCAL_ID : CLUB_LOCAL_ID;
}

function getBarNote(date: Date, isOpen: boolean): string | null {
  if (!isOpen) return "Descanso operativo";
  const weekday = date.getDay();
  if (weekday === 5) return "Happy hour extendido";
  if (weekday === 6) return "Sesion de cocteles + musica en vivo";
  if (weekday === 0) return "Cierre de semana con menu especial";
  if (date.getDate() % 9 === 0) return "Reserva corporativa destacada";
  return null;
}

function getClubNote(date: Date, isOpen: boolean): string | null {
  if (!isOpen) return null;
  const weekday = date.getDay();
  if (weekday === 4) return "Warm-up con lista anticipada";
  if (weekday === 5) return "Fiesta Neon";
  if (weekday === 6) return "DJ invitado + zona VIP completa";
  if (date.getDate() % 11 === 0) return "Evento privado parcial";
  return null;
}

function buildBaseDay(scenario: DemoScenario, date: Date): CalendarDay {
  const weekday = date.getDay();
  const dayNumber = date.getDate();
  const day = formatDateKey(date);

  if (scenario === "bar") {
    const isOpen = weekday !== 1;
    const reservationsTotal = !isOpen
      ? 0
      : weekday === 6
        ? 16 + (dayNumber % 5) * 2
        : weekday === 5
          ? 11 + (dayNumber % 4) * 2
          : weekday === 0
            ? 8 + (dayNumber % 3)
            : 3 + (dayNumber % 4);
    const reservationsInReview = reservationsTotal === 0 ? 0 : Math.min(2, 1 + (dayNumber % 2));
    const reservationsCancelled = reservationsTotal > 0 && dayNumber % 7 === 0 ? 1 : 0;
    const reservationsConfirmed = Math.max(
      reservationsTotal - reservationsInReview - reservationsCancelled,
      0,
    );

    return {
      day,
      reservations_total: reservationsTotal,
      reservations_en_revision: reservationsInReview,
      reservations_confirmed: reservationsConfirmed,
      reservations_cancelled: reservationsCancelled,
      orders_paid: reservationsTotal * 2 + (dayNumber % 3),
      promo_opens: reservationsTotal + 6 + (dayNumber % 4),
      is_open: isOpen,
      note: getBarNote(date, isOpen),
    };
  }

  const isOpen = weekday === 4 || weekday === 5 || weekday === 6;
  const baseOrders = !isOpen
    ? 0
    : weekday === 6
      ? 250 + (dayNumber % 5) * 22
      : weekday === 5
        ? 180 + (dayNumber % 5) * 18
        : 105 + (dayNumber % 4) * 14;
  const tablesWhatsapp = !isOpen
    ? 0
    : weekday === 6
      ? 10 + (dayNumber % 4)
      : weekday === 5
        ? 7 + (dayNumber % 3)
        : 4 + (dayNumber % 2);
  const tablesTairet = !isOpen
    ? 0
    : weekday === 6
      ? 6 + (dayNumber % 3)
      : weekday === 5
        ? 4 + (dayNumber % 3)
        : 2 + (dayNumber % 2);

  return {
    day,
    reservations_total: 0,
    reservations_en_revision: 0,
    reservations_confirmed: 0,
    reservations_cancelled: 0,
    orders_paid: baseOrders,
    promo_opens: !isOpen ? 0 : 35 + (dayNumber % 5) * 8,
    is_open: isOpen,
    note: getClubNote(date, isOpen),
    tables_whatsapp: tablesWhatsapp,
    tables_tairet: tablesTairet,
  };
}

function applyOverride(
  scenario: DemoScenario,
  baseDay: CalendarDay,
  override?: DemoCalendarDayOverride,
): CalendarDay {
  if (!override) {
    return baseDay;
  }

  const tablesWhatsapp =
    scenario === "discoteca"
      ? override.tables_whatsapp ?? baseDay.tables_whatsapp ?? 0
      : undefined;
  const tablesTairet =
    scenario === "discoteca"
      ? override.tables_tairet ?? baseDay.tables_tairet ?? 0
      : undefined;

  return {
    ...baseDay,
    is_open: override.is_open ?? baseDay.is_open,
    note: override.note !== undefined ? override.note : baseDay.note,
    tables_whatsapp: tablesWhatsapp,
    tables_tairet: tablesTairet,
  };
}

function buildBarReservations(dayKey: string, totalReservations: number): ReservationDetail[] {
  const visibleReservations = Math.min(Math.max(totalReservations, 0), 4);
  const baseDate = parseDayKey(dayKey);

  return Array.from({ length: visibleReservations }, (_, index) => {
    const guest = BAR_GUESTS[index % BAR_GUESTS.length];
    const reservationDate = new Date(baseDate);
    reservationDate.setHours(19 + index, index % 2 === 0 ? 0 : 30, 0, 0);

    return {
      id: `demo-bar-reservation-${dayKey}-${index}`,
      name: guest[0],
      last_name: guest[1],
      guests: 2 + (index % 3),
      date: reservationDate.toISOString(),
      status: index === 0 ? "confirmed" : index === visibleReservations - 1 ? "en_revision" : "confirmed",
      notes: index === 1 ? "Prefiere terraza" : undefined,
      table_note: index === 2 ? "Mesa alta junto a barra" : null,
      created_at: reservationDate.toISOString(),
    };
  });
}

function buildDayResponse(
  scenario: DemoScenario,
  day: CalendarDay,
): CalendarDayResponse {
  if (scenario === "bar") {
    const reservations = day.is_open
      ? buildBarReservations(day.day, Math.max(2, Math.min(day.reservations_total, 4)))
      : [];

    return {
      local_id: BAR_LOCAL_ID,
      local_type: "bar",
      day: day.day,
      operation: {
        is_open: day.is_open,
        note: day.note ?? null,
        club_manual_tables: 0,
      },
      reservations,
      reservations_total: reservations.length,
      checkins_count: 0,
      orders_summary: {
        count: day.orders_paid,
        total: day.orders_paid * 68000,
      },
    };
  }

  const tablesWhatsapp = day.tables_whatsapp ?? 0;
  const tablesTairet = day.tables_tairet ?? 0;
  const clubManualTables = tablesWhatsapp + tablesTairet;

  return {
    local_id: CLUB_LOCAL_ID,
    local_type: "club",
    day: day.day,
    operation: {
      is_open: day.is_open,
      note: day.note ?? null,
      club_manual_tables: clubManualTables,
      tables_whatsapp: tablesWhatsapp,
      tables_tairet: tablesTairet,
    },
    reservations: [],
    reservations_total: 0,
    checkins_count: day.is_open ? Math.round(day.orders_paid * 0.82 + clubManualTables * 3.5) : 0,
    orders_summary: {
      count: day.orders_paid,
      total: day.orders_paid * 62000,
    },
  };
}

export function getPanelDemoCalendarMonth(
  scenario: DemoScenario,
  monthKey: string,
  overrides: Record<string, DemoCalendarDayOverride> = {},
): CalendarMonthResponse {
  const monthDate = parseMonthKey(monthKey);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const baseDay = buildBaseDay(scenario, date);
    return applyOverride(scenario, baseDay, overrides[baseDay.day]);
  });

  return {
    local_id: getLocalId(scenario),
    month: monthKey,
    days,
  };
}

export function getPanelDemoCalendarDay(
  scenario: DemoScenario,
  dayKey: string,
  overrides: Record<string, DemoCalendarDayOverride> = {},
): CalendarDayResponse {
  const baseDay = buildBaseDay(scenario, parseDayKey(dayKey));
  const nextDay = applyOverride(scenario, baseDay, overrides[dayKey]);
  return buildDayResponse(scenario, nextDay);
}
