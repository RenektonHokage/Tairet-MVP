/**
 * Helpers para manejar contacto de locales (WhatsApp, teléfono, email).
 * Incluye sanitización de números y fallbacks.
 */

import { buildWhatsAppUrl, normalizeWhatsAppNumber } from "./whatsapp";

export interface ContactInfo {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

/**
 * Sanitiza un número para wa.me: solo dígitos, sin el + inicial.
 * wa.me espera el número sin el signo +.
 */
export function sanitizeWhatsAppNumber(input: string): string {
  return normalizeWhatsAppNumber(input);
}

/**
 * Abre el mejor canal de contacto disponible con fallbacks:
 * 1. WhatsApp (preferido)
 * 2. Teléfono (tel:)
 * 3. Email (mailto:)
 * 
 * @returns true si se pudo abrir algún canal, false si no hay contacto disponible
 */
export function openContactChannel(
  contact: ContactInfo,
  message?: string
): boolean {
  if (contact.whatsapp) {
    const whatsappUrl = buildWhatsAppUrl(contact.whatsapp, message ?? "");
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank");
      return true;
    }
  }
  if (contact.phone) {
    window.open(`tel:${contact.phone}`, "_blank");
    return true;
  }
  if (contact.email) {
    const subject = encodeURIComponent("Consulta de reserva");
    const body = message ? encodeURIComponent(message) : "";
    window.open(`mailto:${contact.email}?subject=${subject}&body=${body}`, "_blank");
    return true;
  }
  return false;
}

/**
 * Verifica si hay algún canal de contacto disponible.
 */
export function hasContactChannel(contact: ContactInfo | null | undefined): boolean {
  if (!contact) return false;
  return !!(contact.whatsapp || contact.phone || contact.email);
}
