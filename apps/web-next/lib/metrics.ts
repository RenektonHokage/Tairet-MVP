import { apiGet, apiGetWithAuth } from "./api";

export interface TopPromoKpi {
  id: string;
  title: string;
  view_count: number;
}

export interface MetricsKpis {
  whatsapp_clicks: number;
  profile_views: number;
  promo_open_count: number;
  reservations_total: number;
  reservations_en_revision: number;
  reservations_confirmed: number;
  reservations_cancelled: number;
  orders_total: number;
  tickets_sold: number;
  tickets_used: number;
  revenue_paid: number;
  top_promo: TopPromoKpi | null;
}

export interface MetricsSummary {
  local_id: string;
  range: {
    from: string;
    to: string;
  };
  kpis: MetricsKpis;
}

// ============================================================================
// Nuevos tipos para series temporales (includeSeries=1)
// ============================================================================

export interface ProfileViewBucket {
  bucket: string; // "YYYY-MM-DD"
  value: number;
}

export interface ReservationStatusBucket {
  bucket: string;
  confirmed: number;
  pending: number;
  cancelled: number;
}

export interface OrdersSoldUsedBucket {
  bucket: string;
  sold: number;
  used: number;
}

export interface MetricsKpisRange {
  tickets_sold: number; // Semántica A: SUM(qty) orders creadas en rango
  tickets_used: number; // Semántica A: SUM(qty) orders con used_at en rango
  avg_party_size_confirmed?: number | null; // AVG(guests) de reservas confirmadas
}

export interface MetricsSeries {
  bucket_mode: "day" | "week";
  profile_views: ProfileViewBucket[];
  reservations_by_status: ReservationStatusBucket[];
  orders_sold_used: OrdersSoldUsedBucket[];
}

export interface MetricsSummaryWithSeries extends MetricsSummary {
  kpis_range: MetricsKpisRange;
  series: MetricsSeries;
}

export async function getMetricsSummary(
  localId: string,
  from?: string,
  to?: string
): Promise<MetricsSummary> {
  const params = new URLSearchParams({ localId });
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }

  return apiGet<MetricsSummary>(`/metrics/summary?${params.toString()}`);
}

/**
 * Obtiene métricas del panel (requiere autenticación)
 * El localId se obtiene automáticamente del usuario autenticado
 */
export async function getPanelMetricsSummary(
  from?: string,
  to?: string
): Promise<MetricsSummary> {
  const params = new URLSearchParams();
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }

  const query = params.toString();
  return apiGetWithAuth<MetricsSummary>(`/metrics/summary${query ? `?${query}` : ""}`);
}

/**
 * Obtiene métricas del panel CON series temporales (includeSeries=1)
 * Incluye kpis_range (semántica A) y series para gráficos
 */
export async function getPanelMetricsSummaryWithSeries(params: {
  from: string;
  to: string;
}): Promise<MetricsSummaryWithSeries> {
  const searchParams = new URLSearchParams({
    includeSeries: "1",
    from: params.from,
    to: params.to,
  });

  return apiGetWithAuth<MetricsSummaryWithSeries>(
    `/metrics/summary?${searchParams.toString()}`
  );
}
