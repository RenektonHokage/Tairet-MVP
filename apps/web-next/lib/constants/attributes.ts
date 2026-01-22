/**
 * Allowlists for local attributes/tags
 * Single source of truth for panel UI
 * (synced with packages/types/src/attributes.ts and backend panel.ts)
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

/**
 * Zones/Neighborhoods for filtering and selection
 * (synced with packages/types/src/zones.ts and backend panel.ts)
 */
export const ZONES = [
  "Carmelitas",
  "Centro",
  "Villa Morra",
  "Las Mercedes",
  "Recoleta",
  "Costanera",
  "Mburucuyá"
] as const;

export type Zone = typeof ZONES[number];

/**
 * Allowed minimum age values for venues
 * NULL = no age restriction (all ages welcome)
 */
export const MIN_AGES = [18, 21, 22, 25] as const;

export type MinAge = typeof MIN_AGES[number];

/**
 * Cities/Municipalities for geocoding and display
 * (synced with packages/types/src/cities.ts and backend panel.ts)
 */
export const CITIES = [
  "Asunción",
  "San Bernardino",
  "Ciudad del Este"
] as const;

export type City = typeof CITIES[number];
