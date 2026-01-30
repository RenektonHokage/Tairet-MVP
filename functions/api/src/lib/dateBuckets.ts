/**
 * Helpers para bucketting de series temporales
 * - Sin dependencias externas
 * - weekStart como "YYYY-MM-DD" (lunes de la semana, UTC)
 */

export type BucketMode = "day" | "week";

/**
 * Determina el modo de bucketting según el rango
 * - <= 10 días: agrupar por día
 * - > 10 días: agrupar por semana
 */
export function getBucketMode(fromDate: Date, toDate: Date): BucketMode {
  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 10 ? "day" : "week";
}

/**
 * Convierte una fecha a formato bucket
 * - day: "YYYY-MM-DD"
 * - week: "YYYY-MM-DD" (lunes de esa semana, UTC)
 */
export function dateToBucket(date: Date, mode: BucketMode): string {
  if (mode === "day") {
    return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  // Calcular el lunes de la semana (UTC)
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const diff = day === 0 ? -6 : 1 - day; // días hasta el lunes anterior
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD" del lunes
}

/**
 * Genera todos los buckets vacíos en un rango
 * Esto asegura que el gráfico no "salte" fechas sin datos
 */
export function generateEmptyBuckets(
  from: Date,
  to: Date,
  mode: BucketMode
): string[] {
  const buckets: string[] = [];
  const current = new Date(from);

  if (mode === "day") {
    // Iterar día por día
    while (current <= to) {
      buckets.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else {
    // Iterar semana por semana (desde el lunes de la primera semana)
    const firstMonday = new Date(from);
    const day = firstMonday.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    firstMonday.setUTCDate(firstMonday.getUTCDate() + diff);

    const currentWeek = new Date(firstMonday);
    while (currentWeek <= to) {
      buckets.push(currentWeek.toISOString().slice(0, 10));
      currentWeek.setUTCDate(currentWeek.getUTCDate() + 7);
    }
  }

  return buckets;
}

/**
 * Inicializa un mapa de buckets con valores en 0
 */
export function initBucketMap<T>(
  buckets: string[],
  defaultValue: () => T
): Map<string, T> {
  const map = new Map<string, T>();
  for (const bucket of buckets) {
    map.set(bucket, defaultValue());
  }
  return map;
}
