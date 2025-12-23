import { apiGet, apiPost, apiPatch, apiGetWithAuth, apiPatchWithAuth } from "./api";

export interface Reservation {
  id: string;
  local_id?: string;
  name: string;
  last_name?: string | null;
  email?: string;
  phone?: string;
  date: string;
  guests: number;
  status: "en_revision" | "confirmed" | "cancelled";
  notes?: string | null;
  table_note?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateReservationInput {
  local_id: string;
  name: string;
  last_name?: string;
  email: string;
  phone: string;
  date: string;
  guests: number;
  notes?: string;
  table_note?: string;
}

export async function createReservation(
  input: CreateReservationInput
): Promise<Reservation> {
  return apiPost<Reservation>("/reservations", input);
}

export async function getReservationsByLocal(
  localId: string
): Promise<Reservation[]> {
  return apiGet<Reservation[]>(`/locals/${localId}/reservations`);
}

/**
 * Obtiene reservas del panel (requiere autenticación)
 * El localId se obtiene automáticamente del usuario autenticado
 */
export async function getPanelReservations(): Promise<Reservation[]> {
  // Necesitamos obtener el localId del usuario primero
  // Por ahora, usamos una función auxiliar que requiere localId
  // Esto se puede mejorar con un endpoint que no requiera localId en el path
  throw new Error("Use getPanelReservationsByLocalId instead");
}

export async function getPanelReservationsByLocalId(
  localId: string
): Promise<Reservation[]> {
  return apiGetWithAuth<Reservation[]>(`/locals/${localId}/reservations`);
}

export interface UpdateReservationStatusInput {
  status?: "confirmed" | "cancelled";
  table_note?: string | null;
}

export async function updateReservationStatus(
  reservationId: string,
  input: UpdateReservationStatusInput
): Promise<Reservation> {
  return apiPatch<Reservation>(`/reservations/${reservationId}`, input);
}

/**
 * Actualiza estado de reserva desde el panel (requiere autenticación)
 * También permite actualizar table_note
 */
export async function updatePanelReservationStatus(
  reservationId: string,
  input: UpdateReservationStatusInput
): Promise<Reservation> {
  return apiPatchWithAuth<Reservation>(`/reservations/${reservationId}`, input);
}

