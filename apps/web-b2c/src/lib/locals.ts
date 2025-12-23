/**
 * Funciones para obtener información de locales desde la API.
 * Usado por B2C para resolver slug → local_id real.
 */

import { API_URL } from "@/constants";

function getApiBase(): string {
  return import.meta.env?.VITE_API_URL || API_URL || "http://localhost:4000";
}

export interface LocalInfo {
  id: string; // UUID
  slug: string;
  name: string;
  whatsapp: string | null;
  ticket_price: number;
  type: "bar" | "club";
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

