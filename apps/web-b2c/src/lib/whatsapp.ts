/**
 * Single source of truth para mensajes y URLs de WhatsApp en reservas B2C.
 */

export type VenueType = "club" | "bar";

export interface WhatsAppReservationArgs {
  venueType: VenueType;
  venueName: string;
  tableType?: string | null;
  reservationPlace?: string | null;
  dateText?: string | null;
  timeText?: string | null;
  peopleText?: string | null;
}

type ContactLike = {
  whatsapp?: string | null;
  phone?: string | null;
} | null | undefined;

const clean = (value?: string | null): string => value?.trim() ?? "";

export function normalizeWhatsAppNumber(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export function resolveWhatsAppNumber(contact: ContactLike): string | null {
  const preferred = contact?.whatsapp || contact?.phone || "";
  const normalized = normalizeWhatsAppNumber(preferred);
  return normalized || null;
}

export function hasWhatsAppNumber(contact: ContactLike): boolean {
  return !!resolveWhatsAppNumber(contact);
}

export function buildWhatsAppReservationMessage(args: WhatsAppReservationArgs): string {
  const venueName = clean(args.venueName) || (args.venueType === "club" ? "el club" : "el bar");
  const dateText = clean(args.dateText);
  const timeText = clean(args.timeText);
  const peopleText = clean(args.peopleText);

  if (args.venueType === "club") {
    const tableType = clean(args.tableType) || "(especificar)";
    return [
      `Hola ${venueName} 👋`,
      `Vengo de Tairet para reservar una mesa: ${tableType}.`,
      "",
      `📅 Fecha: ${dateText}`,
      "",
      "Mis datos:",
      "* Nombre y apellido: ",
      "* Cédula: ",
      "* Celular:",
    ].join("\n");
  }

  const reservationPlace = clean(args.reservationPlace) || "(mesa / barra / terraza)";
  return [
    `Hola ${venueName} 👋`,
    `Vengo de Tairet para reservar una mesa: ${reservationPlace}.`,
    "",
    `📅 Fecha: ${dateText}`,
    `🕒 Hora aprox: ${timeText}`,
    `👥 Personas: ${peopleText}`,
    "",
    "Mis datos:",
    "* Nombre y apellido: ",
    "* Celular:",
  ].join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone) return "";
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
