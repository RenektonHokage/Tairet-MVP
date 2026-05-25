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

export type OperationalActivityEntityType = "order" | "reservation";

export interface OperationalActivityItem {
  id: string;
  entity_type: OperationalActivityEntityType;
  entity_id: string;
  event_type: string;
  actor_type: "panel_user" | "customer" | "system";
  actor_role: "owner" | "staff" | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OperationalActivityEntityResponse {
  items: OperationalActivityItem[];
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

export async function getPanelEntityActivity(input: {
  entityType: OperationalActivityEntityType;
  entityId: string;
}): Promise<OperationalActivityEntityResponse> {
  const params = new URLSearchParams({
    entity_type: input.entityType,
    entity_id: input.entityId,
  });

  const response = await apiGetWithAuth<OperationalActivityEntityResponse>(
    `/panel/activity/entity?${params.toString()}`
  );

  return {
    items: Array.isArray(response.items) ? response.items : [],
  };
}
