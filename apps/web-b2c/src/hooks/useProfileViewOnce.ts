// src/hooks/useProfileViewOnce.ts
import { useEffect } from "react";
import { trackProfileView } from "@/lib/api";

/**
 * Hook para trackear profile_view una vez por sesión y por local.
 * Acepta localId opcional para evitar errores de hooks condicionales.
 */
export function useProfileViewOnce(localId?: string) {
  useEffect(() => {
    // Si no hay localId, no hacer tracking
    if (!localId) return;

    const key = `profile_view:${localId}`;
    try {
      const already = sessionStorage.getItem(key);
      if (!already) {
        sessionStorage.setItem(key, "1");
        trackProfileView(localId, { source: "b2c_web" });
      }
    } catch {
      // fallback si sessionStorage falla
      trackProfileView(localId, { source: "b2c_web" });
    }
  }, [localId]);
}
