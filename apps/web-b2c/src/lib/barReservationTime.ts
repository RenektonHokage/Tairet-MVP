import type { OpeningHoursV1 } from "./locals";

const zone = "America/Asuncion";
const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const businessFormatter = new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});

export function civilDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function parts(date: Date) {
  const values = businessFormatter.formatToParts(date);
  const get=(key:string)=>values.find(value=>value.type===key)!.value;
  return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`};
}

// Calendar Date objects represent UI labels only, never the browser-zone arrival instant.
export function arrivalIsoInAsuncion(civil: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civil) || !clock.test(time)) return null;
  const target=Date.parse(`${civil}T${time}:00.000Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0,10)!==civil) return null;
  let candidate=target;
  for (let i=0;i<4;i++) {
    const actual=parts(new Date(candidate));
    const delta=target-Date.parse(`${actual.date}T${actual.time}:00.000Z`);
    if (delta===0) return new Date(candidate).toISOString();
    candidate+=delta;
  }
  return null;
}

export function hasReservationSchedule(value: OpeningHoursV1 | null | undefined): value is OpeningHoursV1 {
  return value?.version===1 && value.timezone===zone && days.every(day=>{
    const config=value.days?.[day];
    return typeof config?.closed==="boolean" && Array.isArray(config.ranges) && config.ranges.every(range=>clock.test(range.start)&&clock.test(range.end)&&range.start!==range.end);
  });
}

export function barArrivalWithinHours(hours: OpeningHoursV1 | null | undefined, civil: string, time: string): boolean {
  if (!hasReservationSchedule(hours) || !arrivalIsoInAsuncion(civil,time)) return false;
  const day=new Date(`${civil}T00:00:00Z`);
  const previous=new Date(day.getTime()-86_400_000);
  return [[previous,true],[day,false]].some(([opening,isPrevious])=>{
    const config=hours.days[days[(opening as Date).getUTCDay()]];
    return !config.closed && config.ranges.some(({start,end})=>isPrevious ? end<start && time<end : end<start ? time>=start : time>=start && time<end);
  });
}

export function barReservationSlots(hours: OpeningHoursV1 | null | undefined, date: Date, now = new Date()): string[] {
  if (Number.isNaN(date.getTime())) return [];
  const civil=civilDateKey(date);
  return Array.from({length:48},(_,i)=>`${String(Math.floor(i/2)).padStart(2,"0")}:${i%2 ? "30":"00"}`)
    .filter(time=>barArrivalWithinHours(hours,civil,time) && Date.parse(arrivalIsoInAsuncion(civil,time)!)-now.getTime()>=30*60_000);
}

// Calendar cells only need to know whether either opening date has a range.
// Generate time slots once for the selected day, not 48 times per calendar cell.
export function hasBarArrivalDate(hours: OpeningHoursV1 | null | undefined, date: Date): boolean {
  if (!hasReservationSchedule(hours)) return false;
  const civil=new Date(`${civilDateKey(date)}T00:00:00Z`);
  const today=hours.days[days[civil.getUTCDay()]];
  const previous=hours.days[days[(civil.getUTCDay()+6)%7]];
  return (!today.closed && today.ranges.length>0) || (!previous.closed && previous.ranges.some(range=>range.end<range.start && range.end>"00:00"));
}

export function isPastReservationDate(date: Date, now = new Date()): boolean {
  return civilDateKey(date)<parts(now).date;
}
