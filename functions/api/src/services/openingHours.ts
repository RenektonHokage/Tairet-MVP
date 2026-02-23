const ASUNCION_TIMEZONE = "America/Asuncion";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type DayKey = (typeof DAY_KEYS)[number];

export interface OpeningHoursRange {
  start: string;
  end: string;
}

export interface OpeningHoursDayConfig {
  closed: boolean;
  ranges: OpeningHoursRange[];
}

export interface OpeningHoursV1 {
  version: 1;
  timezone: string;
  days: Record<DayKey, OpeningHoursDayConfig>;
}

type ValidateOk = { ok: true; value: OpeningHoursV1 };
type ValidateErr = { ok: false; errors: string[] };

const STRICT_HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHHmm(value: string): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  if (STRICT_HH_MM_REGEX.test(raw)) {
    return raw;
  }

  const tolerantMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!tolerantMatch) return null;

  const hour = Number(tolerantMatch[1]);
  const minute = Number(tolerantMatch[2] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseIsoDateParts(isoDate: string): { year: number; month: number; day: number } | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const parsed = parseIsoDateParts(isoDate);
  if (!parsed) return isoDate;

  const utcMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day + deltaDays);
  const shifted = new Date(utcMs);
  const shiftedYear = shifted.getUTCFullYear();
  const shiftedMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const shiftedDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

function getAsuncionDateParts(baseNow: Date): { isoDate: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASUNCION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(baseNow);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  if (!year || !month || !day) {
    const fallbackIso = baseNow.toISOString().slice(0, 10);
    return { isoDate: fallbackIso, hour: 0, minute: 0 };
  }

  return {
    isoDate: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function parseCutoffToMinutes(cutoff: string): number {
  const parsed = parseHHmm(cutoff);
  if (!parsed) return 6 * 60;
  const [hour, minute] = parsed.split(":").map(Number);
  return hour * 60 + minute;
}

function resolveDayKeyFromIso(isoDate: string): DayKey | null {
  const parsed = parseIsoDateParts(isoDate);
  if (!parsed) return null;

  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const utcDay = utcDate.getUTCDay();
  const dayMap: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return dayMap[utcDay] ?? null;
}

function normalizeDayConfig(input: unknown, dayKey: DayKey, errors: string[]): OpeningHoursDayConfig {
  if (!input || typeof input !== "object") {
    errors.push(`days.${dayKey} debe ser un objeto`);
    return { closed: true, ranges: [] };
  }

  const source = input as Record<string, unknown>;
  const closed = Boolean(source.closed);
  const rangesRaw = Array.isArray(source.ranges) ? source.ranges : [];
  const ranges: OpeningHoursRange[] = [];

  for (let i = 0; i < rangesRaw.length; i += 1) {
    const currentRange = rangesRaw[i];
    if (!currentRange || typeof currentRange !== "object") {
      errors.push(`days.${dayKey}.ranges[${i}] debe ser un objeto`);
      continue;
    }

    const rangeSource = currentRange as Record<string, unknown>;
    const normalizedStart = parseHHmm(String(rangeSource.start ?? ""));
    const normalizedEnd = parseHHmm(String(rangeSource.end ?? ""));

    if (!normalizedStart || !normalizedEnd) {
      errors.push(`days.${dayKey}.ranges[${i}] start/end deben ser HH:mm válidos`);
      continue;
    }

    if (normalizedStart === normalizedEnd) {
      errors.push(`days.${dayKey}.ranges[${i}] start y end no pueden ser iguales`);
      continue;
    }

    ranges.push({
      start: normalizedStart,
      end: normalizedEnd,
    });
  }

  if (closed) {
    return { closed: true, ranges: [] };
  }

  return { closed: false, ranges };
}

export function validateOpeningHoursV1(input: unknown): ValidateOk | ValidateErr {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["opening_hours debe ser un objeto"] };
  }

  const source = input as Record<string, unknown>;
  const rawVersion = Number(source.version);
  if (!Number.isFinite(rawVersion) || rawVersion !== 1) {
    errors.push("opening_hours.version debe ser 1");
  }

  const timezone = typeof source.timezone === "string" && source.timezone.trim().length > 0
    ? source.timezone.trim()
    : ASUNCION_TIMEZONE;

  if (timezone !== ASUNCION_TIMEZONE) {
    errors.push(`opening_hours.timezone debe ser ${ASUNCION_TIMEZONE}`);
  }

  const daysRaw = source.days;
  if (!daysRaw || typeof daysRaw !== "object" || Array.isArray(daysRaw)) {
    errors.push("opening_hours.days debe ser un objeto");
  }

  const daySource = (daysRaw && typeof daysRaw === "object" && !Array.isArray(daysRaw)
    ? daysRaw
    : {}) as Record<string, unknown>;

  const days = DAY_KEYS.reduce((acc, dayKey) => {
    acc[dayKey] = normalizeDayConfig(daySource[dayKey], dayKey, errors);
    return acc;
  }, {} as Record<DayKey, OpeningHoursDayConfig>);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      version: 1,
      timezone,
      days,
    },
  };
}

export function formatRangeHHmm(start: string, end: string): string {
  const normalizedStart = parseHHmm(start);
  const normalizedEnd = parseHHmm(end);

  if (!normalizedStart || !normalizedEnd) {
    return `${start}-${end} hs`;
  }

  return `${normalizedStart}–${normalizedEnd} hs`;
}

export function computeOperationalDate(
  now: Date = new Date(),
  timezone: string = ASUNCION_TIMEZONE,
  cutoff: string = "06:00",
): string {
  if (timezone !== ASUNCION_TIMEZONE) {
    // v1 keeps America/Asuncion as canonical timezone.
    timezone = ASUNCION_TIMEZONE;
  }

  const { isoDate, hour, minute } = getAsuncionDateParts(now);
  const currentMinutes = hour * 60 + minute;
  const cutoffMinutes = parseCutoffToMinutes(cutoff);

  if (currentMinutes >= cutoffMinutes) {
    return isoDate;
  }

  return shiftIsoDate(isoDate, -1);
}

export function isOpenOnOperationalDate(
  openingHours: OpeningHoursV1 | null | undefined,
  operationalDate: string,
  _timezone: string = ASUNCION_TIMEZONE,
): boolean | null {
  if (!openingHours) return null;

  const dayKey = resolveDayKeyFromIso(operationalDate);
  if (!dayKey) return null;

  const day = openingHours.days?.[dayKey];
  if (!day) return null;

  if (day.closed) return false;
  if (!Array.isArray(day.ranges) || day.ranges.length === 0) return false;

  const hasAnyValidRange = day.ranges.some((range) => {
    const normalizedStart = parseHHmm(range.start);
    const normalizedEnd = parseHHmm(range.end);
    return Boolean(normalizedStart && normalizedEnd && normalizedStart !== normalizedEnd);
  });

  return hasAnyValidRange;
}

export function getTodayHoursDisplay(
  openingHours: OpeningHoursV1 | null | undefined,
  operationalDate: string,
  _timezone: string = ASUNCION_TIMEZONE,
): string | null {
  if (!openingHours) return null;

  const dayKey = resolveDayKeyFromIso(operationalDate);
  if (!dayKey) return null;

  const day = openingHours.days?.[dayKey];
  if (!day) return null;

  if (day.closed || !Array.isArray(day.ranges) || day.ranges.length === 0) {
    return "Cerrado";
  }

  const formattedRanges = day.ranges
    .map((range) => {
      const normalizedStart = parseHHmm(range.start);
      const normalizedEnd = parseHHmm(range.end);
      if (!normalizedStart || !normalizedEnd || normalizedStart === normalizedEnd) {
        return null;
      }
      return formatRangeHHmm(normalizedStart, normalizedEnd);
    })
    .filter((item): item is string => item !== null);

  if (formattedRanges.length === 0) {
    return "Cerrado";
  }

  return formattedRanges.join(" / ");
}

export function applyDailyOverride(
  baseIsOpenToday: boolean | null,
  baseTodayHours: string | null,
  dailyIsOpen: boolean | null | undefined,
): { isOpenToday: boolean | null; todayHours: string | null } {
  if (dailyIsOpen === false) {
    return { isOpenToday: false, todayHours: "Cerrado" };
  }

  if (baseIsOpenToday === null) {
    return { isOpenToday: null, todayHours: null };
  }

  return { isOpenToday: baseIsOpenToday, todayHours: baseTodayHours };
}

export function normalizeLegacyHours(rawHours: unknown): string[] {
  if (Array.isArray(rawHours)) {
    return rawHours
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof rawHours === "string") {
    return rawHours
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}
