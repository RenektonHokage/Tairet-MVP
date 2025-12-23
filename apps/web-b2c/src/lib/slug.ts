/**
 * Utilidad para generar slugs consistentes desde nombres de locales.
 * Garantiza que todos los slugs sean lowercase, sin espacios, y con guiones.
 */

/**
 * Convierte un nombre a slug consistente.
 * - Convierte a minúsculas
 * - Reemplaza espacios y caracteres especiales por guiones
 * - Elimina guiones duplicados
 * - Elimina guiones al inicio y final
 * 
 * @param name Nombre del local (ej: "Mckharthys Bar", "Morgan Rooftop")
 * @returns Slug normalizado (ej: "mckharthys-bar", "morgan-rooftop")
 */
export function slugify(name: string): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  return name
    .toLowerCase()
    .trim()
    // Reemplazar espacios y caracteres especiales por guiones
    .replace(/[\s_]+/g, "-")
    // Eliminar caracteres que no sean letras, números o guiones
    .replace(/[^a-z0-9-]/g, "")
    // Eliminar guiones duplicados
    .replace(/-+/g, "-")
    // Eliminar guiones al inicio y final
    .replace(/^-+|-+$/g, "");
}

