const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HH_MM_SS = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const ISO_WITH_TIME = /^\d{4}-\d{2}-\d{2}T/;
const ISO_DATE_TIME_SPACE = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/;

function formatWithPyTimezone(date: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatLegacyCommaTime(value: string): string | null {
  const parts = value.split(",");
  if (parts.length < 2) return null;

  const timeRaw = parts[1]?.trim();
  if (!timeRaw) return null;

  const isPm = /p\.?\s?m\.?/i.test(timeRaw);
  const isAm = /a\.?\s?m\.?/i.test(timeRaw);
  const clean = timeRaw.replace(/a\.?\s?m\.?|p\.?\s?m\.?/gi, "").trim();
  const [hourStr, minuteStr] = clean.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  let hour24 = hour;
  if (isPm && hour24 < 12) hour24 += 12;
  if (isAm && hour24 === 12) hour24 = 0;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTimePy(input: string | null | undefined): string {
  if (input == null) return "";
  const value = String(input).trim();
  if (!value) return "";

  if (HH_MM.test(value)) return value;
  const hhmmssMatch = value.match(HH_MM_SS);
  if (hhmmssMatch) return `${hhmmssMatch[1]}:${hhmmssMatch[2]}`;

  const legacyTime = formatLegacyCommaTime(value);
  if (legacyTime) return legacyTime;

  if (ISO_WITH_TIME.test(value) || ISO_DATE_TIME_SPACE.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatWithPyTimezone(parsed);
  }

  const embeddedTime = value.match(/([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?/);
  if (embeddedTime) return `${embeddedTime[1]}:${embeddedTime[2]}`;

  return value;
}
