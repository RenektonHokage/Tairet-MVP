// Servicio de emails transaccionales con Resend
import { Resend } from "resend";
import QRCode from "qrcode";
import { logger } from "../utils/logger";

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
  contentId?: string; // Para inline CID
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

// Inicializar cliente Resend solo si hay API key
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * Envía un email usando Resend.
 * Si EMAIL_ENABLED !== 'true' o no hay API key, solo loguea (stub).
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!resend || process.env.EMAIL_ENABLED !== "true") {
    logger.info("[EMAIL STUB]", { to: options.to, subject: options.subject });
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "noreply@example.com",
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    if (error) {
      logger.error("Error sending email via Resend", {
        to: options.to,
        subject: options.subject,
        error: error.message,
      });
      throw new Error(error.message);
    }

    logger.info("Email sent successfully", {
      to: options.to,
      subject: options.subject,
    });
  } catch (err) {
    logger.error("Failed to send email", {
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Email de confirmación de recepción de reserva
 */
export async function sendReservationReceivedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  const dateStr = payload.date
    ? new Date(payload.date).toLocaleDateString("es-PY", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "fecha por confirmar";

  await sendEmail({
    to: payload.email,
    subject: `Reserva recibida${payload.localName ? ` en ${payload.localName}` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>¡Hola ${payload.name}!</h2>
        <p>Hemos recibido tu solicitud de reserva.</p>
        <ul>
          <li><strong>Fecha:</strong> ${dateStr}</li>
          ${payload.people ? `<li><strong>Personas:</strong> ${payload.people}</li>` : ""}
          ${payload.localName ? `<li><strong>Local:</strong> ${payload.localName}</li>` : ""}
        </ul>
        <p>Te notificaremos cuando sea confirmada.</p>
        <p style="color: #666; font-size: 12px;">Este es un mensaje automático, por favor no respondas a este email.</p>
      </div>
    `,
  });
}

/**
 * Email de confirmación de reserva aprobada
 */
export async function sendReservationConfirmedEmail(payload: {
  email: string;
  name: string;
  localName?: string;
  date?: string;
  people?: number;
}): Promise<void> {
  const dateStr = payload.date
    ? new Date(payload.date).toLocaleDateString("es-PY", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "fecha por confirmar";

  await sendEmail({
    to: payload.email,
    subject: `¡Reserva confirmada!${payload.localName ? ` en ${payload.localName}` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>¡Hola ${payload.name}!</h2>
        <p style="color: green; font-weight: bold;">Tu reserva ha sido confirmada.</p>
        <ul>
          <li><strong>Fecha:</strong> ${dateStr}</li>
          ${payload.people ? `<li><strong>Personas:</strong> ${payload.people}</li>` : ""}
          ${payload.localName ? `<li><strong>Local:</strong> ${payload.localName}</li>` : ""}
        </ul>
        <p>¡Te esperamos!</p>
        <p style="color: #666; font-size: 12px;">Este es un mensaje automático, por favor no respondas a este email.</p>
      </div>
    `,
  });
}

/**
 * Email de confirmación de orden/compra con token de check-in y QR visual
 */
export async function sendOrderConfirmationEmail(data: {
  email: string;
  name: string;
  orderId: string;
  checkinToken: string;
  localName?: string;
  quantity?: number;
  totalAmount?: number;
}): Promise<void> {
  const isFreePass = data.totalAmount === 0 || data.totalAmount === undefined;
  const subject = isFreePass ? "Tu Free Pass está listo" : "Compra confirmada";

  // Generar QR como PNG (best-effort)
  let qrBase64: string | null = null;
  try {
    const qrBuffer = await QRCode.toBuffer(data.checkinToken, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
    });
    qrBase64 = qrBuffer.toString("base64");
  } catch (err) {
    logger.warn("Failed to generate QR code for email", {
      orderId: data.orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Continuar sin QR - fallback a solo token texto
  }

  // HTML con QR si está disponible, siempre con token texto como fallback
  const qrHtml = qrBase64
    ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="cid:checkin-qr" alt="Código QR" style="max-width: 200px; display: block; margin: 0 auto;" />
        </div>
      `
    : "";

  await sendEmail({
    to: data.email,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>¡Hola ${data.name}!</h2>
        <p>${isFreePass ? "Tu <strong>Free Pass</strong> está listo." : "Tu compra ha sido confirmada."}</p>
        
        ${data.localName ? `<p><strong>Local:</strong> ${data.localName}</p>` : ""}
        ${data.quantity ? `<p><strong>Cantidad:</strong> ${data.quantity} entrada(s)</p>` : ""}
        ${!isFreePass && data.totalAmount ? `<p><strong>Total:</strong> ${data.totalAmount.toLocaleString("es-PY")} PYG</p>` : ""}
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="margin-top: 0;">Tu código de entrada</h3>
          ${qrHtml}
          <p style="font-size: 11px; color: #333; word-break: break-all; font-family: monospace; background: white; padding: 15px; border-radius: 4px; border: 1px solid #ddd;">
            ${data.checkinToken}
          </p>
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">
            ${qrBase64 ? "Escanea el QR o presenta" : "Presenta"} este código al llegar.
          </p>
        </div>
        
        <p style="color: #999; font-size: 11px; margin-top: 30px;">Este es un mensaje automático, por favor no respondas a este email.</p>
      </div>
    `,
    attachments: qrBase64
      ? [
          {
            filename: "checkin-qr.png",
            content: qrBase64,
            contentType: "image/png",
            contentId: "checkin-qr",
          },
        ]
      : undefined,
  });
}
