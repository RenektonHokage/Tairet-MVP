/**
 * Mapeo de promos mock a UUIDs reales de la base de datos.
 * 
 * Este mapeo permite que el tracking de promo_open use los IDs reales
 * de las promos en la DB, para que view_count se incremente correctamente
 * en el panel B2B.
 * 
 * Key format: `${localSlug}:${title}` para evitar colisiones entre locales.
 * 
 * En producción, las promos deberían venir directamente de la API con sus UUIDs.
 */
export const PROMO_ID_BY_LOCAL_AND_TITLE: Record<string, string> = {
  // Bares
  "mckharthys-bar:Promo de Prueba": "72dd49e1-2472-4f7c-9376-ef622af05daf",
  
  // Clubs - Morgan
  "morgan:Ladies Night": "a1b2c3d4-e5f6-4789-a012-345678901234",
  "morgan:Happy Hour": "b2c3d4e5-f6a7-4890-b123-456789012345",
  "morgan:Student Night": "c3d4e5f6-a7b8-4901-c234-567890123456",
  
  // Clubs - Celavie
  "celavie:Ladies Night": "d4e5f6a7-b8c9-4012-d345-678901234567",
  "celavie:Happy Hour": "e5f6a7b8-c9d0-4123-e456-789012345678",
  "celavie:Student Night": "f6a7b8c9-d0e1-4234-f567-890123456789",
  
  // Clubs - DLirio
  "dlirio:Bailongo - Sole Rössner": "a7b8c9d0-e1f2-4345-a678-901234567890",
  "dlirio:Tragos Fresh": "b8c9d0e1-f2a3-4456-b789-012345678901",
  "dlirio:La Fórmula Perfecta": "c9d0e1f2-a3b4-4567-c890-123456789012",
};

/**
 * Mapeo legacy por título solo (para compatibilidad con bares)
 * @deprecated Usar getRealPromoId con localSlug
 */
export const PROMO_ID_BY_TITLE: Record<string, string> = {
  "Promo de Prueba": "72dd49e1-2472-4f7c-9376-ef622af05daf",
};

/**
 * Obtiene el UUID real de una promo basado en localSlug y título.
 * Si no existe en el mapeo, retorna el ID mock (para no romper UI).
 * 
 * @param options Objeto con localSlug, localId, title y fallbackId
 * @returns UUID real si existe en mapeo, o fallbackId si no
 */
export function getRealPromoId(options: {
  localSlug?: string;
  localId?: string;
  title: string;
  fallbackId: string;
}): string {
  const { localSlug, title, fallbackId } = options;
  
  // Si tenemos localSlug, usar mapeo por localSlug:título
  if (localSlug) {
    const key = `${localSlug}:${title}`;
    const mappedId = PROMO_ID_BY_LOCAL_AND_TITLE[key];
    if (mappedId) {
      return mappedId;
    }
  }
  
  // Fallback: mapeo legacy por título solo (para bares)
  const legacyMapped = PROMO_ID_BY_TITLE[title];
  if (legacyMapped) {
    return legacyMapped;
  }
  
  // Si no hay mapeo, retornar fallbackId (puede ser UUID mock o número)
  return fallbackId;
}

