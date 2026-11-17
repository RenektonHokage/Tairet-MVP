import { validateOpeningHoursV1 } from "./openingHours";

export const RESERVATION_TIMEZONE = "America/Asuncion";
export const MIN_RESERVATION_NOTICE_MS = 30 * 60_000;
const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function arrivalParts(date: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RESERVATION_TIMEZONE,
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(date);
  const value = (key: string) => parts.find(part => part.type === key)!.value;
  return { date:`${value("year")}-${value("month")}-${value("day")}`, minutes:Number(value("hour"))*60+Number(value("minute")) };
}

// Returns the opening dates whose actual ranges contain the civil arrival.
// No global cutoff: a Saturday 01:00 arrival can belong to Friday's overnight range.
type ScheduleResult =
  | { ok: true; openingDates: string[] }
  | { ok: false; code: "SCHEDULE_UNAVAILABLE" | "LOCAL_CLOSED_DAY" | "LOCAL_CLOSED_TIME" };

export function evaluateReservationSchedule(raw: unknown, arrival: Date): ScheduleResult {
  const checked = validateOpeningHoursV1(raw);
  if (!checked.ok) return { ok: false, code: "SCHEDULE_UNAVAILABLE" };
  const source = raw as { days: Record<string, { closed?: unknown; ranges?: unknown }> };
  if (Object.values(source.days).some(day => typeof day?.closed !== "boolean" || !Array.isArray(day.ranges))) return { ok: false, code: "SCHEDULE_UNAVAILABLE" };
  const { date, minutes } = arrivalParts(arrival);
  const civil = new Date(`${date}T00:00:00.000Z`);
  const previous = new Date(civil.getTime()-86_400_000);
  const minute = (time: string) => Number(time.slice(0,2))*60+Number(time.slice(3,5));
  const result: string[] = [];
  for (const [opening, isPrevious] of [[previous,true],[civil,false]] as const) {
    const config = checked.value.days[days[opening.getUTCDay()]];
    if (config.closed) continue;
    const matches = config.ranges.some(range => {
      const start=minute(range.start), end=minute(range.end);
      return isPrevious ? end<start && minutes<end : end<start ? minutes>=start : minutes>=start && minutes<end;
    });
    if (matches) result.push(opening.toISOString().slice(0,10));
  }
  if (result.length) return { ok: true, openingDates: result };
  const today = checked.value.days[days[civil.getUTCDay()]];
  const prior = checked.value.days[days[previous.getUTCDay()]];
  const hasServiceToday = (!today.closed && today.ranges.length > 0) ||
    (!prior.closed && prior.ranges.some(range => range.end < range.start && range.end > "00:00"));
  return { ok: false, code: hasServiceToday ? "LOCAL_CLOSED_TIME" : "LOCAL_CLOSED_DAY" };
}
