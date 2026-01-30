import type { Reservation } from "./reservations";
import type { ActivityItem } from "./activity";

/**
 * Helpers puros para derivar métricas de dashboard sin IO
 */

export type RangeDays = 7 | 30;
export type RangeValue = "7d" | "30d";

/**
 * Convierte RangeDays a label legible
 */
export function rangeLabel(range: RangeDays | RangeValue): string {
  if (range === 7 || range === "7d") return "Últimos 7 días";
  return "Últimos 30 días";
}

/**
 * Convierte RangeValue string a RangeDays number
 */
export function rangeValueToDays(value: RangeValue): RangeDays {
  return value === "7d" ? 7 : 30;
}

/**
 * Convierte RangeDays number a RangeValue string
 */
export function daysToRangeValue(days: RangeDays): RangeValue {
  return days === 7 ? "7d" : "30d";
}

/**
 * Verifica si una serie temporal tiene datos significativos (al menos un punto > 0)
 */
export function hasTimeSeriesData<T extends { value?: number }>(data: T[]): boolean {
  return data.some((point) => (point.value ?? 0) > 0);
}

/**
 * Verifica si una serie de tendencia tiene datos significativos
 */
export function hasTrendData(data: Array<{ vendidas?: number; usadas?: number }>): boolean {
  return data.some((point) => (point.vendidas ?? 0) > 0 || (point.usadas ?? 0) > 0);
}

// =============================================================================
// Filtros de fecha
// =============================================================================

/**
 * Filtra items por rango de días desde hoy
 */
export function filterByDaysAgo<T extends { date?: string; timestamp?: string; created_at?: string }>(
  items: T[],
  days: RangeDays
): T[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  return items.filter((item) => {
    const dateStr = item.date || item.timestamp || item.created_at;
    if (!dateStr) return false;
    const itemDate = new Date(dateStr);
    return itemDate >= cutoff;
  });
}

/**
 * Cuenta eventos de activity por tipo dentro del rango
 */
export function countActivityByType(
  activityItems: ActivityItem[],
  type: ActivityItem["type"],
  days: RangeDays
): number {
  const filtered = filterByDaysAgo(activityItems, days);
  return filtered.filter((item) => item.type === type).length;
}

// =============================================================================
// Agrupación por semanas
// =============================================================================

interface WeeklyReservationData {
  label: string;
  confirmadas: number;
  canceladas: number;
  pendientes: number;
}

/**
 * Agrupa reservations por semana (últimas 4 semanas) y por status
 */
export function groupReservationsByWeek(
  reservations: Reservation[],
  days: RangeDays = 30
): WeeklyReservationData[] {
  const filtered = filterByDaysAgo(reservations, days);
  const now = new Date();
  const weeks: WeeklyReservationData[] = [];

  if (days === 7) {
    // Para 7d, mostrar por día
    const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayReservations = filtered.filter((r) => {
        const created = new Date(r.created_at);
        return created >= dayStart && created < dayEnd;
      });

      weeks.push({
        label: dayLabels[6 - i] || `Día ${7 - i}`,
        confirmadas: dayReservations.filter((r) => r.status === "confirmed").length,
        canceladas: dayReservations.filter((r) => r.status === "cancelled").length,
        pendientes: dayReservations.filter((r) => r.status === "en_revision").length,
      });
    }
  } else {
    // Para 30d, mostrar por semana
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekReservations = filtered.filter((r) => {
        const created = new Date(r.created_at);
        return created >= weekStart && created < weekEnd;
      });

      weeks.push({
        label: `Sem ${4 - i}`,
        confirmadas: weekReservations.filter((r) => r.status === "confirmed").length,
        canceladas: weekReservations.filter((r) => r.status === "cancelled").length,
        pendientes: weekReservations.filter((r) => r.status === "en_revision").length,
      });
    }
  }

  return weeks;
}

// =============================================================================
// KPIs filtrados por rango
// =============================================================================

export interface FilteredBarKpis {
  total: number;
  confirmed: number;
  enRevision: number;
}

/**
 * Calcula KPIs de reservas filtrados por rango
 */
export function calculateFilteredBarKpis(
  reservations: Reservation[],
  days: RangeDays
): FilteredBarKpis {
  const filtered = filterByDaysAgo(reservations, days);
  return {
    total: filtered.length,
    confirmed: filtered.filter((r) => r.status === "confirmed").length,
    enRevision: filtered.filter((r) => r.status === "en_revision").length,
  };
}

// =============================================================================
// Métricas de resumen para Bar
// =============================================================================

export interface BarSummaryMetrics {
  conversionRate: string;
  weeklyAverage: string;
  avgPersons: string;
}

/**
 * Formatea un número con máximo 1 decimal (entero si es .0)
 */
function formatOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

/**
 * Calcula métricas de resumen para Bar usando KPIs del backend
 * (No depende de reservations[] para el total)
 */
export function calculateBarSummaryFromKpis(
  reservationsTotal: number,
  profileViews: number,
  days: RangeDays,
  avgPartySizeConfirmed?: number | null
): BarSummaryMetrics {
  // Conversion rate
  const conversionRate =
    profileViews > 0 ? ((reservationsTotal / profileViews) * 100).toFixed(2) : "0";

  // Weekly average
  const weeks = days === 30 ? 4 : 1;
  const weeklyAvg = (reservationsTotal / weeks).toFixed(2);

  // Promedio de personas: usar valor del backend o indicar que no hay datos
  const avgPersons =
    avgPartySizeConfirmed != null ? formatOneDecimal(avgPartySizeConfirmed) : null;

  return {
    conversionRate: `${conversionRate}%`,
    weeklyAverage: `${weeklyAvg} reservas`,
    avgPersons: avgPersons ?? "—",
  };
}

/**
 * Calcula métricas de resumen para Bar (legacy, usa reservations[])
 * @deprecated Usar calculateBarSummaryFromKpis cuando sea posible
 */
export function calculateBarSummary(
  reservations: Reservation[],
  profileViews: number,
  days: RangeDays
): BarSummaryMetrics {
  const filtered = filterByDaysAgo(reservations, days);
  const total = filtered.length;

  // Conversion rate
  const conversionRate =
    profileViews > 0 ? ((total / profileViews) * 100).toFixed(2) : "0";

  // Weekly average
  const weeks = days === 30 ? 4 : 1;
  const weeklyAvg = (total / weeks).toFixed(2);

  // Average persons per reservation
  const totalPersons = filtered.reduce((sum, r) => sum + r.guests, 0);
  const avgPersons = total > 0 ? (totalPersons / total).toFixed(1) : "0";

  return {
    conversionRate: `${conversionRate}%`,
    weeklyAverage: `${weeklyAvg} reservas`,
    avgPersons,
  };
}

// =============================================================================
// KPIs filtrados por rango - Club
// =============================================================================

export interface FilteredClubKpis {
  ticketsSold: number;
  ticketsUsed: number;
}

/**
 * Calcula KPIs de club filtrados por rango desde activity
 */
export function calculateFilteredClubKpis(
  activityItems: ActivityItem[],
  days: RangeDays
): FilteredClubKpis {
  return {
    ticketsSold: countActivityByType(activityItems, "order_created", days),
    ticketsUsed: countActivityByType(activityItems, "order_used", days),
  };
}

// =============================================================================
// Métricas de resumen para Club
// =============================================================================

export interface ClubSummaryMetrics {
  conversionRate: string;
  weeklyAverage: string;
  revenue: string;
}

/**
 * Calcula métricas de resumen para Club
 */
export function calculateClubSummary(
  ticketsSold: number,
  profileViews: number,
  revenuePaid: number,
  days: RangeDays
): ClubSummaryMetrics {
  // Conversion rate
  const conversionRate =
    profileViews > 0 ? ((ticketsSold / profileViews) * 100).toFixed(2) : "0";

  // Weekly average
  const weeks = days === 30 ? 4 : 1;
  const weeklyAvg = (ticketsSold / weeks).toFixed(2);

  return {
    conversionRate: `${conversionRate}%`,
    weeklyAverage: `${weeklyAvg} ventas`,
    revenue: `PYG ${revenuePaid.toLocaleString()}`,
  };
}

// =============================================================================
// Series temporales desde Activity
// =============================================================================

export interface DailyVisit {
  label: string;
  value: number;
}

export interface OrdersTrendData {
  label: string;
  vendidas: number;
  usadas: number;
}

/**
 * Deriva serie temporal de orders (vendidas vs usadas) desde activity
 */
export function deriveOrdersTrendFromActivity(
  activityItems: ActivityItem[],
  days: RangeDays
): OrdersTrendData[] {
  const createdEvents = activityItems.filter((item) => item.type === "order_created");
  const usedEvents = activityItems.filter((item) => item.type === "order_used");

  const filteredCreated = filterByDaysAgo(createdEvents, days);
  const filteredUsed = filterByDaysAgo(usedEvents, days);

  const now = new Date();
  const result: OrdersTrendData[] = [];

  if (days === 7) {
    // Por día
    const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayCreated = filteredCreated.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= dayStart && date < dayEnd;
      });

      const dayUsed = filteredUsed.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= dayStart && date < dayEnd;
      });

      result.push({
        label: dayLabels[6 - i],
        vendidas: dayCreated.length,
        usadas: dayUsed.length,
      });
    }
  } else {
    // Por semana
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCreated = filteredCreated.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= weekStart && date < weekEnd;
      });

      const weekUsed = filteredUsed.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= weekStart && date < weekEnd;
      });

      result.push({
        label: `Sem ${4 - i}`,
        vendidas: weekCreated.length,
        usadas: weekUsed.length,
      });
    }
  }

  return result;
}

/**
 * Deriva serie temporal de visitas desde activity items
 * Filtra solo profile_view events
 */
export function deriveVisitsTimeSeries(
  activityItems: ActivityItem[],
  days: RangeDays
): DailyVisit[] {
  const profileViews = activityItems.filter((item) => item.type === "profile_view");
  const filtered = filterByDaysAgo(profileViews, days);

  const now = new Date();
  const result: DailyVisit[] = [];

  if (days === 7) {
    // Por día
    const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayViews = filtered.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= dayStart && date < dayEnd;
      });

      result.push({
        label: dayLabels[6 - i],
        value: dayViews.length,
      });
    }
  } else {
    // Por semana
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekViews = filtered.filter((item) => {
        const date = new Date(item.timestamp);
        return date >= weekStart && date < weekEnd;
      });

      result.push({
        label: `Sem ${4 - i}`,
        value: weekViews.length,
      });
    }
  }

  return result;
}
