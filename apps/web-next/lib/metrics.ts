import { apiGet, apiGetWithAuth } from "./api";

export interface TopPromoKpi {
  id: string;
  title: string;
  view_count: number;
}

export interface MetricsSummary {
  local_id: string;
  range: {
    from: string;
    to: string;
  };
  kpis: {
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
  };
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
