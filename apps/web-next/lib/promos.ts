import { apiGet, apiPost, apiGetWithAuth, apiPostWithAuth } from "./api";

export interface Promo {
  id: string;
  local_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

export interface CreatePromoInput {
  local_id: string;
  title: string;
  image_url: string; // requerida
  description?: string;
  start_date?: string;
  end_date?: string;
}


export async function getPromosByLocal(localId: string): Promise<Promo[]> {
  return apiGet<Promo[]>(`/locals/${localId}/promos`);
}

/**
 * Obtiene promos del panel (requiere autenticación)
 */
export async function getPanelPromosByLocalId(localId: string): Promise<Promo[]> {
  return apiGetWithAuth<Promo[]>(`/locals/${localId}/promos`);
}

export async function trackPromoOpen(
  promoId: string,
  localId: string,
  source?: string
): Promise<void> {
  await apiPost("/events/promo_open", {
    promo_id: promoId,
    local_id: localId,
    source,
  });
}
