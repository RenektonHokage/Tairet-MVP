import { apiGet, apiPost, apiGetWithAuth, apiPostWithAuth, apiPatchWithAuth, apiDeleteWithAuth } from "./api";

export interface Promo {
  id: string;
  local_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

export interface CreatePromoInput {
  title: string;
  image_url: string; // requerida en POST
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdatePromoInput {
  title?: string;
  description?: string | null;
  image_url?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * Obtiene promos del panel (requiere autenticación)
 * @param includeInactive - si es false, solo retorna activas (default: true)
 */
export async function getPanelPromosByLocalId(
  localId: string,
  includeInactive = true
): Promise<Promo[]> {
  const query = includeInactive ? "" : "?include_inactive=0";
  return apiGetWithAuth<Promo[]>(`/locals/${localId}/promos${query}`);
}

/**
 * Crear promo (solo owner)
 */
export async function createPromo(localId: string, input: CreatePromoInput): Promise<Promo> {
  return apiPostWithAuth<Promo>(`/locals/${localId}/promos`, input);
}

/**
 * Actualizar promo (solo owner)
 */
export async function updatePromo(
  localId: string,
  promoId: string,
  input: UpdatePromoInput
): Promise<Promo> {
  return apiPatchWithAuth<Promo>(`/locals/${localId}/promos/${promoId}`, input);
}

/**
 * Eliminar promo (solo owner)
 */
export async function deletePromo(localId: string, promoId: string): Promise<void> {
  await apiDeleteWithAuth(`/locals/${localId}/promos/${promoId}`);
}

/**
 * Reordenar promos atómicamente (solo owner)
 * @param orderedIds - array de IDs en el nuevo orden
 */
export async function reorderPromos(
  localId: string,
  orderedIds: string[]
): Promise<void> {
  await apiPostWithAuth(`/locals/${localId}/promos/reorder`, { orderedIds });
}

/**
 * Tracking de apertura de promo (público)
 */
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

// Legacy export for compatibility
export async function getPromosByLocal(localId: string): Promise<Promo[]> {
  return apiGet<Promo[]>(`/locals/${localId}/promos`);
}
