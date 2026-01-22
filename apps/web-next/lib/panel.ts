import { apiGetWithAuth, apiPatchWithAuth, apiPostWithAuth } from "./api";

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

// ============================================================
// Gallery Types
// ============================================================

export const GALLERY_KINDS = ["cover", "hero", "carousel", "menu", "drinks", "food", "interior"] as const;
export type GalleryKind = (typeof GALLERY_KINDS)[number];

// Kinds permitidos por tipo de local
// hero: imagen principal del perfil (bar y club, NO aparece en cards)
// cover: foto de perfil para cards/listado
export const BAR_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "food", "menu", "drinks", "interior"];
export const CLUB_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "carousel"];

export interface LocalGalleryItem {
  id: string;
  url: string;
  path: string; // Storage object path for robust DELETE
  kind: GalleryKind;
  order: number;
}

export const GALLERY_KIND_LABELS: Record<GalleryKind, string> = {
  cover: "Foto de Perfil",
  hero: "Imagen Principal",
  carousel: "Galería",
  menu: "Carta",
  drinks: "Tragos",
  food: "Comida",
  interior: "Interior",
};

// ============================================================
// Perfil del Local (datos editables)
// ============================================================

export interface LocalProfile {
  id: string;
  name: string;
  slug: string;
  type: "bar" | "club";
  address: string | null;
  location: string | null;
  city: string | null;
  hours: string[];
  additional_info: string[];
  phone: string | null;
  whatsapp: string | null;
  gallery: LocalGalleryItem[];
  attributes: string[];
  min_age: number | null;
}

export interface UpdateLocalProfileInput {
  name?: string;
  address?: string;
  location?: string;
  city?: string | null;
  hours?: string[];
  additional_info?: string[];
  phone?: string;
  attributes?: string[];
  min_age?: number | null;
  whatsapp?: string;
  gallery?: LocalGalleryItem[];
}

interface LocalProfileResponse {
  local: LocalProfile;
}

/**
 * Obtiene el perfil completo del local (con campos editables)
 * Requiere autenticación del panel (owner o staff)
 */
export async function getPanelLocalProfile(): Promise<LocalProfile> {
  const response = await apiGetWithAuth<LocalProfileResponse>("/panel/local");
  return response.local;
}

/**
 * Actualiza el perfil del local (solo owner)
 * Requiere autenticación del panel
 */
export async function updatePanelLocalProfile(
  input: UpdateLocalProfileInput
): Promise<LocalProfile> {
  const response = await apiPatchWithAuth<LocalProfileResponse>("/panel/local", input);
  return response.local;
}

// ============================================================
// Gallery Upload/Delete
// ============================================================

interface SignedUploadResponse {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
  id: string;
  kind: GalleryKind;
}

/**
 * Obtiene una URL firmada para subir imagen directamente a Storage
 * Esto evita el límite de 100KB del body JSON
 */
export async function getSignedUploadUrl(
  file: File,
  kind: GalleryKind
): Promise<SignedUploadResponse> {
  const response = await apiPostWithAuth<SignedUploadResponse>(
    "/panel/local/gallery/signed-upload",
    { contentType: file.type, kind, fileName: file.name }
  );
  return response;
}

/**
 * Sube una imagen a la galería del local usando signed upload URL
 * @param file Archivo de imagen
 * @param kind Tipo de imagen (cover, carousel, menu, etc.)
 * @returns El nuevo item de galería (debe agregarse via updatePanelLocalProfile)
 */
export async function uploadGalleryImage(
  file: File,
  kind: GalleryKind
): Promise<LocalGalleryItem> {
  // 1. Get signed upload URL from backend
  const signedData = await getSignedUploadUrl(file, kind);

  // 2. Upload file directly to Supabase Storage
  const uploadResponse = await fetch(signedData.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Error al subir imagen a storage");
  }

  // 3. Return the gallery item to be added via PATCH
  return {
    id: signedData.id,
    url: signedData.publicUrl,
    path: signedData.path,
    kind: signedData.kind,
    order: 999, // Will be normalized when added via PATCH
  };
}

/**
 * Elimina una imagen de la galería del local (solo owner)
 * También elimina el archivo de storage
 */
export async function deleteGalleryImage(
  imageId: string
): Promise<{ success: boolean; gallery: LocalGalleryItem[] }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/panel/local/gallery/${imageId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: await getAuthHeadersForDelete(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Error: ${response.statusText}`);
  }

  return response.json();
}

// Helper para DELETE (necesita auth headers)
async function getAuthHeadersForDelete(): Promise<HeadersInit> {
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ============================================================
// Catalog Types (Entradas y Mesas - solo clubs)
// ============================================================

export interface CatalogTicket {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogTable {
  id: string;
  name: string;
  price: number | null;
  capacity: number | null;
  includes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  name: string;
  price: number;
  description?: string;
}

export interface UpdateTicketInput {
  name?: string;
  price?: number;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateTableInput {
  name: string;
  price?: number | null;
  capacity?: number | null;
  includes?: string;
}

export interface UpdateTableInput {
  name?: string;
  price?: number | null;
  capacity?: number | null;
  includes?: string;
  is_active?: boolean;
  sort_order?: number;
}

// ============================================================
// Catalog API (solo clubs)
// ============================================================

/**
 * Obtiene los tickets del local (solo clubs)
 */
export async function getCatalogTickets(): Promise<CatalogTicket[]> {
  const response = await apiGetWithAuth<{ tickets: CatalogTicket[] }>("/panel/catalog/tickets");
  return response.tickets;
}

/**
 * Crea un nuevo ticket (solo owner de club)
 */
export async function createCatalogTicket(input: CreateTicketInput): Promise<CatalogTicket> {
  const response = await apiPostWithAuth<{ ticket: CatalogTicket }>("/panel/catalog/tickets", input);
  return response.ticket;
}

/**
 * Actualiza un ticket existente (solo owner de club)
 */
export async function updateCatalogTicket(id: string, input: UpdateTicketInput): Promise<CatalogTicket> {
  const response = await apiPatchWithAuth<{ ticket: CatalogTicket }>(`/panel/catalog/tickets/${id}`, input);
  return response.ticket;
}

/**
 * Obtiene las mesas del local (solo clubs)
 */
export async function getCatalogTables(): Promise<CatalogTable[]> {
  const response = await apiGetWithAuth<{ tables: CatalogTable[] }>("/panel/catalog/tables");
  return response.tables;
}

/**
 * Crea una nueva mesa (solo owner de club)
 */
export async function createCatalogTable(input: CreateTableInput): Promise<CatalogTable> {
  const response = await apiPostWithAuth<{ table: CatalogTable }>("/panel/catalog/tables", input);
  return response.table;
}

/**
 * Actualiza una mesa existente (solo owner de club)
 */
export async function updateCatalogTable(id: string, input: UpdateTableInput): Promise<CatalogTable> {
  const response = await apiPatchWithAuth<{ table: CatalogTable }>(`/panel/catalog/tables/${id}`, input);
  return response.table;
}

/**
 * Elimina un ticket (solo owner de club, solo si NO tiene ventas)
 * @throws Error si el ticket tiene ventas (409)
 */
export async function deleteCatalogTicket(id: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/panel/catalog/tickets/${id}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Error: ${response.statusText}`);
  }
}

/**
 * Elimina una mesa (solo owner de club)
 */
export async function deleteCatalogTable(id: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/panel/catalog/tables/${id}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Error: ${response.statusText}`);
  }
}
