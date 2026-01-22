/**
 * Parsea un texto de beneficios/incluye a un array de strings.
 * Soporta:
 * - Saltos de línea (\n, \r\n)
 * - Quita prefijos de bullets comunes: •, -, –, *
 * - Trim y filtra vacíos
 * 
 * @param text Texto con beneficios (puede tener múltiples líneas)
 * @returns Array de beneficios limpios, o [] si no hay
 */
export function parseBenefits(text: string | null | undefined): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Split por saltos de línea
  const lines = text.split(/\r?\n/);

  // Procesar cada línea
  const result = lines
    .map((line) => {
      // Trim espacios
      let cleaned = line.trim();
      // Quitar prefijos de bullets comunes
      cleaned = cleaned.replace(/^[•\-–*]\s*/, "");
      return cleaned.trim();
    })
    .filter((line) => line.length > 0);

  return result;
}
