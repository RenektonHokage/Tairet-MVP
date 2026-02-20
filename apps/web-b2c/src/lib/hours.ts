function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\u200B/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHourToken(
  hourText: string,
  minuteText: string | undefined,
  ampmText: string | undefined,
): string | null {
  const minute = minuteText === undefined ? 0 : Number.parseInt(minuteText, 10);
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  let hour = Number.parseInt(hourText, 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 24) {
    return null;
  }

  const ampm = ampmText?.toLowerCase();
  if (ampm === "am") {
    if (hour === 12) hour = 0;
  } else if (ampm === "pm") {
    if (hour < 12) {
      hour += 12;
    }
  }

  if (hour === 24 && minute === 0) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }

  return `${pad2(hour)}:${pad2(minute)}`;
}

function splitPrefix(raw: string): { prefix: string | null; body: string } {
  const firstTimeIndex = raw.search(/\d/);
  if (firstTimeIndex <= 0) {
    return { prefix: null, body: raw };
  }

  const separatorIndex = raw.lastIndexOf(":", firstTimeIndex);
  if (separatorIndex <= 0) {
    return { prefix: null, body: raw };
  }

  const prefixCandidate = raw.slice(0, separatorIndex).trim();
  const bodyCandidate = raw.slice(separatorIndex + 1).trim();

  if (!prefixCandidate || !bodyCandidate) {
    return { prefix: null, body: raw };
  }

  // "Lun - Jue: 18:00 - 02:00" => preserve prefix, avoid interfering with time parsing.
  if (/\d/.test(prefixCandidate)) {
    return { prefix: null, body: raw };
  }

  return { prefix: prefixCandidate, body: bodyCandidate };
}

function getTimes(raw: string): string[] {
  const result: string[] = [];
  for (const match of raw.matchAll(/(\d{1,2})(?:\s*:\s*(\d{1,2}))?\s*(am|pm)?\b/gi)) {
    const normalized = parseHourToken(match[1], match[2], match[3]);
    if (normalized) {
      result.push(normalized);
    }
    if (result.length >= 2) {
      break;
    }
  }
  return result;
}

function hasStatusText(raw: string): boolean {
  return /\b(cerrad[oa]s?|abiert[oa]s?|24\/7|sin horario)\b/i.test(raw);
}

export function normalizeHoursText(raw: string): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  if (/24\s*\/\s*7/i.test(normalized)) return normalized;

  const { prefix, body } = splitPrefix(normalized);
  const times = getTimes(body);

  if (times.length >= 2) {
    const formattedRange = `${times[0]}–${times[1]} hs`;
    return prefix ? `${prefix}: ${formattedRange}` : formattedRange;
  }

  if (times.length === 1) {
    return prefix ? `${prefix}: ${times[0]}` : times[0];
  }

  if (hasStatusText(normalized)) {
    return normalized;
  }

  return null;
}

export function formatHoursDisplay(input: string | null | undefined): string | null {
  if (!input) return null;
  return normalizeHoursText(input);
}
