// Interfaz stub para servicio de emails (Resend/SendGrid)
import { logger } from "../utils/logger";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // TODO: Implementar con Resend o SendGrid
  // const apiKey = process.env.RESEND_API_KEY;
  console.log("[EMAIL STUB]", options);
}

// Templates placeholder
export async function sendReservationReceivedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  // Stub: solo loguear
  logger.info("Reservation received email (stub)", {
    to: payload.email,
    name: payload.name,
    localName: payload.localName,
    date: payload.date,
    people: payload.people,
  });
}

export async function sendReservationConfirmedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  // Stub: solo loguear
  logger.info("Reservation confirmed email (stub)", {
    to: payload.email,
    name: payload.name,
    localName: payload.localName,
    date: payload.date,
    people: payload.people,
  });
}

export async function sendOrderConfirmationEmail(data: {
  email: string;
  orderId: string;
}): Promise<void> {
  // TODO: Template de compra confirmada (sin QR en MVP)
  await sendEmail({
    to: data.email,
    subject: "Compra confirmada",
    html: `<p>Tu orden ${data.orderId} ha sido confirmada.</p>`,
  });
}

