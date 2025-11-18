import { apiGet, apiGetWithAuth } from "./api";

export type ActivityType =
  | "order_paid"
  | "order_created"
  | "order_used"
  | "reservation_created"
  | "reservation_updated"
  | "whatsapp_click"
  | "promo_view"
  | "profile_view";

export interface ActivityMeta {
  order_id?: string;
  reservation_id?: string;
  promo_id?: string;
  status?: string;
  guests?: number;
  amount?: number;
  source?: string;
}

export interface ActivityItem {
  type: ActivityType;
  label: string;
  timestamp: string;
  meta?: ActivityMeta;
}

export interface ActivityResponse {
  local_id: string;
  items: ActivityItem[];
}

export async function getActivity(localId: string): Promise<ActivityResponse> {
  return apiGet<ActivityResponse>(`/activity?localId=${encodeURIComponent(localId)}`);
}

/**
 * Obtiene actividad del panel (requiere autenticación)
 * El localId se obtiene automáticamente del usuario autenticado
 */
export async function getPanelActivity(): Promise<ActivityResponse> {
  return apiGetWithAuth<ActivityResponse>("/activity");
}
