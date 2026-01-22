/**
 * Zones/Neighborhoods for filtering and selection
 * Single source of truth for backend validation + panel UI + B2C filters
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
 * NULL/undefined = no age restriction (all ages welcome)
 */
export const MIN_AGES = [18, 21, 22, 25] as const;

export type MinAge = typeof MIN_AGES[number];

// Helper to validate zone
export function isValidZone(zone: unknown): zone is Zone {
  return typeof zone === "string" && ZONES.includes(zone as Zone);
}

// Helper to validate min age
export function isValidMinAge(age: unknown): age is MinAge {
  return typeof age === "number" && MIN_AGES.includes(age as MinAge);
}
