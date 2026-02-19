const ASUNCION_TIME_ZONE = "America/Asuncion";
export const NIGHT_CUTOFF_HOUR = 6;

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const parseIsoDate = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return utcDate;
};

const isoFromUtcDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const getAsuncionDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASUNCION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return { iso: `${year}-${month}-${day}`, hour };
};

export const addDaysToIso = (iso: string, days: number): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return isoFromUtcDate(parsed);
};

export const getAsuncionOperationalDayIso = (
  now: Date = new Date(),
  cutoffHour: number = NIGHT_CUTOFF_HOUR
): string => {
  const { iso, hour } = getAsuncionDateParts(now);
  if (!Number.isFinite(hour) || hour >= cutoffHour) return iso;
  return addDaysToIso(iso, -1);
};
