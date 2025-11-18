import { apiGet, apiPost } from "./api";

export interface WhatsappClickInput {
  local_id: string;
  phone?: string;
  source?: string;
}

export interface WhatsappClickCount {
  local_id: string;
  count: number;
}

export async function trackWhatsappClick(
  input: WhatsappClickInput
): Promise<void> {
  await apiPost("/events/whatsapp_click", input);
}

export async function getWhatsappClickCount(
  localId: string
): Promise<WhatsappClickCount> {
  return apiGet<WhatsappClickCount>(
    `/events/whatsapp_clicks/count?localId=${encodeURIComponent(localId)}`
  );
}
