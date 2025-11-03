// Interfaz stub para servicio de emails (Resend/SendGrid)

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
export async function sendReservationReceivedEmail(data: {
  email: string;
  reservationId: string;
}): Promise<void> {
  // TODO: Template de reserva recibida
  await sendEmail({
    to: data.email,
    subject: "Reserva recibida",
    html: `<p>Tu reserva ${data.reservationId} ha sido recibida.</p>`,
  });
}

export async function sendReservationConfirmedEmail(data: {
  email: string;
  reservationId: string;
}): Promise<void> {
  // TODO: Template de reserva confirmada
  await sendEmail({
    to: data.email,
    subject: "Reserva confirmada",
    html: `<p>Tu reserva ${data.reservationId} ha sido confirmada.</p>`,
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

