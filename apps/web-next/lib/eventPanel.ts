import { apiGetWithAuth } from "./api";

export type EventPanelRole = "owner" | "staff";

export interface EventPanelEvent {
  id: string;
  slug: string | null;
  title: string;
  status: string;
}

export interface EventPanelMembership {
  role: EventPanelRole;
  displayName: string | null;
}

export interface EventPanelMeResponse {
  event: EventPanelEvent;
  membership: EventPanelMembership;
}

export interface GetEventPanelMeInput {
  eventId: string;
}

interface EventPanelMeApiResponse {
  event: EventPanelEvent;
  membership: {
    role: EventPanelRole;
    display_name: string | null;
  };
}

export async function getEventPanelMe(
  eventId: string
): Promise<EventPanelMeResponse> {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) {
    throw new Error("eventId is required");
  }

  const response = await apiGetWithAuth<EventPanelMeApiResponse>(
    `/panel/events/${encodeURIComponent(normalizedEventId)}/me`
  );

  return {
    event: response.event,
    membership: {
      role: response.membership.role,
      displayName: response.membership.display_name,
    },
  };
}
