/**
 * Slugs MVP garantizados que tienen perfil real en el B2C.
 * Solo estos slugs deben aparecer en listados y navegación.
 */

// Slugs de bares MVP
export const MVP_BAR_SLUGS = ["mckharthys-bar", "killkenny-pub", "capitao-bar", "arsenal-bar", "koape-bar"] as const;

// Slugs de clubs MVP
export const MVP_CLUB_SLUGS = ["morgan", "celavie", "dlirio", "fresa", "mambo"] as const;

// Todos los slugs MVP
export const MVP_SLUGS = [...MVP_BAR_SLUGS, ...MVP_CLUB_SLUGS] as const;

/**
 * Verifica si un slug es un slug MVP válido.
 */
export function isMVPSlug(slug: string): boolean {
  return MVP_SLUGS.includes(slug as any);
}

/**
 * Verifica si un slug es un bar MVP.
 */
export function isMVPBar(slug: string): boolean {
  return MVP_BAR_SLUGS.includes(slug as any);
}

/**
 * Verifica si un slug es un club MVP.
 */
export function isMVPClub(slug: string): boolean {
  return MVP_CLUB_SLUGS.includes(slug as any);
}

