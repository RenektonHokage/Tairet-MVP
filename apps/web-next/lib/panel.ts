import { apiGetWithAuth } from "./api";

export interface PanelUserInfo {
  role: string;
  email: string;
  local: {
    id: string;
    name: string;
    slug: string;
    type: "bar" | "club";
  };
}

/**
 * Obtiene información del usuario del panel autenticado
 */
export async function getPanelUserInfo(): Promise<PanelUserInfo> {
  return apiGetWithAuth<PanelUserInfo>("/panel/me");
}

