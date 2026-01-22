/**
 * Cities/Municipalities for geocoding and display
 * Single source of truth for backend validation + panel UI
 */

export const CITIES = [
  "Asunción",
  "San Bernardino",
  "Ciudad del Este"
] as const;

export type City = (typeof CITIES)[number];

// Helper to validate city
export function isValidCity(city: unknown): city is City {
  return typeof city === "string" && CITIES.includes(city as City);
}
