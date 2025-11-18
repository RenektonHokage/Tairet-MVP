import { apiGetWithAuth } from "./api";

export interface PanelUserInfo {
  local_id: string;
  email: string;
  role: string;
}

/**
 * Obtiene información del usuario del panel autenticado
 */
export async function getPanelUserInfo(): Promise<PanelUserInfo> {
  return apiGetWithAuth<PanelUserInfo>("/panel/me");
}

