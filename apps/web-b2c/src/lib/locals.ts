/**
 * Funciones para obtener información de locales desde la API.
 * Usado por B2C para resolver slug → local_id real.
 */

import { API_URL } from "@/constants";

function getApiBase(): string {
  return import.meta.env?.VITE_API_URL || API_URL || "http://localhost:4000";
}

// Gallery Types
// hero: imagen principal del perfil (solo bar, NO aparece en cards)
// cover: foto de perfil para cards/listado
export type GalleryKind = "cover" | "hero" | "carousel" | "menu" | "drinks" | "food" | "interior";

export interface LocalGalleryItem {
  id: string;
  url: string;
  path: string; // Storage object path
  kind: GalleryKind;
  order: number;
}

export interface LocalInfo {
  id: string; // UUID
  slug: string;
  name: string;
  address: string | null;
  location: string | null;
  city: string | null;
  hours: string[];
  additional_info: string[];
  phone: string | null;
  whatsapp: string | null;
  ticket_price: number;
  type: "bar" | "club";
  gallery: LocalGalleryItem[];
}

// Tipo para listado de locales (resumido, con cover)
export interface LocalListItem {
  id: string;
  slug: string;
  name: string;
  type: "bar" | "club";
  location: string | null;
  city: string | null;
  cover_url: string | null;
  attributes: string[];
  min_age: number | null;
}

/**
 * Obtiene lista de locales con información básica.
 * Útil para mostrar cards en listados.
 * 
 * @param type Filtrar por tipo (bar/club), opcional
 * @param limit Máximo de resultados (default 50)
 * @returns Lista de locales con cover_url
 */
export async function getLocalsList(
  type?: "bar" | "club",
  limit: number = 50
): Promise<LocalListItem[]> {
  try {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("limit", String(limit));

    const response = await fetch(
      `${getApiBase()}/public/locals?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error al listar locales: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Error de conexión con la API");
    }
    throw error;
  }
}

/**
 * Obtiene un local por su slug desde la API pública.
 * 
 * @param slug Slug del local (ej: "mckharthys-bar", "morgan")
 * @returns Información del local o null si no existe
 * @throws Error si la petición falla (excepto 404)
 */
export async function getLocalBySlug(slug: string): Promise<LocalInfo | null> {
  if (!slug || !slug.trim()) {
    throw new Error("Slug requerido");
  }

  try {
    const response = await fetch(`${getApiBase()}/public/locals/by-slug/${encodeURIComponent(slug.trim())}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      // Local no encontrado
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData?.message || `Error al obtener local: ${response.status}`);
    }

    const data = await response.json();
    return data as LocalInfo;
  } catch (error) {
    // Si es un error de red, relanzarlo
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Error de conexión con la API");
    }
    throw error;
  }
}

// ============================================================
// Catalog Types (Entradas y Mesas - solo clubs)
// ============================================================

export interface CatalogTicket {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export interface CatalogTable {
  id: string;
  name: string;
  price: number | null;
  capacity: number | null;
  includes: string | null;
}

export interface ClubCatalog {
  local_id: string;
  tickets: CatalogTicket[];
  tables: CatalogTable[];
}

/**
 * Obtiene el catálogo de entradas y mesas de un club por su slug.
 * Solo funciona para locales tipo "club".
 * 
 * @param slug Slug del club
 * @returns Catálogo con tickets y tables, o null si no hay catálogo o no es club
 */
export async function getClubCatalog(slug: string): Promise<ClubCatalog | null> {
  if (!slug || !slug.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getApiBase()}/public/locals/by-slug/${encodeURIComponent(slug.trim())}/catalog`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 404 || response.status === 400) {
      // Local no encontrado o no es club
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData?.message || `Error al obtener catálogo: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Si es un error de red, loguear y retornar null (fallback a mocks)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn("Error de conexión al obtener catálogo, usando fallback");
      return null;
    }
    console.error("Error al obtener catálogo:", error);
    return null;
  }
}
