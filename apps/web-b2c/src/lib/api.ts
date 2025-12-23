// src/lib/api.ts
import { API_URL } from "@/constants";

function getApiBase(): string {
  return import.meta.env?.VITE_API_URL || API_URL || "http://localhost:4000";
}

function getUserAgent(): string | undefined {
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    return navigator.userAgent;
  }
  return undefined;
}

// 1) Registrar visita al perfil (una sola vez por carga)
export async function trackProfileView(localId: string, metadata?: { source?: string; ip_address?: string }) {
  try {
    await fetch(`${getApiBase()}/events/profile_view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local_id: localId,
        source: metadata?.source ?? "b2c_web",
        user_agent: getUserAgent(),
        ip_address: metadata?.ip_address,
      }),
    });
  } catch (e) {
    // Fire-and-forget: no bloquear UI
    console.warn("profile_view tracking failed", e);
  }
}

// 2) Click en WhatsApp
export async function trackWhatsappClick(localId: string, phone?: string, source?: string) {
  try {
    await fetch(`${getApiBase()}/events/whatsapp_click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local_id: localId,
        phone: phone ?? null,
        source: source ?? "b2c_web",
      }),
    });
  } catch (e) {
    // Fire-and-forget: no bloquear navegación
    console.warn("whatsapp_click tracking failed", e);
  }
}

// Helper para validar UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// 3) Abrir promo (con dedupe por sesión)
export async function trackPromoOpen(localId: string, promoId: string, source?: string) {
  // Guard clause: validar que promoId sea UUID válido (backend requiere UUID)
  if (!promoId || !isValidUUID(promoId)) {
    if (import.meta.env.DEV) {
      console.warn(
        `trackPromoOpen: promoId debe ser UUID válido. Recibido: "${promoId}". No se enviará tracking.`
      );
    }
    return;
  }

  // Guard clause: validar localId
  if (!localId || !isValidUUID(localId)) {
    if (import.meta.env.DEV) {
      console.warn(
        `trackPromoOpen: localId debe ser UUID válido. Recibido: "${localId}". No se enviará tracking.`
      );
    }
    return;
  }

  // Dedupe por sesión: evitar enviar el mismo evento múltiples veces
  const sessionKey = `promo_open:${localId}:${promoId}`;
  try {
    const alreadySent = sessionStorage.getItem(sessionKey);
    if (alreadySent === "1") {
      // Ya se envió en esta sesión, no reenviar
      return;
    }
  } catch (e) {
    // Si sessionStorage falla (ej: modo privado), continuar sin dedupe
    if (import.meta.env.DEV) {
      console.warn("sessionStorage no disponible para dedupe de promo_open", e);
    }
  }

  try {
    const response = await fetch(`${getApiBase()}/events/promo_open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promo_id: promoId,
        local_id: localId,
        source: source ?? "b2c_web",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData?.error || `HTTP ${response.status}`);
    }

    // Marcar como enviado en esta sesión
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch (e) {
      // Ignorar si sessionStorage falla
    }
  } catch (e) {
    // Fire-and-forget: no bloquear UI
    console.warn("promo_open tracking failed", e);
  }
}

// 4) Crear reserva
export async function createReservation(input: {
  local_id: string;
  name: string;
  last_name?: string;
  email: string;
  phone: string;
  date: string; // ISO-8601 datetime string
  guests: number;
  notes?: string;
}) {
  // Validaciones básicas
  if (!input.local_id?.trim()) throw new Error("local_id requerido");
  if (!input.name?.trim()) throw new Error("Nombre requerido");
  if (!input.email?.trim()) throw new Error("Email requerido");
  if (!input.phone?.trim()) throw new Error("Teléfono requerido");
  if (!input.date?.trim()) throw new Error("Fecha requerida (ISO-8601)");
  if (!Number.isFinite(input.guests) || input.guests < 1) {
    throw new Error("Cantidad de personas debe ser >= 1");
  }

  const res = await fetch(`${getApiBase()}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      local_id: input.local_id,
      name: input.name.trim(),
      last_name: input.last_name?.trim() || undefined,
      email: input.email.trim(),
      phone: input.phone.trim(),
      date: input.date,
      guests: input.guests,
      notes: input.notes?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    const errorMessage = errorData?.error || "Error al crear la reserva";
    throw new Error(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
  }

  return res.json();
}
