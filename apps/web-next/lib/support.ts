import { apiGetWithAuth } from "./api";

// ============================================================
// Types
// ============================================================

export interface SupportStatus {
  ok: boolean;
  now: string;
  tenant: {
    local_id: string;
    local_type: "bar" | "club";
    local_slug: string;
    local_name: string;
  };
  email: {
    enabled: boolean;
  };
  rateLimit: {
    panelEnabled: boolean;
    trustProxyHops: number;
  };
}

export interface PanelAccessItem {
  email: string;
  role: string;
  created_at: string;
}

export interface PanelAccessResponse {
  items: PanelAccessItem[];
}

// ============================================================
// API Functions
// ============================================================

/**
 * Obtiene estado del sistema para diagnóstico
 * Disponible para owner + staff
 */
export async function getSupportStatus(): Promise<SupportStatus> {
  return apiGetWithAuth<SupportStatus>("/panel/support/status");
}

/**
 * Obtiene lista de usuarios del panel para el local
 * Solo disponible para owner
 */
export async function getPanelAccess(): Promise<PanelAccessResponse> {
  return apiGetWithAuth<PanelAccessResponse>("/panel/support/access");
}
