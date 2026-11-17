// Reservation instants are displayed by civil arrival date in Asunción.
export function reservationDateLabel(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed=new Date(value);
    if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("es-PY",{timeZone:"America/Asuncion",day:"2-digit",month:"2-digit",year:"numeric"}).format(parsed);
  }
  // Preserve existing demo labels, which are already formatted strings.
  return value.split(",")[0]?.trim() ?? value;
}
