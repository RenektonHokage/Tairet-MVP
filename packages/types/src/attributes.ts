/**
 * Allowlists for local attributes/tags
 * Single source of truth for backend validation + panel UI + B2C display
 */

// Bar specialties (displayed as chips in VenueCard)
export const BAR_SPECIALTIES = [
  "Cervezas artesanales",
  "Cocteles",
  "Vinos",
  "Terraza",
  "After Office",
  "Música en vivo",
  "Después de las 12 am",
  "Temáticas"
] as const;

// Club music genres (displayed as chips in VenueCard)
export const CLUB_GENRES = [
  "Reggaeton",
  "Electronica",
  "Pop",
  "Latino",
  "Mix"
] as const;

export type BarSpecialty = typeof BAR_SPECIALTIES[number];
export type ClubGenre = typeof CLUB_GENRES[number];

// Helper to get allowlist by local type
export function getAttributesAllowlist(localType: "bar" | "club"): readonly string[] {
  return localType === "bar" ? BAR_SPECIALTIES : CLUB_GENRES;
}

// Validation helper
export function validateAttributes(
  attributes: unknown,
  localType: "bar" | "club"
): { valid: boolean; errors: string[]; normalized: string[] } {
  const errors: string[] = [];
  const normalized: string[] = [];
  const allowlist = getAttributesAllowlist(localType);

  if (!Array.isArray(attributes)) {
    errors.push("attributes debe ser un array");
    return { valid: false, errors, normalized: [] };
  }

  const seen = new Set<string>();
  for (const item of attributes) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue; // dedupe
    
    if (!allowlist.includes(trimmed as never)) {
      errors.push(`Atributo no permitido: "${trimmed}"`);
      continue;
    }
    
    seen.add(trimmed);
    normalized.push(trimmed);
    
    if (normalized.length >= 3) break; // max 3
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}
